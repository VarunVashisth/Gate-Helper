# Development and testing

Node.js 24+ is required for built-in `node:sqlite`. Dependencies are locked in `package-lock.json`.

Run `npm start` for development. Before merging, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e`. The E2E command packages and launches Electron and can require network access when preparing Electron/native artifacts.

Put renderer-independent rules in `src/shared/domain` with unit tests. Every IPC capability must be represented in shared contracts, the channel list, preload, and a validated main handler. Never expose Electron events, arbitrary IPC channels, filesystem paths, or database handles.

Add a numbered migration for schema changes; never rewrite a released migration. Imports remain drafts until publication validation passes. PDF.js and Canvas load on demand, so optional PDF functionality cannot prevent startup.

