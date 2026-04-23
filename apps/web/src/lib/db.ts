import * as schema from '@mui-memo/shared/schema';
import { connect } from '@tidbcloud/serverless';
import { drizzle } from 'drizzle-orm/tidb-serverless';

/**
 * 创建 Drizzle ORM 实例
 * 在 Cloudflare Workers 环境下，通过 getCloudflareContext() 获取 env.TIDB_DATABASE_URL
 * 本地开发时通过 .dev.vars 注入
 */
export function createDb(databaseUrl: string) {
  const client = connect({ url: databaseUrl });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
