import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The console talks to exactly one backend route: POST /api/recovery.
// In dev we proxy it to the Python service so live and mock modes share one code path.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
