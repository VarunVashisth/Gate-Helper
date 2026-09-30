# Phase 1 implementation record — syllabus tracker

This document records every Phase 1 addition, code path, parsing rule, persistence behavior, UI operation, API contract, validation limit, test, and explicit limitation. It supplements the Phase 0 record in `IMPLEMENTATION.md`.

## Delivered scope

The Syllabus route now supports the complete Phase 1 loop:

1. Select an official text-layer PDF up to 20 MB.
2. Upload it as multipart form data to FastAPI.
3. Extract positioned text with PyMuPDF in a worker thread.
4. Infer a topic hierarchy from typography, section labels, indentation, colons, bullets, and semicolons.
5. Review the complete result before persistence.
6. Rename, add, delete, reorder, indent, and outdent any topic or branch.
7. Atomically replace the prior confirmed syllabus.
8. Mark individual topics or whole branches complete/incomplete.
9. Cascade branch changes downward and recompute ancestor completion upward.
10. Filter the tracker by All, Completed, or Not completed.
11. Display progress based on leaf topics rather than structural headings.

Both web and Electron modes receive the same writable syllabus functionality. This resolves the Phase 0 open question by choosing feature parity for all non-LLM capabilities; only AI Tutor remains desktop-gated.

## Architecture decisions

1. **Pluggable parser boundary.** `SyllabusParser` is a protocol and `PdfSyllabusParser` is its first implementation. API and persistence code do not depend on PyMuPDF objects, so later branch-specific or OCR parsers can replace it.
2. **Preview is intentionally not persisted.** The upload endpoint returns an editable tree with stable UUIDs. The database changes only after explicit confirmation, preventing weak heuristics from silently corrupting the tracker.
3. **Original PDFs are not retained.** Phase 1 parses upload bytes in memory and closes the document immediately. This minimizes local data retention; later provenance/history requirements can add deliberate storage rather than accumulating uploads implicitly.
4. **Singleton syllabus workspace.** The product currently tracks one active GATE curriculum. Confirming a new import deletes the previous tree and progress in one SQLite transaction, then inserts the reviewed replacement. The UI warns about this before extraction/save.
5. **Stable client/server IDs.** Extracted and manually added nodes use UUIDs. IDs survive preview edits and become database keys, while server validation rejects malformed or duplicate identifiers.
6. **Normalized recursive persistence.** The existing adjacency-list `syllabus_topics` table stores parent relationships and sibling position. The `progress` table remains one-to-one with topics and cascades on replacement.
7. **Leaf-based progress.** Only nodes without children count in the percentage. Subject and category headings therefore organize the tree without inflating preparation totals.
8. **Bidirectional completion rules.** Updating a topic applies the requested state to the whole descendant subtree. Then every ancestor is recomputed from its direct children, nearest first. A parent is complete only when all direct children are complete.
9. **Server-authoritative tracker mutations.** The UI waits for the complete updated document after each checkbox operation. This avoids local state drifting from cascade/ancestor rules.
10. **Atomic replacement and mutations.** Python `sqlite3` context managers commit successful operations and roll back exceptions. Users never observe partially inserted trees.
11. **Bounded input.** Uploads are read only to 20 MB plus one byte, allowing deterministic rejection without buffering an unbounded request. Topic trees are limited to 2,000 nodes, six levels, 300 characters per name, unique UUIDs, and at least one root.
12. **CPU isolation.** PyMuPDF extraction runs through Starlette's thread pool so an expensive PDF does not block FastAPI's asynchronous event loop.
13. **Explicit scanned-PDF behavior.** PDFs without extractable text return HTTP 422 with a message explaining that OCR is not present in Phase 1. PyMuPDF remains the primary path. Tesseract is intentionally not declared until its external binary can be packaged and verified rather than advertising an unreliable fallback.
14. **Immutable React tree edits.** Every review operation returns a newly cloned path rather than mutating state. This keeps React rendering predictable even for deeply nested edits.
15. **Context-preserving filters.** A parent remains visible when any descendant matches a filter. The filtered view therefore retains hierarchy instead of showing disconnected matching leaves.
16. **Multipart-aware API client.** The shared fetch layer omits JSON `Content-Type` for `FormData`, allowing the browser to supply the required multipart boundary. It also surfaces FastAPI's `detail` message instead of hiding useful validation feedback behind a status code.

