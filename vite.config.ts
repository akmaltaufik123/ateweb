import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub Pages: https://akmaltaufik123.github.io/ateweb/
// Assets must resolve under /ateweb/, never domain root.
export default defineConfig({
  base: '/ateweb/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
