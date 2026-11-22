import { defineConfig } from 'vite';

// Deterministic CSS Module class names so the Analyzer's source selector
// (.editLink) equals the DOM selector it maps for live preview.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  css: { modules: { generateScopedName: '[local]' } },
  server: { host: '127.0.0.1', port: 4225, strictPort: true },
});
