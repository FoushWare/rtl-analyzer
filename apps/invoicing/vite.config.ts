import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  root: __dirname,
  cacheDir: process.env.RTL_VITE_CACHE_DIR ?? "../../node_modules/.vite/invoicing",
  plugins: [
    react(),
    tsconfigPaths({ projects: [resolve(__dirname, "../../tsconfig.json")] }),
  ],
  server: { port: 4200, host: "127.0.0.1", strictPort: true },
  build: { outDir: "../../dist/apps/invoicing", emptyOutDir: true },
});
