import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node:sqlite', 'node:worker_threads'],
    },
  },
});
