import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});