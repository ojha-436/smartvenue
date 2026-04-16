import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite build configuration for SmartVenue Ops Dashboard
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
          if (id.includes('node_modules/recharts') || id.includes('node_modules/leaflet')) {
            return 'charts';
          }
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-hot-toast')
          ) {
            return 'ui';
          }
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  server: {
    port: 3002,
    proxy: {
      '/api/crowd': {
        target: process.env.VITE_CROWD_API || 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/orders': {
        target: process.env.VITE_ORDER_API || 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/staff': {
        target: process.env.VITE_STAFF_API || 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
});
