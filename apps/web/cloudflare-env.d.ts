/**
 * Cloudflare Worker 环境变量类型声明
 * 通过 getCloudflareContext() 获取
 *
 * 生产环境下可通过 `pnpm cf-typegen` 自动生成
 * 这里手动维护以确保开发时类型安全
 */
// 轻量 R2Bucket 最小接口声明，避免引入 @cloudflare/workers-types 的大型依赖
// 仅描述本项目实际使用的方法；完整类型可在需要时通过 `pnpm cf-typegen` 生成
interface R2Bucket {
  put(
    key: string,
    value:
      | ArrayBuffer
      | ArrayBufferView
      | ReadableStream
      | string
      | Blob
      | null,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

interface CloudflareEnv {
  // TiDB Serverless 连接字符串
  TIDB_DATABASE_URL: string;

  // Better-Auth 密钥
  BETTER_AUTH_SECRET: string;

  // Gemini API Key（AI Studio key，不是 Vertex）
  GEMINI_API_KEY: string;

  // Cloudflare AI Gateway 路由（可选：两个都设才启用 Gateway）
  CF_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;

  // 仅 dev 环境：打开 /api/_e2e/* 测试端点（"1" = 启用）
  E2E_ENABLED?: string;

  // Cloudflare R2 Bucket (音频归档，wrangler.jsonc 中已 binding)
  AUDIO_BUCKET?: R2Bucket;

  // Static assets binding (OpenNext)
  ASSETS: Fetcher;
}
