import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // While developing, requests to /api are forwarded to the backend.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
