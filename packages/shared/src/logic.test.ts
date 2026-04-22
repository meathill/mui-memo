import { describe, expect, it } from 'vitest';
import { applyIntent, rerank, type TaskView } from './logic.js';
import type { Utterance } from './validators.js';

// ──────────────────────────────────────────────
// 测试夹具
// ──────────────────────────────────────────────

function task(partial: Partial<TaskView> & { id: string; text: string }): TaskView {
  return {
    place: 'any',
    window: 'today',
    energy: 2,
    priority: 2,
    status: 'pending',
    done: false,
    ...partial,
  };
}

function utter(partial: Partial<Utterance> & Pick<Utterance, 'intent'>): Utterance {
  return {
    raw: '',
    aiReason: '',
    aiVerb: '',
    dims: [],
    ...partial,
  };
}

const FIXED_NOW = new Date('2026-04-22T14:05:00Z');

// ──────────────────────────────────────────────
// rerank
// ──────────────────────────────────────────────

describe('rerank', () => {
  it('过滤掉 done 和 linked 状态', () => {
    const tasks = [
      task({ id: '1', text: 'a', done: true, status: 'done' }),
      task({ id: '2', text: 'b', status: 'linked', linkedTo: 'x' }),
      task({ id: '3', text: 'c' }),
    ];
    const ranked = rerank(tasks, 'home');
    expect(ranked.map((t) => t.id)).toEqual(['3']);
  });

  it('doing 任务永远在最前面', () => {
    const tasks = [
      task({ id: '1', text: '买水', window: 'now', priority: 3 }),
      task({ id: '2', text: '打款', status: 'doing', window: 'today', priority: 1 }),
    ];
    const ranked = rerank(tasks, 'any');
    expect(ranked[0].id).toBe('2');
    expect(ranked[0].bucket).toBe('doing');
  });

  it('now+可做 优先于 today_here 优先于 today_else 优先于 blocked 优先于 later', () => {
    const tasks = [
      task({ id: 'later', text: 'z', window: 'later' }),
      task({ id: 'blocked', text: 'y', window: 'now', place: 'work' }),
      task({ id: 'today_else', text: 'x', window: 'today', place: 'work' }),
      task({ id: 'today_here', text: 'w', window: 'today', place: 'home' }),
      task({ id: 'now', text: 'v', window: 'now', place: 'home' }),
    ];
    const ranked = rerank(tasks, 'home');
    expect(ranked.map((t) => t.id)).toEqual([
      'now',
      'today_here',
      'today_else',
      'blocked',
      'later',
    ]);
    expect(ranked.map((t) => t.bucket)).toEqual([
      'now',
      'today_here',
      'today_else',
      'blocked',
      'later',
    ]);
  });

  it('同一桶内按 priority 降序', () => {
    const tasks = [
      task({ id: 'low', text: 'a', window: 'now', priority: 1 }),
      task({ id: 'high', text: 'b', window: 'now', priority: 3 }),
      task({ id: 'mid', text: 'c', window: 'now', priority: 2 }),
    ];
    const ranked = rerank(tasks, 'home');
    expect(ranked.map((t) => t.id)).toEqual(['high', 'mid', 'low']);
  });

  it('place=any 的任务在任何场景都可做', () => {
    const t = task({ id: '1', text: '打电话', place: 'any', window: 'now' });
    expect(rerank([t], 'home')[0].bucket).toBe('now');
    expect(rerank([t], 'work')[0].bucket).toBe('now');
    expect(rerank([t], 'out')[0].bucket).toBe('now');
  });
});

// ──────────────────────────────────────────────
// applyIntent - ADD
// ──────────────────────────────────────────────

