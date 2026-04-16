import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite build configuration for SmartVenue Staff App
 * Implements code splitting and build-level performance tuning.
 */
export default defineConfig({
  plugins: [react()],

  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/react-router-dom')) {
            return 'router';
          }
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-hot-toast') ||
            id.includes('node_modules/recharts')
          ) {
            return 'ui';
          }
          if (id.includes('node_modules/axios')) {
            return 'http';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  server: {
    port: 3001,
    proxy: {
      '/api/staff': {
        target: process.env.VITE_STAFF_API || 'http://localhost:3005',
        changeOrigin: true,
      },
      '/api/crowd': {
        target: process.env.VITE_CROWD_API || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
