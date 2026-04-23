import { buildUtterance, expect, test } from './fixtures';

test.describe('混合搜索（TiDB 原生）', () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test('关键词命中：resolveTargetTask 能找到 text 包含 query 的任务', async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: 'ADD A',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '去超市买酱油', place: 'any', window: 'today' },
      }),
    );
    await inject(
      buildUtterance({
        raw: 'ADD B',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '给老妈打电话', place: 'any', window: 'today' },
      }),
    );

    const res = await page.request.post('/api/test-e2e/resolve', {
      data: { query: '买酱油', keyword: '酱油' },
    });
    expect(res.status()).toBe(200);
    const { resolved } = (await res.json()) as {
      resolved: { text: string; fromFts: boolean; fromVec: boolean } | null;
    };
    expect(resolved).not.toBeNull();
    expect(resolved?.text).toBe('去超市买酱油');
  });

  test('语义命中：query 不是 substring，也能通过向量召回找到相近任务', async ({ inject, page }) => {
    // "给老妈打电话" 和 "跟家里联系一下" 字面不同，但语义近
    await inject(
      buildUtterance({
        raw: 'ADD',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '给老妈打电话', place: 'any', window: 'today' },
      }),
    );
    await inject(
      buildUtterance({
        raw: 'ADD',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '去超市买酱油', place: 'any', window: 'today' },
      }),
    );

    // TiDB 生成列是 INSERT 时填，但索引 / 模型耗时可能导致首次查询有延迟；
    // 这里用 expect.poll 宽容几秒
    await expect
      .poll(
        async () => {
          const r = await page.request.post('/api/test-e2e/resolve', {
            data: { query: '跟家里联系一下' },
          });
          const { resolved } = (await r.json()) as {
            resolved: { text: string } | null;
          };
          return resolved?.text ?? null;
        },
        { timeout: 20_000, intervals: [500, 1000, 2000] },
      )
      .toBe('给老妈打电话');
  });

  test('完全无关的 query → null', async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: 'ADD',
        intent: 'ADD',
        aiVerb: '新增',
        task: { text: '给老妈打电话', place: 'any', window: 'today' },
      }),
    );

    const res = await page.request.post('/api/test-e2e/resolve', {
      data: { query: 'xyzzzz_completely_unrelated_foobar_baz' },
    });
    const { resolved } = (await res.json()) as { resolved: unknown };
    // 关键词和语义都对不上，应返回 null（或至少分数够低被过滤）
    expect(resolved).toBeNull();
  });
});
