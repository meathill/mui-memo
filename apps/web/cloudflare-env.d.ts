/**
 * Cloudflare Worker 环境变量类型声明
 * 通过 getCloudflareContext() 获取
 *
 * 手动维护。加/改 binding 时同步修改这里，或跑 `pnpm cf-typegen` 重生成。
 *
 * 注：不引入 @cloudflare/workers-types —— 它会扰动 pnpm peer-dep 解析，
 * 导致 drizzle-orm 出现第二份实例，packages/shared 的 schema 与 apps/web
 * 的 db client 类型不再互通。详见 DEV_NOTE.md。
 */
interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  size: number;
}

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
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string | string[]): Promise<void>;
}

interface CloudflareEnv {
  TIDB_DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  /** 部署域名（含 scheme），例：https://muimemo.roudan.io。不设会导致 Better-Auth 推断不出 base URL，cookie 种错。 */
  BETTER_AUTH_URL?: string;
  GEMINI_API_KEY: string;
  CF_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  E2E_ENABLED?: string;
  AUDIO_BUCKET?: R2Bucket;
  ASSETS: Fetcher;
}
