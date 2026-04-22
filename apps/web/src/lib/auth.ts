import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb } from './db';
import * as schema from '@mui-memo/shared/schema';

/**
 * 创建 Better-Auth 实例
 * 仅支持邮箱密码登录
 */
export function createAuth(databaseUrl: string, secret: string) {
  const db = createDb(databaseUrl);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'mysql',
      schema,
    }),
    secret,
    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
