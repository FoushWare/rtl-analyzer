import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["tools/rtl-scanner/tests/**/*.test.ts"] } });
