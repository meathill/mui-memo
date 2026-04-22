import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: '../../packages/shared/src/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.TIDB_DATABASE_URL!,
  },
});
