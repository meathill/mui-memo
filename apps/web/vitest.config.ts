import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// 本地跑 vitest 时把 .dev.vars / .env 加到 process.env：
// AI prompt eval 套件用 OPENAI_API_KEY / GEMINI_API_KEY 决定走哪个 provider；
// override:false 让 CI 上显式注入的 env 优先（不被本地文件覆盖）。
loadEnv({ path: path.resolve(__dirname, ".dev.vars"), override: false });
loadEnv({ path: path.resolve(__dirname, ".env"), override: false });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // e2e/ 走 Playwright，不由 vitest 跑
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