## Backend files and logic

### `requirements.txt`

- Adds `PyMuPDF==1.26.4` for font-, position-, and page-aware PDF text extraction.
- Adds `python-multipart==0.0.20`, required by FastAPI to parse `UploadFile` form requests.

### `backend/services/pdf_import/syllabus_parser.py`

- `ParsedTopic` is the parser-neutral recursive output node.
- `ParseResult` carries inferred title, roots, non-fatal review warnings, and source page count.
- `SyllabusParser` defines the replaceable parser interface.
- `PdfSyllabusParser.parse` checks the `%PDF` signature, opens bytes without creating a temporary file, rejects empty/no-text documents, chooses metadata or filename title, builds the hierarchy, and emits warnings for sparse/flat results.
- `_extract_lines` requests PyMuPDF's sorted dictionary output, joins spans while preserving Unicode, records maximum font size, x-position, boldness, and page, removes standalone page numbers, and detects repeated top/bottom headers occurring on multiple pages.
- `_build_tree` calculates median font size as the body baseline. Section/part/unit/module/chapter labels, larger text, and compact bold lines become headings. `Prefix: details` becomes a parent and semicolon-separated details become children. Bullets/numbering are stripped. Indented lines attach under the prior non-heading node; remaining lines attach under the active heading or root.
- `_split_details` separates semicolon and bullet-delimited text while discarding empty fragments.
- `_deduplicate` removes case-insensitive duplicate siblings recursively while preserving the first occurrence and source order.
- Every parsed node receives a UUID and names are capped at the database/API maximum of 300 characters.

### `backend/services/syllabus_service.py`

- `TopicRecord` and `ProgressSummary` keep persistence logic independent of FastAPI/Pydantic.
- `get_tree` performs one ordered topic/progress join, creates records by ID, then connects them to parents in memory. Orphans safely appear as roots instead of disappearing.
- `replace_tree` validates the whole input before opening the write transaction, deletes the prior tree (letting foreign-key cascades clear progress), recursively inserts deterministic sibling positions, creates matching progress rows, and returns the canonical stored tree.
- `set_completed` validates the UUID and existence, finds the full subtree using a recursive SQLite CTE, upserts one timestamped progress row per affected topic, walks the parent chain, recomputes each parent from direct-child states, and returns the refreshed document.
- `_validate_tree` enforces non-empty roots, maximum depth/count/name length, UUID format, and global ID uniqueness before a destructive replacement begins.
- `_summary` recursively collects leaves and calculates a one-decimal percentage with a safe zero-total result.

### `backend/api/syllabus.py`

- Defines recursive `TopicPayload`, `ProgressPayload`, `SyllabusPayload`, import preview, save request, and progress request schemas.
- `GET /api/syllabus` returns the active tree and leaf summary; an empty workspace returns an empty tree and zero summary.
- `POST /api/syllabus/import` accepts one PDF, enforces MIME type and 20 MB size, closes the upload, delegates extraction to a worker, maps parser errors to HTTP 422, and returns preview data without writing.
- `PUT /api/syllabus` validates and atomically replaces the active tree, mapping domain validation failures to HTTP 422.
- `PATCH /api/syllabus/topics/{uuid}` applies cascade/recompute rules and maps unknown topics to HTTP 404.
- Conversion functions explicitly translate parser, API, and service models so business logic does not leak framework types.
- `get_syllabus_service` is a dependency factory, making API tests use isolated temporary databases without changing production settings.

### `backend/main.py`

- Registers the syllabus router under the existing `/api` prefix before the optional SPA catch-all mount.

## Frontend files and logic

### `frontend/src/api/client.ts`

- Adds typed topic, document, progress, and import-preview contracts.
- Adds syllabus GET, multipart import, confirmed PUT, and progress PATCH calls.
- Detects `FormData` and leaves its content type to the browser.
- Parses error JSON and exposes FastAPI's human-readable detail through `ApiError`.

