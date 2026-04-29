/**
 * 把 R2 对象按 HTTP Range 协议返流。
 *
 * 为什么需要：iOS AVPlayer（expo-audio 底层）加载远程音频时会先发
 * `Range: bytes=0-1` 探测，期望 206 + Content-Range + Content-Length。
 * 若服务端给一个无大小信息的 200，AVPlayer 会判定为不可 seek 的 live stream，
 * 部分 iOS 版本上会让加载流程进入 failed 但不抛错，UI 静默失败。
 *
 * 行为契约（按 RFC 7233 划分）：
 * - 无 Range：200 + Content-Length + Accept-Ranges
 * - 合法单段 Range：206 + Content-Range + Content-Length + Accept-Ranges
 * - 越界（start ≥ size，semantically unsatisfiable）：416 + Content-Range: bytes *\/{size}
 * - 语法不合法（反向、非数字、非 bytes 单位、空、suffix=0、多段含逗号等）：
 *   忽略 Range，按 200 全量返回（RFC 7233 §3.1 允许 server 忽略不合规 Range）
 * - HEAD：用 bucket.head 拿 metadata，回 200 头但不带 body
 */

const DEFAULT_CACHE_CONTROL = 'private, max-age=31536000, immutable';

export interface StreamR2Options {
  bucket: R2Bucket;
  key: string;
  request: Request;
  /** 当 R2 对象没存 contentType 时的兜底 */
  fallbackContentType?: string;
  cacheControl?: string;
}

export async function streamR2Object(opts: StreamR2Options): Promise<Response> {
  const {
    bucket,
    key,
    request,
    fallbackContentType = 'application/octet-stream',
    cacheControl = DEFAULT_CACHE_CONTROL,
  } = opts;

  if (request.method === 'HEAD') {
    const head = await bucket.head(key);
    if (!head) return notFound(request);
    return new Response(null, {
      status: 200,
      headers: buildBaseHeaders({
        size: head.size,
        contentType: head.httpMetadata?.contentType ?? fallbackContentType,
        cacheControl,
      }),
    });
  }

  const rangeHeader = request.headers.get('range');
  const parsed = parseRange(rangeHeader);

  if (parsed === 'unsupported') {
    // Range 语法不合规（多段、非 bytes 单位、反向、非纯数字等）：按 RFC 7233 §3.1
    // 忽略 Range，回 200 全量
    return getFull(bucket, key, fallbackContentType, cacheControl, request);
  }

  if (parsed === null) {
    return getFull(bucket, key, fallbackContentType, cacheControl, request);
  }

  // 先拿一次 metadata 确定 size，验 Range 合法性 + 算 416 的 Content-Range
  const head = await bucket.head(key);
  if (!head) return notFound(request);

  const resolved = resolveRange(parsed, head.size);
  if (resolved === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: {
        'content-range': `bytes */${head.size}`,
        'content-length': '0',
        'accept-ranges': 'bytes',
        'cache-control': cacheControl,
      },
    });
  }

  const obj = await bucket.get(key, { range: resolved });
  if (!obj) return notFound(request);

  // 用我们自己刚 resolve 出的 range 算 start/length——R2 回的 obj.range
  // 在 suffix 模式下不带 offset，依赖它会把 suffix Range 算成 bytes 0-N/size
  const { start, length } = rangeBounds(resolved, head.size);
  const end = start + length - 1;

  return new Response(obj.body, {
    status: 206,
    headers: {
      ...buildBaseHeaders({
        size: head.size,
        contentType: obj.httpMetadata?.contentType ?? fallbackContentType,
        cacheControl,
      }),
      'content-range': `bytes ${start}-${end}/${head.size}`,
      'content-length': String(length),
    },
  });
}

async function getFull(
  bucket: R2Bucket,
  key: string,
  fallbackContentType: string,
  cacheControl: string,
  request: Request,
): Promise<Response> {
  const obj = await bucket.get(key);
  if (!obj) return notFound(request);
  return new Response(obj.body, {
    status: 200,
    headers: buildBaseHeaders({
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? fallbackContentType,
      cacheControl,
    }),
  });
}

function buildBaseHeaders(opts: { size: number; contentType: string; cacheControl: string }): Record<string, string> {
  return {
    'content-type': opts.contentType,
    'content-length': String(opts.size),
    'accept-ranges': 'bytes',
    'cache-control': opts.cacheControl,
  };
}

/**
 * 404 响应。HEAD 时按 RFC 7231 §4.3.2 剥 body，但 headers 与 GET 保持一致
 * （都是 application/json content-type），方便客户端 / 调试工具拿到一致信号。
 */
