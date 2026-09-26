# Security and data handling

- Node integration is disabled; context isolation and renderer sandboxing are enabled.
- IPC is allowlisted, sender-checked, and Zod-validated.
- PDF names are sanitized; 100 MB and 500-page safety limits apply.
- Managed deletion verifies the resolved target is inside the library root.
- Restore validates a versioned manifest, rejects backups selected from inside the managed library, and creates a recovery snapshot before replacement.
- Assets use a restricted custom protocol; arbitrary `file://` navigation is blocked.
- Ollama is contacted only from the main process over loopback.
- Tutor Markdown is sanitized. Model output and imported text are untrusted.
- The app has no telemetry, account, sync, automatic model download, or cloud upload.

Uploaded papers remain local user material. Users are responsible for permission to use them and should not publish extracted content without review.
