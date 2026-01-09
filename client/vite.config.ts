import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared')
    }
  },
  // Allow importing TypeScript files from outside client folder
  build: {
    commonjsOptions: {
      include: [/shared/, /node_modules/]
    }
  },
  optimizeDeps: {
    include: []
  },
  server: {
    port: 3001,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      },
      '/api': {
        target: 'http://localhost:3000'
      }
    }
  },
  // Enable SPA fallback for client-side routing (dashboard routes)
  preview: {
    port: 3001
  }
});
