import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // e2e/ 走 Playwright，不由 vitest 跑
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
