import { getApplePublicKey } from '@better-auth/core/social-providers';
import * as schema from '@mui-memo/shared/schema';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { decodeJwt, decodeProtectedHeader, jwtVerify } from 'jose';
import { headers } from 'next/headers';
import { createDb } from './db';

export interface CreateAuthOptions {
  databaseUrl: string;
  secret: string;
  /** 部署域名（含 https://）。没设 Better-Auth 会走 host header 猜，cookie 可能种错。 */
  baseURL?: string;
  /**
   * iOS 原生 Sign in with Apple：我们只用 identityToken 验证流。
   * - `appBundleIdentifier` 是 Xcode 里那个 bundle id，Better-Auth 会拿它做 `aud` 校验
   * - `clientId` 对 Web OAuth 回调是 Services ID；本项目只走原生，传同一个 bundle id 即可
   * - 不配 clientSecret，因为不走服务端 JWT 换 token 那条路径
   */
  appleBundleIdentifier?: string;
}

/**
 * 创建 Better-Auth 实例。CF Workers 的 vars 只能通过 getCloudflareContext 拿，
 * 所以 baseURL 要从外面显式传进来，不能走 process.env。
 */
export function createAuth(opts: CreateAuthOptions) {
  const db = createDb(opts.databaseUrl);
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'mysql',
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
    socialProviders: opts.appleBundleIdentifier
      ? {
          apple: {
            // 原生流：clientId + appBundleIdentifier 都用 bundle id。Better-Auth
            // 会自动拉 https://appleid.apple.com/auth/keys 验签 + 校 aud
            clientId: opts.appleBundleIdentifier,
            appBundleIdentifier: opts.appleBundleIdentifier,
            // 自定义 verifyIdToken：默认实现把所有错都 catch 掉只 return false，
            // 排查时根本看不到原因。这里把抛出来的具体错和关键 claim 都打到 log
            verifyIdToken: async (token, nonce) => {
              try {
                const { kid, alg } = decodeProtectedHeader(token);
                const claims = decodeJwt(token);
                console.log('[apple] inbound idToken', {
                  kid,
                  alg,
                  iss: claims.iss,
                  aud: claims.aud,
                  sub: claims.sub,
                  exp: claims.exp,
                  nonceClaim: claims.nonce,
                  nonceFromBody: nonce,
                  expectedAud: opts.appleBundleIdentifier,
                });
                if (!kid || !alg) {
                  console.error('[apple] missing kid or alg in JWT header');
                  return false;
                }
                const { payload } = await jwtVerify(token, await getApplePublicKey(kid), {
                  algorithms: [alg],
                  issuer: 'https://appleid.apple.com',
                  audience: opts.appleBundleIdentifier,
                  maxTokenAge: '1h',
                });
                if (nonce && payload.nonce !== nonce) {
                  console.error('[apple] nonce mismatch', {
                    fromBody: nonce,
                    fromJwt: payload.nonce,
                  });
                  return false;
                }
                console.log('[apple] verifyIdToken OK', { sub: payload.sub });
                return true;
              } catch (err) {
                console.error(
                  '[apple] verifyIdToken failed:',
                  err instanceof Error ? err.message : err,
                );
                return false;
              }
            },
          },
        }
      : undefined,
    // RN 客户端没有 cookie 语境，带 Authorization: Bearer <session-token> 走这个 plugin
    plugins: [bearer()],
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
  const baseURL = process.env.BETTER_AUTH_URL ?? (env as unknown as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL;
  return createAuth({
    databaseUrl: env.TIDB_DATABASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    appleBundleIdentifier:
      process.env.APPLE_BUNDLE_IDENTIFIER ??
      (env as unknown as { APPLE_BUNDLE_IDENTIFIER?: string }).APPLE_BUNDLE_IDENTIFIER ??
      'com.meathill.muimemo',
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
