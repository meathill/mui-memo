import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
// 使用 localhost 而非 127.0.0.1：Next.js dev 默认只允许 localhost 作为同源请求，
// 127.0.0.1 会触发 cross-origin HMR 拦截，影响 client 端路由与 fetch。
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // 共享一个 e2e 用户，串行更稳定
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // 录音组件依赖 MediaRecorder —— 我们不直接测 UI 录音，改用 /api/_e2e/intent 注入 utterance
  },
  globalTeardown: path.resolve('./e2e/teardown.ts'),
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve('./e2e/.auth/user.json'),
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    cwd: path.resolve('.'),
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      E2E_ENABLED: '1',
      PORT: String(PORT),
      BETTER_AUTH_URL: BASE_URL,
    },
  },
});
