import { describe, expect, it, vi } from 'vitest';
import { parseRange, resolveRange, streamR2Object, withHeadBodyStripped } from './r2-stream';

describe('parseRange', () => {
  it('null / 空串 → null', () => {
    expect(parseRange(null)).toBeNull();
    expect(parseRange(undefined)).toBeNull();
    expect(parseRange('')).toBeNull();
  });

  it('bytes=0-1 → { start: 0, end: 1 }', () => {
    expect(parseRange('bytes=0-1')).toEqual({ start: 0, end: 1 });
  });

  it('bytes=100- → { start: 100, end: null }', () => {
    expect(parseRange('bytes=100-')).toEqual({ start: 100, end: null });
  });

  it('bytes=-200 → { suffix: 200 }', () => {
    expect(parseRange('bytes=-200')).toEqual({ suffix: 200 });
  });

  it('大小写不敏感前缀', () => {
    expect(parseRange('BYTES=0-1')).toEqual({ start: 0, end: 1 });
  });

  it('非 bytes 单位 → unsupported', () => {
    expect(parseRange('items=0-1')).toBe('unsupported');
  });

  it('多段 ranges → unsupported（降级为 200 全量）', () => {
    expect(parseRange('bytes=0-1,2-3')).toBe('unsupported');
  });

  it('反向 / 非数字 → unsupported', () => {
    expect(parseRange('bytes=10-5')).toBe('unsupported');
    expect(parseRange('bytes=abc')).toBe('unsupported');
    expect(parseRange('bytes=-')).toBe('unsupported');
  });

  it('suffix=0 不是有效请求', () => {
    expect(parseRange('bytes=-0')).toBe('unsupported');
  });

  it('数字带尾巴 → unsupported（严格纯数字校验）', () => {
    // parseInt 默认会接受 '0-1abc' 当 end=1，必须额外校验避免误判
    expect(parseRange('bytes=0-1abc')).toBe('unsupported');
    expect(parseRange('bytes=abc-1')).toBe('unsupported');
    expect(parseRange('bytes=-3xx')).toBe('unsupported');
    expect(parseRange('bytes=1.5-2')).toBe('unsupported');
    expect(parseRange('bytes=+1-2')).toBe('unsupported');
  });

  it('全空白 trim 后为空 → null（按 absent 处理）', () => {
    expect(parseRange('   ')).toBeNull();
  });
});

describe('resolveRange', () => {
  it('start-end 转 R2Range', () => {
    expect(resolveRange({ start: 0, end: 1 }, 100)).toEqual({ offset: 0, length: 2 });
  });

  it('start-end 末尾 clamp 到 size-1', () => {
    expect(resolveRange({ start: 90, end: 200 }, 100)).toEqual({ offset: 90, length: 10 });
  });

  it('start- 转 offset only', () => {
    expect(resolveRange({ start: 50, end: null }, 100)).toEqual({ offset: 50 });
  });

  it('suffix 转 R2Range', () => {
    expect(resolveRange({ suffix: 50 }, 100)).toEqual({ suffix: 50 });
  });

  it('suffix > size 被 clamp', () => {
    expect(resolveRange({ suffix: 200 }, 100)).toEqual({ suffix: 100 });
  });

  it('start >= size → invalid', () => {
    expect(resolveRange({ start: 100, end: null }, 100)).toBe('invalid');
    expect(resolveRange({ start: 200, end: 300 }, 100)).toBe('invalid');
  });

  it('size === 0（空对象）任何 Range 都 invalid', () => {
    // 空对象 + suffix Range 之前会算出非法的 Content-Range bytes 0--1/0
    expect(resolveRange({ suffix: 100 }, 0)).toBe('invalid');
    expect(resolveRange({ start: 0, end: null }, 0)).toBe('invalid');
    expect(resolveRange({ start: 0, end: 5 }, 0)).toBe('invalid');
  });
});

// --- streamR2Object 集成测试：mock R2Bucket ---

function makeBucket(content: Uint8Array, contentType: string | undefined = 'audio/mp4'): R2Bucket {
  const headObj = {
    size: content.byteLength,
    httpMetadata: contentType === undefined ? {} : { contentType },
  } as unknown as R2Object;

  function bodyFromSlice(slice: Uint8Array): ReadableStream {
    return new ReadableStream({
      start(c) {
        c.enqueue(slice);
        c.close();
      },
    });
  }

  return {
    head: vi.fn(async () => headObj),
    get: vi.fn(async (_key: string, options?: R2GetOptions) => {
      // 测试里只会传 R2Range，不传 Headers，可安全 cast
      const range = options?.range as R2Range | undefined;
      let slice: Uint8Array;
      let returnedRange: R2Range | undefined;
      if (!range) {
        slice = content;
      } else if ('suffix' in range) {
        slice = content.slice(content.byteLength - range.suffix);
        returnedRange = range;
      } else {
        const offset = range.offset ?? 0;
        const length = range.length ?? content.byteLength - offset;
        slice = content.slice(offset, offset + length);
        returnedRange = range;
      }
      return {
        size: content.byteLength,
        httpMetadata: contentType === undefined ? {} : { contentType },
        range: returnedRange,
        body: bodyFromSlice(slice),
      } as unknown as R2ObjectBody;
    }),
  } as unknown as R2Bucket;
}

