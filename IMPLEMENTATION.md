# Phase 0 implementation record

This document records every artifact and executable decision added for the Phase 0 checkpoint in `plan.md`. It is deliberately exhaustive so later phases can distinguish established contracts from placeholders. Phase 1 is documented separately in `PHASE1_IMPLEMENTATION.md`.

## Scope boundary

Implemented: React/Vite shell, web and Electron development workflows, five routed pages, a platform-aware AI Tutor state, FastAPI health/platform endpoints, SQLite schema initialization, static paper-asset mount, backend tests, and production compilation commands.

Deferred exactly as the plan requests: PDF/OCR dependencies and extraction, syllabus review/edit/tracking behavior, mock/PYQ import, exam runner, scoring/results calculations, Ollama model/chat/streaming endpoints, PyInstaller, electron-builder installers, settings/reset UI, and dashboard database rollups. The visible placeholder pages make that boundary explicit rather than simulating unavailable behavior.

## Architecture decisions

1. **One API contract for both shells.** React calls `/api/platform` and never detects Electron via user-agent or exposed Node APIs. Deployment mode is authoritative in Python, keeping capability policy in one place.
2. **Environment-selected mode.** The backend defaults to `web`; Electron sets `GATE_HELPER_MODE=desktop` in the child process. An unrecognized value safely falls back to web, preventing accidental exposure of desktop-only capability.
3. **Thin Electron main process.** Its only responsibilities are backend lifecycle, readiness polling, secure window creation, and renderer loading. It contains no study, persistence, PDF, scoring, or tutor logic.
4. **Standard-library Ollama probe.** Phase 0 checks the configured TCP endpoint with `asyncio.open_connection` and a 350 ms timeout. This avoids adding an HTTP client before Phase 3. Web mode short-circuits and always returns false, even if Ollama happens to be present on the server.
5. **Plain SQLite.** The plan permits SQLAlchemy or `sqlite3`; Phase 0 uses Python's built-in driver to minimize dependencies. SQL and connection policy are centralized so repositories/services can be layered on later.
6. **Normalized storage plus JSON leaves.** Papers, questions, attempts, topics, and progress are normalized tables. Variable option/image/answer shapes use JSON text columns. This retains queryable relationships while supporting MCQ, MSQ, and NAT answer shapes.
7. **Database integrity in SQLite.** Foreign keys, cascade deletion, enumerated-value checks, non-negative mark checks, unique ordering, and lookup indexes are defined up front. WAL mode improves local read/write concurrency.
8. **Context-owned platform state.** React fetches platform information once at startup and distributes a typed loading/ready/error union. Components cannot accidentally read missing data, and the user can retry a failed backend connection.
9. **Same-origin frontend calls.** The client defaults to relative URLs. Vite proxies API/assets in development; deployed web builds can set `VITE_API_URL`. Electron development uses the same proxy, preserving one renderer build.
10. **Secure renderer defaults.** Electron uses context isolation, disables Node integration, enables sandboxing, hides the window until ready, and exposes only a frozen shell marker from preload. The UI does not rely on that marker for authorization.
11. **Health-gated window creation.** Electron polls `/api/health` for at most 15 seconds before loading the renderer. Startup failures become a visible native error instead of a permanently broken page.
12. **Idempotent startup.** `CREATE TABLE/INDEX IF NOT EXISTS` makes database initialization safe on every FastAPI lifespan. The data and paper-assets directories are also created if absent.
13. **Accessible responsive navigation.** Semantic navigation, explicit link labels that remain available when visual text collapses, current-route styling, readable contrast, meaningful status text, and a compact mobile navigation layout are included in the initial shell.
14. **No invented release URL.** The desktop CTA uses a clearly documented placeholder and supports `VITE_DESKTOP_DOWNLOAD_URL`; it must be configured when the first installer exists.
15. **Backend-served packaged renderer.** Production Electron loads the renderer from the local FastAPI origin, not `file://`. This preserves relative API URLs and lets the backend provide SPA route fallback without relaxing renderer security.
16. **Portable Python selection.** Root commands use a small Node launcher that prefers `PYTHON_EXECUTABLE`, then the platform-specific project `.venv`, then system Python. Electron follows the same order on Windows, eliminating dependence on an activated shell.

