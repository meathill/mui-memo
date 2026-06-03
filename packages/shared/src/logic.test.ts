import { describe, expect, it } from 'vitest';
import { applyActions, applyIntent, type IntentEffect, rerank, type TaskView } from './logic.js';
import type { Action, Dim, IntentKind, TaskCore, TaskStatus, Utterance } from './validators.js';

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

interface ActionPartial {
  intent: IntentKind;
  aiReason?: string;
  aiVerb?: string;
  task?: Partial<TaskCore>;
  patch?: Partial<TaskCore> & { status?: TaskStatus };
  createIfMissing?: Partial<TaskCore>;
  match?: string;
  matchId?: string;
}

function buildAction(p: ActionPartial): Action {
  const base = { aiReason: p.aiReason ?? '', aiVerb: p.aiVerb ?? '' };
  switch (p.intent) {
    case 'ADD':
      return { intent: 'ADD', ...base, task: p.task ?? { text: '' } };
    case 'STATUS':
      return {
        intent: 'STATUS',
        ...base,
        ...(p.match ? { match: p.match } : {}),
        ...(p.matchId ? { matchId: p.matchId } : {}),
        ...(p.patch ? { patch: p.patch } : {}),
      };
    case 'DONE':
      return {
        intent: 'DONE',
        ...base,
        ...(p.match ? { match: p.match } : {}),
        ...(p.matchId ? { matchId: p.matchId } : {}),
        ...(p.createIfMissing ? { createIfMissing: p.createIfMissing } : {}),
      };
    case 'MODIFY':
      return {
        intent: 'MODIFY',
        ...base,
        ...(p.match ? { match: p.match } : {}),
        ...(p.matchId ? { matchId: p.matchId } : {}),
        ...(p.patch ? { patch: p.patch } : {}),
      };
    case 'LINK':
      return {
        intent: 'LINK',
        ...base,
        ...(p.match ? { match: p.match } : {}),
        ...(p.matchId ? { matchId: p.matchId } : {}),
      };
  }
}

/** 单 action utterance 工厂，兼容老测试风格 */
function utter(partial: ActionPartial & { raw?: string; dims?: Dim[] }): Utterance {
  return {
    raw: partial.raw ?? '',
    actions: [buildAction(partial)],
    dims: partial.dims ?? [],
  };
}

