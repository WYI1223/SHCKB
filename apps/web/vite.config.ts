import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.SHCKB_API_TARGET ?? 'http://localhost:3000',
        // Keep the original Host header so better-auth's origin check
        // sees a single-origin request (matches the production shape
        // where the server serves both web and API).
        changeOrigin: false,
      },
    },
  },
});
