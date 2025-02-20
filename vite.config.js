import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Optional: Define env variables here if needed
  define: {
    // You can add global definitions here if needed
  }
});