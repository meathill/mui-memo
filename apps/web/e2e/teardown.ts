import { request } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * 清理所有 e2e+% 邮箱的账号和任务。
 */
export default async function teardown() {
  try {
    const ctx = await request.newContext({ baseURL: BASE_URL });
    await ctx.post("/api/test-e2e/cleanup", {
      data: { email: "e2e+%@muimemo.test", mode: "user" },
    });
    await ctx.dispose();
  } catch (err) {
    // 服务器可能已经关闭，忽略
    console.warn("[teardown] cleanup skipped:", err);
  }
}
