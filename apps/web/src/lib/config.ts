/**
 * 所有 R2 key 都带这个前缀，方便和同 bucket 里其它项目的资源区分。
 */
export const R2_PREFIX = "muimemo";

/**
 * 前端拼接附件 URL 时用的 base。生产走 i.roudan.io 自定义域名直接命中 R2。
 * 需要 Next.js 在 build 时把 `NEXT_PUBLIC_ASSETS_URL` 烘进去；未设就用默认。
 */
export const ASSETS_URL =
  process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/+$/, "") ??
  "https://i.roudan.io";

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB
