import { describe, expect, it } from 'vitest';
import {
  currentPeriodIndex,
  periodLengthMs,
  periodStart,
  type RecurrenceDef,
  type RecurrenceInstanceLite,
  reconcileRecurrences,
} from './recurrence.js';

// ──────────────────────────────────────────────
// 夹具
// ──────────────────────────────────────────────

// anchor 是周三 09:00Z；FIXED_NOW 距它 21 天 5 时 → weekly×1 第 3 期、weekly×2 第 1 期
const ANCHOR = '2026-04-01T09:00:00.000Z';
const FIXED_NOW = new Date('2026-04-22T14:05:00.000Z');

function def(partial: Partial<RecurrenceDef> & { id: string }): RecurrenceDef {
  return {
    text: '倒垃圾',
    place: 'any',
    window: 'today',
    energy: 2,
    priority: 2,
    tag: null,
    freq: 'weekly',
    interval: 1,
    anchorAt: ANCHOR,
    tzOffset: 0,
    ...partial,
  };
}

function inst(
  partial: Partial<RecurrenceInstanceLite> & { id: string; recurrenceId: string; periodIndex: number },
): RecurrenceInstanceLite {
  return { status: 'pending', ...partial };
}

// ──────────────────────────────────────────────
// periodLengthMs
// ──────────────────────────────────────────────

describe('periodLengthMs', () => {
  it('每天 = 1 天', () => {
    expect(periodLengthMs('daily', 1)).toBe(86_400_000);
  });
  it('每周 = 7 天', () => {
    expect(periodLengthMs('weekly', 1)).toBe(7 * 86_400_000);
  });
  it('每两周 = 14 天', () => {
    expect(periodLengthMs('weekly', 2)).toBe(14 * 86_400_000);
  });
});

// ──────────────────────────────────────────────
// currentPeriodIndex
// ──────────────────────────────────────────────

describe('currentPeriodIndex', () => {
  const anchor = new Date(ANCHOR);

  it('now 早于 anchor → null（还没开始）', () => {
    expect(currentPeriodIndex(anchor, new Date('2026-03-25T09:00:00Z'), 'weekly', 1)).toBeNull();
  });
  it('now == anchor → 0', () => {
    expect(currentPeriodIndex(anchor, new Date(ANCHOR), 'weekly', 1)).toBe(0);
  });
  it('周期中段 → k', () => {
    expect(currentPeriodIndex(anchor, new Date('2026-04-11T21:00:00Z'), 'weekly', 1)).toBe(1);
  });
  it('恰好整周期边界 → 进位到下一期', () => {
    expect(currentPeriodIndex(anchor, new Date('2026-04-08T09:00:00Z'), 'weekly', 1)).toBe(1);
  });
  it('每两周：第 8 天仍是第 0 期', () => {
    expect(currentPeriodIndex(anchor, new Date('2026-04-09T09:00:00Z'), 'weekly', 2)).toBe(0);
  });
  it('每两周：第 15 天进入第 1 期', () => {
    expect(currentPeriodIndex(anchor, new Date('2026-04-16T09:00:00Z'), 'weekly', 2)).toBe(1);
  });
});

// ──────────────────────────────────────────────
// periodStart
// ──────────────────────────────────────────────

describe('periodStart', () => {
  const anchor = new Date(ANCHOR);
  it('第 0 期起点 = anchor', () => {
    expect(periodStart(anchor, 0, 'weekly', 1).toISOString()).toBe(ANCHOR);
  });
  it('第 3 期起点 = anchor + 21 天', () => {
    expect(periodStart(anchor, 3, 'weekly', 1).toISOString()).toBe('2026-04-22T09:00:00.000Z');
  });
});

// ──────────────────────────────────────────────
// reconcileRecurrences
// ──────────────────────────────────────────────

