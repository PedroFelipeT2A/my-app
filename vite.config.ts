import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
      },
      '/content': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        followRedirects: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});