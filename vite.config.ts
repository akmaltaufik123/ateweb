import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use /ateweb/ base for GitHub Pages, / for Express server deployment
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || (isGitHubPages ? '/ateweb/' : '/'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
