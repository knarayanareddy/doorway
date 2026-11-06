import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite root is the repo root so that starter-widget/, data/, and mock-platform/
// are all accessible. The mock platform pages live under mock-platform/.
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'mock-platform/index.html'),
        search: resolve(__dirname, 'mock-platform/search.html'),
        demo: resolve(__dirname, 'starter-widget/demo.html'),
      },
    },
  },
});
