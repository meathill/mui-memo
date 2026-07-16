import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 所有 /api/_e2e/* 端点必须通过此守护才能运行。
 * 只有 E2E_ENABLED=1 时打开；生产构建中 Cloudflare env 不应该设这个变量。
 */
export async function ensureE2EEnabled(): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const flag = (env as unknown as { E2E_ENABLED?: string }).E2E_ENABLED;
    if (flag === "1") return true;
  } catch {}
  return process.env.E2E_ENABLED === "1";
}
