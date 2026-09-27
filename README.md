# GATE 2027 Helper

A local-first GATE preparation companion with one React interface for the web and Electron, backed by the same Python/FastAPI API.

## Phase 0 status

This repository currently implements the foundation checkpoint from `plan.md`: the shared UI shell, five routes, platform detection, desktop process management, and SQLite schema. PDF extraction, syllabus tracking behavior, test taking/scoring, and LLM chat are intentionally deferred to their planned phases.

## Prerequisites

- Node.js 22 or newer
- Python 3.11 or newer
- Ollama is optional; the desktop placeholder only reports whether its default port is reachable

## Install

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
npm install
npm --prefix frontend install
```

## Run the web app

```powershell
npm run dev:web
```

Open `http://127.0.0.1:5173`. The backend defaults to web mode and the AI Tutor route shows the desktop download call-to-action.

## Run the Electron app

```powershell
npm run dev:electron
```

Electron starts the Python backend with `GATE_HELPER_MODE=desktop`, waits for `/api/health`, and then opens the React development server. Do not run `dev:web` at the same time because both commands use backend port 8000.

## Validate

```powershell
npm test
```

This compiles the React and Electron TypeScript projects, builds the production web assets, and runs the backend tests.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GATE_HELPER_MODE` | `web` | Selects `web` or `desktop` capability behavior. Electron sets `desktop`. |
| `GATE_HELPER_DATA_DIR` | `backend/data` | Overrides the SQLite and extracted-asset directory. |
| `GATE_HELPER_ALLOWED_ORIGINS` | local Vite URLs | Comma-separated CORS allowlist. |
| `GATE_HELPER_FRONTEND_DIR` | unset | Built frontend directory served by FastAPI in packaged desktop mode. |
| `OLLAMA_HOST` | `127.0.0.1` | Host used by the availability probe. |
| `OLLAMA_PORT` | `11434` | Port used by the availability probe. |
| `VITE_API_URL` | same origin | Optional deployed API base URL. Development uses Vite's proxy. |
| `VITE_DESKTOP_DOWNLOAD_URL` | GitHub placeholder | Desktop download target to replace once releases exist. |
| `PYTHON_EXECUTABLE` | project `.venv`, then `python` | Explicit Python executable used by root scripts and Electron during development. |

Full implementation and architecture notes are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