### `frontend/src/utils/topicTree.ts`

- `flattenTopics` creates depth/path records for the review editor.
- `updateListAtPath` is the single immutable recursive primitive used by all structural operations.
- `renameTopic`, `addRootTopic`, `addChildTopic`, and `removeTopic` update the selected path.
- `moveTopic` swaps a node with an adjacent sibling when the destination is valid.
- `indentTopic` removes the selected node and appends it to the preceding sibling's children.
- `outdentTopic` removes the node from its parent and inserts it immediately after that parent in the grandparent list.
- `countTopics` recursively reports preview size.
- New client-created topics use `crypto.randomUUID`, matching backend validation.

### `frontend/src/components/SyllabusImport.tsx`

- The selection stage uses an accessible PDF input, shows filename/size, permits reselection, states the 20 MB and text-layer expectations, and warns when an existing tracker will be replaced.
- Extraction, save, validation, and server failures have distinct busy/error states.
- The review stage shows inferred title, page count, topic count, warnings, inline name inputs, and accessible buttons for every structural edit.
- Save performs a client-side blank-name check, then sends the entire reviewed tree. Cancel leaves persisted data untouched; Back discards only the preview.

### `frontend/src/components/SyllabusTracker.tsx`

- Renders leaf-progress copy plus a CSS conic progress ring.
- Maintains local All/Completed/Not completed filter state.
- `filterTree` retains ancestors of matching descendants.
- Recursive rows indent by depth, expose directly styled native checkboxes with accurate accessibility hit targets, show child counts, and disable mutations while a server update is active.

### `frontend/src/routes/Syllabus.tsx`

- Loads the syllabus on mount and renders loading/error states.
- Empty workspaces enter import automatically.
- Existing workspaces receive an Import new PDF action.
- Confirmed imports replace local state and return to tracking.
- Checkbox changes call the backend and replace local state with its authoritative cascade result.

### `frontend/src/styles.css`

- Adds secondary/ghost buttons, upload dropzone, warnings/errors, review editor, compact editing controls, progress card/ring, filter tabs, nested tracker rows, row-anchored native checkbox hit targets, focus-visible treatment, disabled states, and responsive editor/tracker rules.

## Test coverage

- `test_syllabus_parser.py` generates a real in-memory PDF with PyMuPDF, verifies section/topic/detail hierarchy, page count, filename-derived title, and non-PDF rejection.
- `test_syllabus_service.py` verifies ordered replacement, leaf totals, child-to-parent recomputation, parent-to-descendant cascade, 100% calculation, and duplicate-ID rejection.
- `test_syllabus_api.py` verifies save/read/update through HTTP with an isolated database, valid PDF preview extraction, and unsupported media rejection.
- The original Phase 0 database, platform, health, and SPA tests continue to run unchanged.

## Validation performed

- `npm run build`: strict React/TypeScript build, Vite production bundle, and Electron TypeScript compilation.
- `npm run test:backend`: 14 backend tests after the valid-upload API test was added.
- Live API verification covers an empty syllabus, confirmed nested tree, cascade update, and response progress.
- Live browser verification covers empty import state, tracker layout, filters, responsive presentation, and the import entry point.
- `git diff --check` verifies patch whitespace.

## Deferred and known limitations

- OCR for image-only syllabus PDFs requires a bundled/installed Tesseract runtime and is deferred until that runtime can be made dependable. The current error is explicit rather than returning a misleading empty preview.
- Typography heuristics are intentionally conservative and cannot perfectly infer every publisher's layout; the review editor is the correctness boundary.
- The active syllabus is a singleton. Multiple named curricula, import history, rollback, and reset controls belong to later settings/polish work.
- PDF title is shown during review but not stored because the current plan's persisted Topic schema has no syllabus-document entity.
- The tracker updates one request at a time and refreshes the full tree after each mutation. This favors correctness for the expected syllabus size; batching can be introduced if real documents demonstrate a need.