describe('applyIntent · ADD', () => {
  it('新建任务放在列表头部，effect.kind=add', () => {
    const before: TaskView[] = [task({ id: 'old', text: '旧任务' })];
    const u = utter({
      intent: 'ADD',
      raw: '晚上下班带点水',
      aiVerb: '新增',
      aiReason: '下班路上顺路',
      task: { text: '带水', place: 'out', window: 'today', tag: '采购' },
    });
    const { tasks, effect } = applyIntent(before, u, FIXED_NOW);
    expect(tasks[0].text).toBe('带水');
    expect(tasks[0].place).toBe('out');
    expect(tasks[0].tag).toBe('采购');
    expect(tasks[0].aiReason).toBe('下班路上顺路');
    expect(tasks[0].status).toBe('pending');
    expect(tasks).toHaveLength(2);
    expect(effect).toMatchObject({ kind: 'add', text: '带水', verb: '新增' });
  });

  it('未提供 task 时降级使用 raw 作为文本', () => {
    const u = utter({ intent: 'ADD', raw: '随便记一条' });
    const { tasks } = applyIntent([], u);
    expect(tasks[0].text).toBe('随便记一条');
  });
});

// ──────────────────────────────────────────────
// applyIntent - STATUS
// ──────────────────────────────────────────────

describe('applyIntent · STATUS', () => {
  it('通过 matchId 精确切换到 doing，其他 doing 降级为 pending', () => {
    const before: TaskView[] = [
      task({ id: 'a', text: '招行转账' }),
      task({ id: 'b', text: '另一件', status: 'doing', window: 'now' }),
    ];
    const u = utter({
      intent: 'STATUS',
      matchId: 'a',
      aiVerb: '开始做',
    });
    const { tasks, effect } = applyIntent(before, u);
    expect(tasks.find((t) => t.id === 'a')?.status).toBe('doing');
    expect(tasks.find((t) => t.id === 'a')?.window).toBe('now');
    expect(tasks.find((t) => t.id === 'b')?.status).toBe('pending');
    expect(effect.kind).toBe('status');
  });

  it('matchId 优先于 match（即使正则更像别的任务也选 matchId）', () => {
    const before: TaskView[] = [
      task({ id: 'a', text: '买水' }),
      task({ id: 'b', text: '打款' }),
    ];
    const u = utter({
      intent: 'STATUS',
      matchId: 'b',
      match: '水', // 这个正则如果生效就会指向 a
      aiVerb: '开始做',
    });
    const { tasks } = applyIntent(before, u);
    expect(tasks.find((t) => t.id === 'b')?.status).toBe('doing');
    expect(tasks.find((t) => t.id === 'a')?.status).toBe('pending');
  });

  it('matchId 失效时回退到正则匹配', () => {
    const before: TaskView[] = [task({ id: 'a', text: '招行转账 5:00 前' })];
    const u = utter({
      intent: 'STATUS',
      matchId: 'nonexistent',
      match: '招行',
      aiVerb: '开始做',
    });
    const { tasks, effect } = applyIntent(before, u);
    expect(tasks[0].status).toBe('doing');
    expect(effect.kind).toBe('status');
  });

  it('既没 matchId 也没匹配时返回 miss', () => {
    const u = utter({ intent: 'STATUS', match: '不存在', aiVerb: '开始做' });
    const { tasks, effect } = applyIntent([task({ id: 'a', text: '招行' })], u);
    expect(tasks[0].status).toBe('pending');
    expect(effect).toEqual({ kind: 'miss', verb: '开始做' });
  });

  it('非法正则不会抛错，视为未匹配', () => {
    const u = utter({ intent: 'STATUS', match: '[invalid(', aiVerb: '开始做' });
    const { effect } = applyIntent([task({ id: 'a', text: 'x' })], u);
    expect(effect.kind).toBe('miss');
  });
});

// ──────────────────────────────────────────────
// applyIntent - DONE
// ──────────────────────────────────────────────