/** 多 action utterance 工厂 */
function utterMulti(actions: ActionPartial[], raw = ''): Utterance {
  return { raw, actions: actions.map(buildAction), dims: [] };
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

  it('已完成的周期实例不过滤，落到 done_recurring 桶并排最后', () => {
    const tasks = [
      task({ id: '1', text: '本轮已完成', done: true, status: 'done', recurrenceId: 'r1', window: 'now' }),
      task({ id: '2', text: '普通已完成', done: true, status: 'done' }), // 非周期 → 过滤
      task({ id: '3', text: '待办', window: 'now' }),
    ];
    const ranked = rerank(tasks, 'any');
    expect(ranked.map((t) => t.id)).toEqual(['3', '1']);
    expect(ranked.find((t) => t.id === '1')?.bucket).toBe('done_recurring');
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
    expect(ranked.map((t) => t.id)).toEqual(['now', 'today_here', 'today_else', 'blocked', 'later']);
    expect(ranked.map((t) => t.bucket)).toEqual(['now', 'today_here', 'today_else', 'blocked', 'later']);
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

  it('ctxPlace=any（全部 tab）：场景不过滤，没有 today_else / blocked', () => {
    const tasks = [
      task({ id: 'home-now', text: 'a', place: 'home', window: 'now' }),
      task({ id: 'work-today', text: 'b', place: 'work', window: 'today' }),
      task({ id: 'out-now', text: 'c', place: 'out', window: 'now' }),
      task({ id: 'any-today', text: 'd', place: 'any', window: 'today' }),
    ];
    const ranked = rerank(tasks, 'any');
    expect(ranked.find((t) => t.bucket === 'today_else')).toBeUndefined();
    expect(ranked.find((t) => t.bucket === 'blocked')).toBeUndefined();
    expect(
      ranked
        .filter((t) => t.bucket === 'now')
        .map((t) => t.id)
        .sort(),
    ).toEqual(['home-now', 'out-now']);
    expect(
      ranked
        .filter((t) => t.bucket === 'today_here')
        .map((t) => t.id)
        .sort(),
    ).toEqual(['any-today', 'work-today']);
  });
});

// ──────────────────────────────────────────────
// applyIntent (单 action 兼容入口)
// ──────────────────────────────────────────────

describe('applyIntent · dueAt / expectAt', () => {
  it('ADD 时保留 AI 解析出的 dueAt', () => {
    const due = '2026-04-23T23:59:00+08:00';
    const u = utter({
      intent: 'ADD',
      raw: '明天给老妈打电话',
      aiVerb: '新增',
      task: { text: '给老妈打电话', deadline: '明天', dueAt: due },
    });
    const { tasks } = applyIntent([], u);
    expect(tasks[0].deadline).toBe('明天');
    expect(tasks[0].dueAt).toBe(due);
  });

  it('ADD 同时带 expectAt + dueAt：两个字段都透传', () => {
    const expect_ = '2026-04-24T23:59:00+08:00';
    const due = '2026-04-26T23:59:00+08:00';
    const u = utter({
      intent: 'ADD',
      raw: '明天写完，最晚这周',
      aiVerb: '新增',
      task: {
        text: '写周报',
        deadline: '明天 / 这周',
        expectAt: expect_,
        dueAt: due,
      },
    });
    const { tasks } = applyIntent([], u);
    expect(tasks[0].expectAt).toBe(expect_);
    expect(tasks[0].dueAt).toBe(due);
  });

  it('MODIFY 时 patch 里的 dueAt 写到目标任务', () => {
    const before: TaskView[] = [task({ id: 'a', text: '付物业费', deadline: '本月', dueAt: null })];
    const due = '2026-04-27T23:59:00+08:00';
    const u = utter({
      intent: 'MODIFY',
      matchId: 'a',
      aiVerb: '改时间',
      patch: { deadline: '下周一', dueAt: due },
    });
    const { tasks } = applyIntent(before, u);
    expect(tasks[0].deadline).toBe('下周一');
    expect(tasks[0].dueAt).toBe(due);
  });

  it('DONE + createIfMissing 时 dueAt 透传', () => {
    const due = '2026-04-24T15:00:00+08:00';
    const u = utter({
      intent: 'DONE',
      aiVerb: '已完成',
      createIfMissing: { text: '发货', dueAt: due },
    });
    const { tasks } = applyIntent([], u);
    expect(tasks[0].dueAt).toBe(due);
  });
});

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

  it('未提供 task.text 时降级使用 raw 作为文本', () => {
    const u = utter({ intent: 'ADD', raw: '随便记一条', task: {} });
    const { tasks } = applyIntent([], u);
    expect(tasks[0].text).toBe('随便记一条');
  });
});

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

  it('matchId 优先于 match', () => {
    const before: TaskView[] = [task({ id: 'a', text: '买水' }), task({ id: 'b', text: '打款' })];
    const u = utter({
      intent: 'STATUS',
      matchId: 'b',
      match: '水',
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

describe('applyIntent · DONE', () => {
  it('匹配时不直接勾掉，而是返回 effect 等待确认', () => {
    const before: TaskView[] = [task({ id: 'a', text: '带水' })];
    const u = utter({
      intent: 'DONE',
      matchId: 'a',
      aiVerb: '已完成',
    });
    const { tasks, effect } = applyIntent(before, u, FIXED_NOW);
    const t = tasks.find((x) => x.id === 'a')!;
    expect(t.done).toBe(false);
    expect(t.status).toBe('pending');
    expect(effect.kind).toBe('done');
  });

  it('未匹配且 createIfMissing 存在时补一条 pending 等待确认', () => {
    const u = utter({
      intent: 'DONE',
      aiVerb: '已完成',
      aiReason: '补记',
      createIfMissing: { text: '发货给 A', tag: '工作' },
    });
    const { tasks, effect } = applyIntent([], u, FIXED_NOW);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('发货给 A');
    expect(tasks[0].done).toBe(false);
    expect(tasks[0].status).toBe('pending');
    expect(effect.kind).toBe('done-backfill');
  });

  it('未匹配且无 createIfMissing 返回 miss', () => {
    const u = utter({ intent: 'DONE', match: '不存在', aiVerb: '已完成' });
    const { effect } = applyIntent([task({ id: 'a', text: 'x' })], u);
    expect(effect.kind).toBe('miss');
  });
});

describe('applyIntent · MODIFY', () => {
  it('把 patch 里的字段合并到匹配任务，effect 带 patch 和 before 快照', () => {
    const before: TaskView[] = [task({ id: 'a', text: '付物业费', window: 'today' })];
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
    if (effect.kind !== 'modify') throw new Error('expected modify');
    expect(effect.patch).toEqual({ deadline: '下周一', window: 'later' });
    expect(effect.before).toEqual({ text: '付物业费', window: 'today', deadline: undefined });
  });

  it('改 text 时 before.text 是命中前的旧文案', () => {
    const before: TaskView[] = [task({ id: 'a', text: '买水' })];
    const u = utter({ intent: 'MODIFY', matchId: 'a', aiVerb: '改描述', patch: { text: '买矿泉水' } });
    const { effect } = applyIntent(before, u);
    if (effect.kind !== 'modify') throw new Error();
    expect(effect.before.text).toBe('买水');
    expect(effect.patch.text).toBe('买矿泉水');
  });
});

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
    const step1 = applyIntent(before, utter({ intent: 'LINK', matchId: 'c1', aiVerb: '顺手做' }));
    const step2 = applyIntent(step1.tasks, utter({ intent: 'LINK', matchId: 'c2', aiVerb: '顺手做' }));
    const parent = step2.tasks.find((t) => t.id === 'doing')!;
    expect(parent.linked).toEqual([
      { id: 'c1', text: '事 A' },
      { id: 'c2', text: '事 B' },
    ]);
  });
});

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