describe('reconcileRecurrences', () => {
  it('无定义 → 空计划', () => {
    expect(reconcileRecurrences([], [], FIXED_NOW)).toEqual({ toCreate: [], toDelete: [] });
  });

  it('有定义无实例 → 生成当前期（k=3，expectAt=本期起点，字段复制自定义）', () => {
    const plan = reconcileRecurrences([def({ id: 'r1', text: '交房租', place: 'home' })], [], FIXED_NOW);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]).toMatchObject({
      recurrenceId: 'r1',
      periodIndex: 3,
      text: '交房租',
      place: 'home',
      expectAt: '2026-04-22T09:00:00.000Z',
    });
  });

  it('当前期已有实例 → 不再生成、不删', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r1' })],
      [inst({ id: 't-cur', recurrenceId: 'r1', periodIndex: 3 })],
      FIXED_NOW,
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it('过期未完成实例 → 删除，并补当前期', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r1' })],
      [inst({ id: 't-old', recurrenceId: 'r1', periodIndex: 2, status: 'pending' })],
      FIXED_NOW,
    );
    expect(plan.toCreate.map((c) => c.periodIndex)).toEqual([3]);
    expect(plan.toDelete).toEqual(['t-old']);
  });

  it('过期已完成实例 → 保留（历史），仍补当前期', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r1' })],
      [inst({ id: 't-done', recurrenceId: 'r1', periodIndex: 2, status: 'done' })],
      FIXED_NOW,
    );
    expect(plan.toCreate.map((c) => c.periodIndex)).toEqual([3]);
    expect(plan.toDelete).toEqual([]);
  });

  it('跳过多期：只生成当前期，删掉所有过期未完成', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r1' })],
      [inst({ id: 't0', recurrenceId: 'r1', periodIndex: 0 }), inst({ id: 't1', recurrenceId: 'r1', periodIndex: 1 })],
      FIXED_NOW,
    );
    expect(plan.toCreate.map((c) => c.periodIndex)).toEqual([3]);
    expect(plan.toDelete.sort()).toEqual(['t0', 't1']);
  });

  it('未来锚点 → 不生成不删', () => {
    const plan = reconcileRecurrences([def({ id: 'r1', anchorAt: '2026-05-01T09:00:00Z' })], [], FIXED_NOW);
    expect(plan).toEqual({ toCreate: [], toDelete: [] });
  });

  it('每两周：当前期 k=1，删第 0 期未完成', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r1', interval: 2 })],
      [inst({ id: 't0', recurrenceId: 'r1', periodIndex: 0 })],
      FIXED_NOW,
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]).toMatchObject({ periodIndex: 1, expectAt: '2026-04-15T09:00:00.000Z' });
    expect(plan.toDelete).toEqual(['t0']);
  });

  it('多定义互不干扰：A 缺当前期 → 建；B 已有当前期 → 不动', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'rA' }), def({ id: 'rB' })],
      [inst({ id: 'tB', recurrenceId: 'rB', periodIndex: 3 })],
      FIXED_NOW,
    );
    expect(plan.toCreate.map((c) => c.recurrenceId)).toEqual(['rA']);
    expect(plan.toDelete).toEqual([]);
  });

  it('当前期未完成实例 → 永不删', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r1' })],
      [inst({ id: 't-cur', recurrenceId: 'r1', periodIndex: 3, status: 'pending' })],
      FIXED_NOW,
    );
    expect(plan.toDelete).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// 每天 daily
// ──────────────────────────────────────────────

describe('每天 daily', () => {
  it('当前期 k=21（距锚点 21 天），expectAt=当日锚点时刻', () => {
    const plan = reconcileRecurrences([def({ id: 'r', freq: 'daily' })], [], FIXED_NOW);
    expect(plan.toCreate[0]).toMatchObject({ periodIndex: 21, expectAt: '2026-04-22T09:00:00.000Z' });
  });
});

// ──────────────────────────────────────────────
// 每月 monthly（按本地日历，需 tzOffset）
// ──────────────────────────────────────────────