describe('applyIntent · DONE', () => {
  it('匹配时勾掉对应任务并打时间戳', () => {
    const before: TaskView[] = [task({ id: 'a', text: '带水' })];
    const u = utter({
      intent: 'DONE',
      matchId: 'a',
      aiVerb: '已完成',
    });
    const { tasks, effect } = applyIntent(before, u, FIXED_NOW);
    const t = tasks.find((x) => x.id === 'a')!;
    expect(t.done).toBe(true);
    expect(t.status).toBe('done');
    // completedAt 是 ISO 字符串
    expect(t.completedAt).toBe(FIXED_NOW.toISOString());
    expect(effect.kind).toBe('done');
  });

  it('未匹配且 createIfMissing 存在时补记一条已完成任务', () => {
    const u = utter({
      intent: 'DONE',
      aiVerb: '已完成',
      aiReason: '补记',
      createIfMissing: { text: '发货给 A', tag: '工作' },
    });
    const { tasks, effect } = applyIntent([], u, FIXED_NOW);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('发货给 A');
    expect(tasks[0].done).toBe(true);
    expect(tasks[0].status).toBe('done');
    expect(effect.kind).toBe('done-backfill');
  });

  it('未匹配且无 createIfMissing 返回 miss', () => {
    const u = utter({ intent: 'DONE', match: '不存在', aiVerb: '已完成' });
    const { effect } = applyIntent([task({ id: 'a', text: 'x' })], u);
    expect(effect.kind).toBe('miss');
  });
});

// ──────────────────────────────────────────────
// applyIntent - MODIFY
// ──────────────────────────────────────────────

describe('applyIntent · MODIFY', () => {
  it('把 patch 里的字段合并到匹配任务', () => {
    const before: TaskView[] = [
      task({ id: 'a', text: '付物业费', window: 'today' }),
    ];
    const u = utter({
      intent: 'MODIFY',
      matchId: 'a',
      aiVerb: '改时间',
      patch: { deadline: '下周一', window: 'later' },
    });
    const { tasks, effect } = applyIntent(before, u);
    expect(tasks[0].deadline).toBe('下周一');
    expect(tasks[0].window).toBe('later');
    expect(effect.kind).toBe('modify');
  });
});

// ──────────────────────────────────────────────
// applyIntent - LINK
// ──────────────────────────────────────────────

describe('applyIntent · LINK', () => {
  it('把匹配任务挂到当前 doing 下并改为 linked', () => {
    const before: TaskView[] = [
      task({ id: 'doing', text: '去银行转账', status: 'doing', window: 'now' }),
      task({ id: 'child', text: '付物业费' }),
    ];
    const u = utter({
      intent: 'LINK',
      matchId: 'child',
      aiVerb: '顺手做',
    });
    const { tasks, effect } = applyIntent(before, u);
    const parent = tasks.find((t) => t.id === 'doing')!;
    const child = tasks.find((t) => t.id === 'child')!;
    expect(child.status).toBe('linked');
    expect(child.linkedTo).toBe('doing');
    expect(parent.linked).toEqual([{ id: 'child', text: '付物业费' }]);
    expect(effect).toMatchObject({ kind: 'link', host: '去银行转账' });
  });

  it('没有 doing 任务时返回 miss', () => {
    const before: TaskView[] = [task({ id: 'a', text: '付物业费' })];
    const u = utter({ intent: 'LINK', matchId: 'a', aiVerb: '顺手做' });
    const { effect } = applyIntent(before, u);
    expect(effect.kind).toBe('miss');
  });

  it('多次 LINK 会累加 linked 列表', () => {
    const before: TaskView[] = [
      task({ id: 'doing', text: '去银行', status: 'doing', window: 'now' }),
      task({ id: 'c1', text: '事 A' }),
      task({ id: 'c2', text: '事 B' }),
    ];
    const step1 = applyIntent(
      before,
      utter({ intent: 'LINK', matchId: 'c1', aiVerb: '顺手做' }),
    );
    const step2 = applyIntent(
      step1.tasks,
      utter({ intent: 'LINK', matchId: 'c2', aiVerb: '顺手做' }),
    );
    const parent = step2.tasks.find((t) => t.id === 'doing')!;
    expect(parent.linked).toEqual([
      { id: 'c1', text: '事 A' },
      { id: 'c2', text: '事 B' },
    ]);
  });
});

// ──────────────────────────────────────────────
// 不变性
// ──────────────────────────────────────────────

describe('applyIntent · 不变性', () => {
  it('不修改传入的 tasks 数组和元素', () => {
    const orig = [task({ id: 'a', text: 'x' })];
    const snapshot = JSON.parse(JSON.stringify(orig));
    applyIntent(
      orig,
      utter({
        intent: 'ADD',
        raw: 'new',
        task: { text: '新事' },
        aiVerb: '新增',
      }),
    );
    expect(orig).toEqual(snapshot);
  });
});
