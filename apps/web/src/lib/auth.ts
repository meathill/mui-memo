import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import * as schema from "@mui-memo/shared/schema";
import { createDb } from "./db";

export interface CreateAuthOptions {
  databaseUrl: string;
  secret: string;
  /** 部署域名（含 https://）。没设 Better-Auth 会走 host header 猜，cookie 可能种错。 */
  baseURL?: string;
}

/**
 * 创建 Better-Auth 实例。CF Workers 的 vars 只能通过 getCloudflareContext 拿，
 * 所以 baseURL 要从外面显式传进来，不能走 process.env。
 */
export function createAuth(opts: CreateAuthOptions) {
  const db = createDb(opts.databaseUrl);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "mysql",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret: opts.secret,
    baseURL: opts.baseURL,
    trustedOrigins: opts.baseURL ? [opts.baseURL] : undefined,
    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * 服务端获取 auth 实例。
 * baseURL 取 env.BETTER_AUTH_URL（wrangler var），回退到 process.env（本地
 * .dev.vars 会把两处都写上）。
 */
export async function getServerAuth() {
  const { env } = await getCloudflareContext({ async: true });
  // process.env 优先：Playwright webServer 会注入 localhost URL，拿它来跑 e2e；
  // 生产环境 Worker 里 process.env 是空的，自动回退到 CF env.BETTER_AUTH_URL。
  const baseURL =
    process.env.BETTER_AUTH_URL ??
    (env as unknown as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL;
  return createAuth({
    databaseUrl: env.TIDB_DATABASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
  });
}

/**
 * 服务端读取当前 session
 */
export async function getServerSession() {
  const auth = await getServerAuth();
  const h = await headers();
  return auth.api.getSession({ headers: h });
}
