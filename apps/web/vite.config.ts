import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = new URL('.', import.meta.url);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', projectRoot).pathname,
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['./src/**/*.test.ts', './src/**/*.test.tsx'],
  },
});
