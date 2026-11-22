import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Deterministic CSS Module class names so source selectors equal DOM selectors for live preview.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here('.'),
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@ws/ui': here('../../libs/ui/src/index.ts') } },
  css: { modules: { generateScopedName: '[local]' } },
  server: { host: '127.0.0.1', port: 4275, strictPort: true, fs: { allow: [here('../..')] } },
  build: { outDir: here('../../dist/apps/admin'), emptyOutDir: true },
});
