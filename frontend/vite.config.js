import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // While developing, requests to /api are forwarded to the backend.
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
