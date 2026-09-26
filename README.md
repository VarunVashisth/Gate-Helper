# GATE 2027 Helper

A local-first desktop study workspace for GATE preparation, built with Electron, React, TypeScript, SQLite, and Ollama.

## What works

- Nested, searchable syllabus tracking and study planning.
- Manual test creation and Ollama-assisted text/vision PDF import with mandatory review.
- MCQ/MSQ/NAT timed attempts, autosave/resume, immutable snapshots, and results.
- Streamed AI Tutor conversations and page-cited local document retrieval.
- SQLite persistence and managed local document storage.

PDF extraction is assisted transcription. Verify every imported question and answer before publishing.

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- Optional: [Ollama](https://ollama.com/) for imports and AI features

## Development

```bash
npm install
npm start
```

Other commands:

```bash
npm run typecheck
npm test
npm run lint
npm run package
npm run make
```

Application data is created under Electron's `userData` directory, not inside the repository.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and testing](docs/DEVELOPMENT.md)
- [Security and data handling](docs/SECURITY.md)