function notFound(request: Request): Response {
  const isHead = request.method === 'HEAD';
  return new Response(isHead ? null : JSON.stringify({ error: 'not_found' }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * 把一个 GET handler 包装成「HEAD 时自动剥离响应 body」。
 *
 * 为什么需要：路由的 401/403/500/404 错误分支默认用 `NextResponse.json(...)`
 * 返回带 body 的响应，HEAD 请求走同一份 handler 时就违反 RFC 7231 §4.3.2
 * （HEAD 响应必须不带 body）。streamR2Object 在成功路径已经返 null body，
 * 这个 wrapper 只对错误分支真正起效。
 *
 * 用法：
 * ```
 * export const GET = handle;
 * export const HEAD = withHeadBodyStripped(handle);
 * ```
 */
export function withHeadBodyStripped<TCtx>(
  handler: (req: Request, ctx: TCtx) => Promise<Response>,
): (req: Request, ctx: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    const resp = await handler(req, ctx);
    if (resp.body === null) return resp;
    return new Response(null, { status: resp.status, headers: resp.headers });
  };
}

/**
 * 解析 Range header。返回：
 * - `null`：header 不存在或为空串（按 absent 处理）
 * - `'unsupported'`：语法不合法（含逗号多段、非 bytes 单位、空 spec、非纯数字、suffix=0、start > end 等）
 * - `ParsedRange`：合法 Range，留给 resolveRange 用 size 验证语义
 *
 * 严格只接受 `bytes=N-M` / `bytes=N-` / `bytes=-N` 三种形态，N/M 必须是
 * 纯数字串——`bytes=0-1abc` 这种半合法输入按 RFC 7233 §3.1 应被忽略，
 * 这里返 'unsupported' 让调用方降级 200 全量。
 */
type ParsedRange = { start: number; end: number | null } | { suffix: number };

const DIGITS_ONLY = /^\d+$/;

export function parseRange(header: string | null | undefined): ParsedRange | 'unsupported' | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  if (!trimmed.toLowerCase().startsWith('bytes=')) return 'unsupported';
  const spec = trimmed.slice(6).trim();
  if (!spec) return 'unsupported';
  if (spec.includes(',')) return 'unsupported';

  if (spec.startsWith('-')) {
    const suffixStr = spec.slice(1);
    if (!DIGITS_ONLY.test(suffixStr)) return 'unsupported';
    const n = Number.parseInt(suffixStr, 10);
    if (n <= 0) return 'unsupported';
    return { suffix: n };
  }

  const dash = spec.indexOf('-');
  if (dash < 0) return 'unsupported';
  const startStr = spec.slice(0, dash);
  const endStr = spec.slice(dash + 1);
  if (!DIGITS_ONLY.test(startStr)) return 'unsupported';
  const start = Number.parseInt(startStr, 10);
  if (endStr === '') return { start, end: null };
  if (!DIGITS_ONLY.test(endStr)) return 'unsupported';
  const end = Number.parseInt(endStr, 10);
  if (end < start) return 'unsupported';
  return { start, end };
}

/**
 * 把 ParsedRange + 对象总大小，验合法性并转成 R2Range。
 *
 * Invalid 判定（走 416）：
 * - size === 0：空对象，任何 Range 都不可满足
 * - start >= size：起点已超过对象末尾
 *
 * 非 invalid 但需 clamp（继续走 206）：
 * - end > size - 1：clamp 到末尾
 * - suffix > size：clamp 成 size（即返回整个对象）
 */
export function resolveRange(parsed: ParsedRange, size: number): R2Range | 'invalid' {
  if (size <= 0) return 'invalid';
  if ('suffix' in parsed) {
    return { suffix: Math.min(parsed.suffix, size) };
  }
  if (parsed.start >= size) return 'invalid';
  if (parsed.end === null) return { offset: parsed.start };
  // end inclusive，length = end - start + 1；超过 size-1 时 clamp 到末尾
  const effectiveEnd = Math.min(parsed.end, size - 1);
  return { offset: parsed.start, length: effectiveEnd - parsed.start + 1 };
}

/**
 * 根据 R2Range + 对象大小，算出实际返回的 [start, length]。
 * suffix 模式下 start = size - length，必须显式算，不能 fallback 到 0。
 */
function rangeBounds(range: R2Range, size: number): { start: number; length: number } {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, size);
    return { start: size - length, length };
  }
  const start = range.offset ?? 0;
  const length = range.length ?? size - start;
  return { start, length };
}