## File-by-file code ledger

### Root tooling

- `.gitignore`: excludes dependency trees, renderer/Electron build output, Python and TypeScript build caches, virtual environments, runtime SQLite/WAL files, imported assets/uploads, secrets, and logs. It keeps `backend/data/.gitkeep` so the intended runtime location is visible.
- `package.json`: owns cross-project orchestration. `dev:web` runs FastAPI with reload and Vite together. `dev:electron` starts Vite, waits for its port, then compiles/starts Electron (which starts FastAPI itself). `build` compiles both renderer and Electron. `test` performs the build before backend tests.
- `scripts/run-python.mjs`: selects the configured, project-virtual-environment, or system Python cross-platform; forwards arguments, standard I/O, exit status, and termination signals.
- `requirements.txt`: pins the runtime API server dependencies.
- `requirements-dev.txt`: includes runtime dependencies plus HTTP test-client and pytest dependencies.

### Python backend

- `backend/config.py`: parses mode, CORS origins, data directory, database path, and Ollama address once into an immutable settings object. Defaults are local-development-safe and all operational paths are overrideable.
- `backend/main.py`: creates the FastAPI application, initializes SQLite inside the lifespan before serving traffic, configures explicit-origin CORS, registers the platform router, exposes extracted paper files under `/assets/papers`, provides `/api/health`, and optionally serves a built renderer with SPA fallback. Its direct-execution block remains a convenience, while scripts use the import-safe module form.
- `backend/api/platform.py`: defines the validated response model, performs the bounded async Ollama reachability probe, and implements `GET /api/platform`. The probe only runs in desktop mode.
- `backend/db/database.py`: defines the full five-table schema, indexes, foreign-key behavior, constraints, WAL connection policy, row mapping, directory creation, and idempotent initialization.
- `backend/db/models.py`: records framework-independent domain shapes matching the plan. Immutable option/question/paper values prevent accidental mutation; topic remains mutable because review UI editing will build and rearrange its children.
- package `__init__.py` files: make imports and test discovery explicit.
- `backend/data/.gitkeep`: retains the empty runtime directory while generated data stays ignored.

### Database schema logic

- `papers`: stable text ID, required title/source/duration, optional year, creation timestamp, and a source constraint limited to `pyq`/`mock`.
- `questions`: belongs to a paper, preserves HTML-lite text and JSON image/options/answer forms, enforces MCQ/MSQ/NAT, non-negative marks, and a unique position within each paper.
- `attempts`: belongs to a paper, stores evolving answers as JSON, permits a null score/submission while in progress, and timestamps start/submission independently.
- `syllabus_topics`: represents a recursive adjacency-list tree through `parent_id`, with deterministic sibling positions and cascade removal.
- `progress`: one row per topic, boolean completion constrained to 0/1, with an update timestamp and cascade cleanup.
- indexes cover each principal foreign-key lookup used by later list/detail/tree queries.

### React renderer

- `frontend/package.json` and TypeScript configs: provide strict React compilation, Vite build/preview, modern browser targets, and typed Vite configuration.
- `frontend/vite.config.ts`: fixes development port 5173 and proxies `/api` plus future paper assets to FastAPI port 8000.
- `frontend/index.html`: supplies the mount point and baseline metadata.
- `frontend/src/main.tsx`: composes Strict Mode, browser routing, platform state, and the application.
- `frontend/src/api/client.ts`: centralizes the base URL, typed platform response, fetch error normalization, status handling, and future API surface.
- `frontend/src/context/PlatformContext.tsx`: models loading/success/error as a discriminated union, loads platform state on mount, suppresses state changes after unmount, and offers explicit retry.
- `frontend/src/App.tsx`: declares Dashboard, Syllabus, Tests, Results, AI Tutor, and fallback routes inside the shared layout.
- `frontend/src/components/Layout.tsx`: renders brand, sidebar navigation, active state, desktop Tutor marker, live mode label, and the nested route outlet.
- `frontend/src/components/Icon.tsx`: supplies a small internal SVG icon vocabulary, avoiding another runtime package.
- `frontend/src/components/PageIntro.tsx`: standardizes page hierarchy and optional actions.
- `frontend/src/routes/Dashboard.tsx`: supplies the Phase 0 overview, empty-state metrics, and clear next action without pretending data exists.
- `Syllabus.tsx`, `Tests.tsx`, and `Results.tsx`: identify the owning future phase and current storage readiness.
- `AiTutor.tsx`: renders loading and retryable backend errors; web receives a download CTA; desktop receives Ollama online/offline guidance. No chat is implied before Phase 3.
- `NotFound.tsx`: catches unknown URLs and provides a dashboard return path.
- `shared.tsx`: keeps repeated phase-placeholder markup consistent.
- `styles.css`: defines the visual system, shell, cards, capability states, animation, and the mobile breakpoint. Local system fonts avoid a runtime network dependency and keep the desktop experience genuinely offline-capable.

