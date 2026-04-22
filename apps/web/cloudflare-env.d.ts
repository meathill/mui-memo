/**
 * Cloudflare Worker 环境变量类型声明
 * 通过 getCloudflareContext() 获取
 *
 * 生产环境下可通过 `pnpm cf-typegen` 自动生成
 * 这里手动维护以确保开发时类型安全
 */
interface CloudflareEnv {
  // TiDB Serverless 连接字符串
  TIDB_DATABASE_URL: string;

  // Better-Auth 密钥
  BETTER_AUTH_SECRET: string;

  // Gemini API Key
  GEMINI_API_KEY: string;

  // Cloudflare R2 Bucket (音频存储)
  // AUDIO_BUCKET: R2Bucket;

  // Static assets binding (OpenNext)
  ASSETS: Fetcher;
}
