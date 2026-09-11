import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base keeps the static build working under any GitHub Pages repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
});
