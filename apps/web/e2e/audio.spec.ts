import { buildUtterance, expect, test } from './fixtures';

// 一段合法的静音 WebM/Opus 足以让 <audio> 的 src 响应 200（不需要能解码）
const TINY_WEBM = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3,
  0x81, 0x08, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74, 0x72, 0x6f, 0x73, 0x6b, 0x61, 0x42, 0x87, 0x81, 0x04, 0x42, 0x85,
  0x81, 0x02,
]);

test.describe('音频归档回放', () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test('有 audioKey 的任务 → 详情页出现 <audio> → /api/audio 流 200 + Range', async ({ inject, page }) => {
    // 1) 先注一条任务
    const res = await inject(
      buildUtterance({
        raw: 'ADD 语音回放测试',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '语音回放测试', place: 'any', window: 'today' },
      }),
    );
    const id = (res.effect as { id?: string }).id as string;

    // 2) 通过测试端点塞一段音频并挂到任务
    const attach = await page.request.post('/api/test-e2e/attach-audio', {
      multipart: {
        taskId: id,
        mime: 'audio/webm',
        file: {
          name: 'mock.webm',
          mimeType: 'audio/webm',
          buffer: TINY_WEBM,
        },
      },
    });
    expect(attach.status()).toBe(200);
    const { key } = (await attach.json()) as { key: string };
    expect(key).toMatch(/^muimemo\/audio\//);

    // 3) 详情页应出现 audio 控件，且 src 指向 /api/audio/...
    await page.goto(`/app/tasks/${id}`);
    const audio = page.getByTestId('task-audio');
    await expect(audio).toHaveAttribute('src', `/api/audio/${key}`);

    // 4) 无 Range 的 GET：200 + Content-Length + Accept-Ranges
    const stream = await page.request.get(`/api/audio/${key}`);
    expect(stream.status()).toBe(200);
    expect(stream.headers()['content-type']).toContain('audio/webm');
    expect(stream.headers()['accept-ranges']).toBe('bytes');
    expect(stream.headers()['content-length']).toBe(String(TINY_WEBM.length));

    // 5) Range bytes=0-1 → 206 + Content-Range + body 长度 2（iOS AVPlayer 要这个！）
    const partial = await page.request.get(`/api/audio/${key}`, {
      headers: { Range: 'bytes=0-1' },
    });
    expect(partial.status()).toBe(206);
    expect(partial.headers()['content-range']).toBe(`bytes 0-1/${TINY_WEBM.length}`);
    expect(partial.headers()['content-length']).toBe('2');
    expect(partial.headers()['accept-ranges']).toBe('bytes');
    expect((await partial.body()).length).toBe(2);

    // 6) Range bytes=0- → 起头到末尾
    const open = await page.request.get(`/api/audio/${key}`, { headers: { Range: 'bytes=0-' } });
    expect(open.status()).toBe(206);
    expect(open.headers()['content-range']).toBe(`bytes 0-${TINY_WEBM.length - 1}/${TINY_WEBM.length}`);

    // 7) Range 越界 → 416 + Content-Range bytes */size
    const oob = await page.request.get(`/api/audio/${key}`, {
      headers: { Range: `bytes=${TINY_WEBM.length}-` },
    });
    expect(oob.status()).toBe(416);
    expect(oob.headers()['content-range']).toBe(`bytes */${TINY_WEBM.length}`);

    // 8) HEAD → 200 头 + 无 body
    const head = await page.request.fetch(`/api/audio/${key}`, { method: 'HEAD' });
    expect(head.status()).toBe(200);
    expect(head.headers()['content-length']).toBe(String(TINY_WEBM.length));
    expect(head.headers()['accept-ranges']).toBe('bytes');
    expect((await head.body()).length).toBe(0);
  });

  test('访问别人的 audio key → 403', async ({ page }) => {
    const res = await page.request.get('/api/audio/muimemo/audio/someone-else/any.webm');
    expect(res.status()).toBe(403);
  });

  test('没带登录的流请求 → 401', async ({ browser, baseURL }) => {
    // 显式 storageState: undefined，避免从 project use 继承登录态
    const ctx = await browser.newContext({
      baseURL,
      storageState: undefined,
    });
    const res = await ctx.request.get('/api/audio/muimemo/audio/foo/any.webm');
    expect(res.status()).toBe(401);
    await ctx.close();
  });
});
