import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Deterministic CSS Module class names so source selectors equal DOM selectors for live preview.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here('.'),
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@ws/ui': here('../../libs/ui/src/index.ts') } },
  // Pre-bundle React at server start so the first page load is not reloaded by Vite's dependency optimizer.
  optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'] },
  css: { modules: { generateScopedName: '[local]' } },
  server: { host: '127.0.0.1', port: 4265, strictPort: true, fs: { allow: [here('../..')] } },
  build: { outDir: here('../../dist/apps/storefront'), emptyOutDir: true },
});
