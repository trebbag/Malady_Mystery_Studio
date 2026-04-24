import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = new URL('.', import.meta.url);
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5050';

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
      '/api': apiProxyTarget,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['./src/**/*.test.ts', './src/**/*.test.tsx'],
  },
});
