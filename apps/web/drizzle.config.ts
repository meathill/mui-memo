import { config as loadEnv } from 'dotenv';
import type { Config } from 'drizzle-kit';

loadEnv({ path: '.env', override: true });

// 从 URL 里解析出 host/port/user/password/database
const url = new URL(process.env.TIDB_DATABASE_URL!);

export default {
  dialect: 'mysql',
  schema: '../../packages/shared/src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 4000),
    user: url.username,
    password: url.password,
    database: url.pathname.replace('/', ''),
    ssl: {
      rejectUnauthorized: true,
    },
  },
} satisfies Config;