// ──────────────────────────────────────────────
// applyActions · 多 action 串行
// ──────────────────────────────────────────────

describe('applyActions', () => {
  it('单 ADD 等价于 applyIntent（结构同形，id 各自生成）', () => {
    const u = utter({ intent: 'ADD', raw: '带水', task: { text: '带水' } });
    const multi = applyActions([], u);
    expect(multi.tasks).toHaveLength(1);
    expect(multi.tasks[0].text).toBe('带水');
    expect(multi.effects).toHaveLength(1);
    expect(multi.effects[0].kind).toBe('add');
  });

  it('两个独立 ADD 都被插到列表头部，顺序与 actions 一致', () => {
    const before: TaskView[] = [task({ id: 'old', text: '旧的' })];
    const u = utterMulti(
      [
        { intent: 'ADD', task: { text: '提供货单给高老师' }, aiVerb: '新增' },
        { intent: 'ADD', task: { text: '提供快递单号' }, aiVerb: '新增' },
      ],
      '提供货单给高老师，再提供快递单号',
    );
    const { tasks, effects } = applyActions(before, u);
    // 后一个 ADD 被 prepend，所以顺序为：[第二条, 第一条, 旧的]
    expect(tasks.map((t) => t.text)).toEqual(['提供快递单号', '提供货单给高老师', '旧的']);
    expect(effects).toHaveLength(2);
    expect(effects.every((e) => e.kind === 'add')).toBe(true);
  });

  it('ADD + LINK：LINK 命中刚 ADD 的任务 id（验证串行喂 tasks）', () => {
    const before: TaskView[] = [task({ id: 'doing', text: '去银行', status: 'doing', window: 'now' })];
    const u = utterMulti(
      [
        { intent: 'ADD', task: { text: '取快递' }, aiVerb: '新增' },
        { intent: 'LINK', match: '快递', aiVerb: '顺手做' },
      ],
      '顺便取快递',
    );
    const { tasks, effects } = applyActions(before, u);
    expect(effects[0].kind).toBe('add');
    expect(effects[1].kind).toBe('link');
    const parent = tasks.find((t) => t.id === 'doing')!;
    expect(parent.linked).toHaveLength(1);
    expect(parent.linked?.[0].text).toBe('取快递');
    const child = tasks.find((t) => t.text === '取快递')!;
    expect(child.status).toBe('linked');
  });

  it('两个 STATUS：第二个会覆盖第一个，最终只一个 doing', () => {
    const before: TaskView[] = [task({ id: 'a', text: 'A' }), task({ id: 'b', text: 'B' })];
    const u = utterMulti([
      { intent: 'STATUS', matchId: 'a', aiVerb: '开始做' },
      { intent: 'STATUS', matchId: 'b', aiVerb: '开始做' },
    ]);
    const { tasks, effects } = applyActions(before, u);
    expect(effects[0].kind).toBe('status');
    expect(effects[1].kind).toBe('status');
    expect(tasks.find((t) => t.id === 'a')?.status).toBe('pending');
    expect(tasks.find((t) => t.id === 'b')?.status).toBe('doing');
    expect(tasks.filter((t) => t.status === 'doing')).toHaveLength(1);
  });

  it('一个 MODIFY miss 不影响后续 ADD 生效', () => {
    const before: TaskView[] = [task({ id: 'a', text: '付物业费' })];
    const u = utterMulti(
      [
        { intent: 'MODIFY', match: '不存在的', aiVerb: '改时间', patch: { deadline: '明天' } },
        { intent: 'ADD', task: { text: '买菜' }, aiVerb: '新增' },
      ],
      '改时间，再买菜',
    );
    const { tasks, effects } = applyActions(before, u);
    expect(effects[0].kind).toBe('miss');
    expect(effects[1].kind).toBe('add');
    expect(tasks.find((t) => t.text === '买菜')).toBeDefined();
    // 原任务未被改
    expect(tasks.find((t) => t.id === 'a')?.deadline).toBeUndefined();
  });

  it('回归朋友的 bug：两个独立任务不会被合并成 MODIFY', () => {
    // 这个测试覆盖的是 logic 层：当 AI 正确返回两个 ADD 时，logic 不会出错。
    // 实际让 AI 返回正确 actions[] 的责任在 prompt（intent-shared.ts）。
    const before: TaskView[] = [task({ id: '1', text: '提供货单给高老师', expectAt: '2026-04-23T10:00:00+08:00' })];
    const u = utterMulti([{ intent: 'ADD', task: { text: '提供快递单号' }, aiVerb: '新增' }], '完了转需要提供快递单号');
    const { tasks, effects } = applyActions(before, u);
    expect(effects[0].kind).toBe('add');
    // 第一条任务原文不变
    expect(tasks.find((t) => t.id === '1')?.text).toBe('提供货单给高老师');
    expect(tasks.find((t) => t.text === '提供快递单号')).toBeDefined();
  });
});

// ──────────────────────────────────────────────
// IntentEffect 类型守卫示例（编译时验证）
// ──────────────────────────────────────────────

describe('IntentEffect modify 携带 patch + before', () => {
  it('modify effect 的 patch 与 before 字段类型可解构', () => {
    const before: TaskView[] = [task({ id: 'a', text: '买菜', place: 'home' })];
    const u = utter({ intent: 'MODIFY', matchId: 'a', aiVerb: '改地点', patch: { place: 'out' } });
    const { effect } = applyIntent(before, u);
    const e: IntentEffect = effect;
    if (e.kind !== 'modify') throw new Error();
    expect(e.patch.place).toBe('out');
    expect(e.before.place).toBe('home');
  });
});
