# Architecture

```text
React renderer -> typed preload bridge -> validated IPC -> application services
                                                   |-> database worker / SQLite
                                                   |-> managed PDFs / asset protocol
                                                   `-> Ollama at 127.0.0.1:11434
```

The renderer has no Node.js access. Context isolation and sandboxing are enabled. Preload exposes capability methods rather than raw IPC; handlers validate senders and Zod-validate input. Serializable contracts live in `src/shared`; OS access stays in `src/main`.

SQLite runs in a worker. Numbered migrations are additive and transactional. Attempts contain a complete published-test snapshot. Imported binaries live in a managed library and are reachable only through the restricted `gate-helper://asset/` protocol.

Backup export asks SQLite to create a consistent snapshot after a WAL checkpoint, then copies the managed library and writes a versioned manifest. Restore validates that manifest, creates a recovery snapshot, closes the database worker, replaces only the exact database/library targets, and relaunches Electron.

`ApplicationService` coordinates PDF, retrieval, and chat workflows. `AppDataService` owns persistence and invariants. `OllamaService` is the replaceable provider boundary.
