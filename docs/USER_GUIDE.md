# User guide

Set your paper name in **Syllabus**, add nested topics, then create dated work in **Study Planner**. Dashboard cards always reflect stored data; the app does not fabricate progress.

## Tests

Create a paper manually or import a question PDF and optional answer-key PDF using a running Ollama model. Originals and page previews stay local. Every import is a draft: verify question text, type, options, marks, answer, and source page. Missing answers are marked `REVIEW_REQUIRED` and block publication.

- MCQ: exact answer; configured negative marks apply to a wrong attempt.
- MSQ: exact answer set; no partial credit.
- NAT: one value or an inclusive `minimum:maximum` range.

An attempt stores an immutable paper snapshot, autosaves, resumes after restart, and submits idempotently. PDF limits are 100 MB and 500 pages. For image-only pages, the app asks the selected Ollama model to transcribe rendered page images (up to 50 pages per import). Use a vision-capable model such as `qwen3-vl:8b`; OCR output is explicitly warned and must be checked against the page preview.

The exam header includes an offline scientific calculator with arithmetic, powers, modulo, roots, logarithms, trigonometric functions, and constants. Trigonometric inputs use radians. Expressions are parsed by an allowlisted evaluator and are never executed as JavaScript.

## AI Tutor

**Model knowledge** uses the selected local model. **Uploaded documents** retrieves indexed passages and asks the model to answer from them, with document/page citations. Indexing requires an embedding-capable Ollama model. Generated explanations can be wrong; check important claims against authoritative material.

Application data lives in Electron's per-user data directory. Use **Export backup** on the Dashboard to create a portable folder containing the SQLite snapshot, managed PDFs, and a versioned manifest. **Restore backup** validates the manifest and database, asks for confirmation, creates an automatic recovery backup, replaces the data, and restarts the application.
