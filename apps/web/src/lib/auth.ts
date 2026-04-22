import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import * as schema from "@mui-memo/shared/schema";
import { createDb } from "./db";

/**
 * 创建 Better-Auth 实例
 */
export function createAuth(databaseUrl: string, secret: string) {
  const db = createDb(databaseUrl);
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
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: process.env.BETTER_AUTH_URL
      ? [process.env.BETTER_AUTH_URL]
      : undefined,
    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * 服务端获取 auth 实例
 */
export async function getServerAuth() {
  const { env } = await getCloudflareContext({ async: true });
  return createAuth(env.TIDB_DATABASE_URL, env.BETTER_AUTH_SECRET);
}

/**
 * 服务端读取当前 session
 */
export async function getServerSession() {
  const auth = await getServerAuth();
  const h = await headers();
  return auth.api.getSession({ headers: h });
}
