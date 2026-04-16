import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite build configuration for SmartVenue Attendee App
 * Implements code splitting, asset optimisation, and build-level performance tuning.
 */
export default defineConfig({
  plugins: [react()],

  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Raise chunk-size warning threshold slightly for chunked builds
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting strategy:
         * - vendor: third-party libraries that change rarely (Firebase SDK, React)
         * - firebase: Firebase modules loaded separately to enable tree-shaking
         * - ui: UI utility libraries (lucide-react, react-hot-toast)
         * - router: React-Router DOM (lazy-loaded at startup)
         */
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
            id.includes('node_modules/react-hot-toast')
          ) {
            return 'ui';
          }
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'map';
          }
        },

        // Deterministic asset filenames for long-lived caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  // Dev server proxies for local microservice development
  server: {
    port: 3000,
    proxy: {
      '/api/attendees': {
        target: process.env.VITE_ATTENDEE_API || 'http://localhost:3004',
        changeOrigin: true,
      },
      '/api/queues': {
        target: process.env.VITE_QUEUE_API || 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/orders': {
        target: process.env.VITE_ORDER_API || 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
});
