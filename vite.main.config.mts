import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node:sqlite', 'node:worker_threads', '@napi-rs/canvas', 'pdfjs-dist/legacy/build/pdf.mjs'],
    },
  },
});
