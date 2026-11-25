import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["tools/rtl-scanner/tests/**/*.test.ts"], exclude: ["tools/rtl-scanner/tests/policy-historical.test.ts"],
    // Every run gets its own temporary root, removed after the run, so overlay tests leave nothing in the OS temporary directory.
    globalSetup: ["implementation/tools/rtl-scanner/tests/support/temp-root.ts"]
  } });
