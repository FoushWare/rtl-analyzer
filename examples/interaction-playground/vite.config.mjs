import { defineConfig } from 'vite';

// Deterministic CSS Module class names so source selectors equal DOM selectors for live preview.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  css: { modules: { generateScopedName: '[local]' } },
  server: { host: '127.0.0.1', port: 4255, strictPort: true },
});