function makeRequest(opts?: { method?: string; range?: string }): Request {
  const headers: Record<string, string> = {};
  if (opts?.range) headers.range = opts.range;
  return new Request('http://test/audio', { method: opts?.method ?? 'GET', headers });
}

const TEN_BYTES = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

describe('streamR2Object', () => {
  it('无 Range → 200 + Content-Length + Accept-Ranges', async () => {
    const res = await streamR2Object({ bucket: makeBucket(TEN_BYTES), key: 'k', request: makeRequest() });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe('10');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('content-type')).toBe('audio/mp4');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf.byteLength).toBe(10);
  });

  it('Range bytes=0-1 → 206 + Content-Range bytes 0-1/10 + body 长度 2', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ range: 'bytes=0-1' }),
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-1/10');
    expect(res.headers.get('content-length')).toBe('2');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([0, 1]);
  });

  it('Range bytes=0- → 206 + 起头到末尾', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ range: 'bytes=0-' }),
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-9/10');
    expect(res.headers.get('content-length')).toBe('10');
  });

  it('Range bytes=-3 → 206 + Content-Range bytes 7-9/10 + 末尾 3 字节', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ range: 'bytes=-3' }),
    });
    expect(res.status).toBe(206);
    // Content-Range 必须按 size - suffix 算 start，不能 fallback 0
    expect(res.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(res.headers.get('content-length')).toBe('3');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([7, 8, 9]);
  });

  it('Range bytes=-100 (suffix > size) → 206 + 整个对象 + Content-Range bytes 0-9/10', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ range: 'bytes=-100' }),
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-9/10');
    expect(res.headers.get('content-length')).toBe('10');
  });

  it('Range 越界（start >= size） → 416 + 完整头', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ range: 'bytes=10-' }),
    });
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */10');
    // 与 200/206 保持一致：补齐 accept-ranges + content-length: 0 + cache-control
    expect(res.headers.get('content-length')).toBe('0');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('cache-control')).toContain('private');
  });

  it('多段 Range → 降级为 200 全量', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ range: 'bytes=0-1,2-3' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe('10');
  });

  it('HEAD → 200 + Content-Length，无 body', async () => {
    const res = await streamR2Object({
      bucket: makeBucket(TEN_BYTES),
      key: 'k',
      request: makeRequest({ method: 'HEAD' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe('10');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.body).toBeNull();
  });

  it('对象不存在 → 404', async () => {
    const bucket = {
      head: vi.fn(async () => null),
      get: vi.fn(async () => null),
    } as unknown as R2Bucket;
    const res = await streamR2Object({ bucket, key: 'missing', request: makeRequest() });
    expect(res.status).toBe(404);
  });

  it('HEAD + 对象不存在 → 404 + 无 body + 与 GET 一致的 content-type', async () => {
    const bucket = {
      head: vi.fn(async () => null),
      get: vi.fn(async () => null),
    } as unknown as R2Bucket;
    const res = await streamR2Object({ bucket, key: 'missing', request: makeRequest({ method: 'HEAD' }) });
    expect(res.status).toBe(404);
    expect(res.body).toBeNull();
    expect((await res.arrayBuffer()).byteLength).toBe(0);
    // RFC 7231：HEAD headers 应与 GET 一致，仅剥 body
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('R2 元数据缺 contentType 时使用 fallback', async () => {
    const bucket = makeBucket(TEN_BYTES, undefined);
    const res = await streamR2Object({
      bucket,
      key: 'k',
      request: makeRequest(),
      fallbackContentType: 'audio/mp4',
    });
    expect(res.headers.get('content-type')).toBe('audio/mp4');
  });
});

describe('withHeadBodyStripped', () => {
  it('handler 返回带 body 响应时剥成空 body，保留 status + headers', async () => {
    const inner = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json', 'x-custom': 'v' },
        }),
    );
    const wrapped = withHeadBodyStripped(inner);
    const res = await wrapped(new Request('http://test', { method: 'HEAD' }), {});
    expect(res.status).toBe(403);
    expect(res.headers.get('x-custom')).toBe('v');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.body).toBeNull();
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  it('handler 已经返回空 body 时直接透传，不重建', async () => {
    const original = new Response(null, { status: 200, headers: { 'content-length': '10' } });
    const inner = vi.fn(async () => original);
    const wrapped = withHeadBodyStripped(inner);
    const res = await wrapped(new Request('http://test', { method: 'HEAD' }), {});
    expect(res).toBe(original);
  });
});