describe('每月 monthly', () => {
  const anchor = new Date(ANCHOR); // 4/1 09:00Z

  it('同月 → k=0；跨两月 → k=2', () => {
    expect(currentPeriodIndex(anchor, new Date('2026-04-22T00:00:00Z'), 'monthly', 1, 0)).toBe(0);
    expect(currentPeriodIndex(anchor, new Date('2026-06-15T00:00:00Z'), 'monthly', 1, 0)).toBe(2);
  });

  it('号数未到当月锚点日 → 仍算上一期', () => {
    // 锚点 15 号，6/10 还没到 6/15 → 当前期是 5/15（Apr→May→…，k=1）
    const a = new Date('2026-04-15T09:00:00Z');
    expect(currentPeriodIndex(a, new Date('2026-06-10T00:00:00Z'), 'monthly', 1, 0)).toBe(1);
  });

  it('月末号数夹取：1/31 的下一期 = 2/28', () => {
    expect(periodStart(new Date('2026-01-31T09:00:00Z'), 1, 'monthly', 1, 0).toISOString()).toBe(
      '2026-02-28T09:00:00.000Z',
    );
  });

  it('生成当前期并清掉上月未完成', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r', freq: 'monthly' })],
      [inst({ id: 'm1', recurrenceId: 'r', periodIndex: 1 })],
      new Date('2026-06-15T00:00:00Z'),
    );
    expect(plan.toCreate[0]).toMatchObject({ periodIndex: 2, expectAt: '2026-06-01T09:00:00.000Z' });
    expect(plan.toDelete).toEqual(['m1']);
  });

  it('按本地时区切分：UTC+8 把跨 UTC 午夜的锚点算进本地月', () => {
    // 锚点 UTC 4/30 16:30 = 本地(UTC+8) 5/1 00:30，本地归属 5 月
    const a = new Date('2026-04-30T16:30:00Z');
    // 本地 6/2：自本地 5 月起第 1 期
    expect(currentPeriodIndex(a, new Date('2026-06-02T00:00:00Z'), 'monthly', 1, -480)).toBe(1);
    // 第 0 期起点就是锚点本身
    expect(periodStart(a, 0, 'monthly', 1, -480).toISOString()).toBe('2026-04-30T16:30:00.000Z');
  });
});

// ──────────────────────────────────────────────
// 工作日 workday（周一~周五，需 tzOffset 判本地星期）
// ──────────────────────────────────────────────

describe('工作日 workday', () => {
  // 2026-04-06 是周一
  const MON = '2026-04-06T09:00:00Z';

  it('周五（第 4 期）生成', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r', freq: 'workday', anchorAt: MON })],
      [],
      new Date('2026-04-10T10:00:00Z'),
    );
    expect(plan.toCreate[0]).toMatchObject({ periodIndex: 4, expectAt: '2026-04-10T09:00:00.000Z' });
  });

  it('周六不生成，且清掉周五未完成', () => {
    const plan = reconcileRecurrences(
      [def({ id: 'r', freq: 'workday', anchorAt: MON })],
      [inst({ id: 'fri', recurrenceId: 'r', periodIndex: 4 })],
      new Date('2026-04-11T10:00:00Z'),
    );
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toDelete).toEqual(['fri']);
  });

  it('按本地时区判周末：UTC 周日但本地（UTC+8）周一应生成', () => {
    // 锚点 UTC 周日 17:00 = 本地 周一 01:00（2026-04-05 是周日）
    const anchorAt = '2026-04-05T17:00:00Z';
    const now = new Date('2026-04-05T18:00:00Z');
    const utc = reconcileRecurrences([def({ id: 'r', freq: 'workday', anchorAt, tzOffset: 0 })], [], now);
    expect(utc.toCreate).toHaveLength(0); // UTC 判周日 → 跳过
    const local = reconcileRecurrences([def({ id: 'r', freq: 'workday', anchorAt, tzOffset: -480 })], [], now);
    expect(local.toCreate).toHaveLength(1); // 本地周一 → 生成
  });
});