### Electron shell

- `electron/main.ts`: chooses the development Python command or packaged backend executable, injects desktop mode, inherits logs, hides the child console on Windows, waits on health, opens a hardened browser window, selects dev URL versus built file, reports failures, and terminates the backend on quit.
- `electron/preload.ts`: exposes only an immutable `shell: electron` marker. It is intentionally not used as the security boundary.
- `electron/tsconfig.json`: compiles the Electron process files to CommonJS under `dist-electron`, matching the package entry point.

### Tests

- `test_database.py`: verifies every required table exists and initialization can safely run more than once.
- `test_platform.py`: verifies health, asserts web mode cannot advertise Ollama even when its probe is mocked reachable, and verifies desktop mode reports a successful probe.
- `test_static_frontend.py`: verifies client-side routes fall back to the renderer entry point while missing asset filenames remain genuine 404 responses.

## Runtime sequences

### Web development

1. The root script launches Uvicorn in default web mode and Vite concurrently.
2. FastAPI's lifespan creates the runtime directory and schema.
3. The browser loads React from Vite.
4. React requests `/api/platform`; Vite proxies it to FastAPI.
5. The API returns web mode with Ollama unavailable, and AI Tutor displays the desktop CTA.

### Electron development

1. The root script starts Vite and waits for port 5173.
2. TypeScript compiles the Electron main/preload files, then Electron starts.
3. Electron selects `PYTHON_EXECUTABLE`, the project `.venv`, or system Python in that order; it spawns Uvicorn with desktop mode and polls its health endpoint.
4. After health succeeds, Electron opens Vite in the hardened renderer window. A packaged build instead asks FastAPI to serve the built renderer and opens that local HTTP origin.
5. React requests the same platform endpoint and receives desktop mode plus the current Ollama reachability result.
6. Quitting the app terminates the owned Python child process.

## Verification contract

`npm test` must complete three layers: strict renderer TypeScript plus Vite production bundling, strict Electron TypeScript compilation, and Python backend tests. Manual verification should additionally visit all five routes in web mode, confirm the web Tutor CTA, launch Electron without the web backend occupying port 8000, confirm desktop mode, and compare Tutor status with Ollama stopped/started.

## Known Phase 0 limitations and next decisions

- Python 3.14 may not be supported by every future PDF/OCR package; Python 3.11–3.13 is the safer packaging target until compatibility is verified.
- The packaged `.exe` path is wired but no PyInstaller/electron-builder recipe exists until Phase 4.
- BrowserRouter requires a server fallback for deep links in a deployed web environment; the selected hosting configuration must route unknown paths to `index.html`.
- The release download URL needs a real project location.
- Extraction accuracy still requires representative official syllabus, question-paper, and answer-key PDFs.
- Before Phase 1, confirm whether deployed web mode may write/import study data and whether equation rendering requires KaTeX. These alter upload/security and parsing choices.
- `npm audit --omit=dev` reports zero runtime vulnerabilities. The root install reported two high-severity findings in development tooling; a full advisory refresh was unavailable on the final network check, so those should be reviewed before the packaging phase rather than auto-fixed with breaking upgrades.

