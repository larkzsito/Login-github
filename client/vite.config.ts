import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configura Vite para compilar y servir el proyecto React durante desarrollo.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
