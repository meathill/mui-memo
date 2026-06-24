import type { TaskView } from '@mui-memo/shared/logic';
import type { TaskRow } from '@mui-memo/shared/schema';
import { describe, expect, it } from 'vitest';
import { collectRecentTagCandidates, mergeTagCandidates, planPersist, rowToView } from './tasks';

// 有代表性的 task 行。embedding 是 TiDB 生成列、测试不关心，用断言绕过其类型。
function makeRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 't1',
    userId: 'u1',
    rawText: '帮我记一下买牛奶',
    text: '买牛奶',
    place: 'home',
    taskWindow: 'today',
    energy: 2,
    priority: 2,
    tag: null,
    tags: null,
    deadline: null,
    expectAt: null,
    dueAt: null,
    aiReason: null,
    actionType: null,
    entities: null,
    status: 'pending',
    linkedTo: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    completedAt: null,
    audioKey: null,
    recurrenceId: null,
    periodIndex: null,
    ...overrides,
  } as unknown as TaskRow;
}

function makeView(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 't1',
    text: '买牛奶',
    place: 'home',
    window: 'today',
    energy: 2,
    priority: 2,
    status: 'pending',
    done: false,
    ...overrides,
  };
}

describe('rowToView', () => {
  it('timestamp 列转成 ISO 字符串，done 由 status 推导', () => {
    const view = rowToView(
      makeRow({
        status: 'done',
        expectAt: new Date('2026-02-01T08:00:00.000Z'),
        completedAt: new Date('2026-02-02T09:30:00.000Z'),
      }),
    );
    expect(view.expectAt).toBe('2026-02-01T08:00:00.000Z');
    expect(view.completedAt).toBe('2026-02-02T09:30:00.000Z');
    expect(view.done).toBe(true);
  });

  it('空 timestamp 列：expectAt/dueAt → null，completedAt → undefined，done=false', () => {
    const view = rowToView(makeRow());
    expect(view.expectAt).toBeNull();
    expect(view.dueAt).toBeNull();
    expect(view.completedAt).toBeUndefined();
    expect(view.done).toBe(false);
  });

  it('带上 linked 子任务', () => {
    const view = rowToView(makeRow(), [{ id: 'c1', text: '顺手买面包' }]);
    expect(view.linked).toEqual([{ id: 'c1', text: '顺手买面包' }]);
  });

  it('tags：优先用 tags 列，为空时回退旧 tag 单标签', () => {
    expect(rowToView(makeRow({ tags: ['网银', '报销'] })).tags).toEqual(['网银', '报销']);
    expect(rowToView(makeRow({ tags: null, tag: '采购' })).tags).toEqual(['采购']);
    expect(rowToView(makeRow({ tags: null, tag: null })).tags).toEqual([]);
  });
});

describe('collectRecentTagCandidates', () => {
  it('按输入顺序去重，tags 列优先于旧 tag 列', () => {
    const out = collectRecentTagCandidates([
      { tags: ['网银', '报销'], tag: '旧标签' },
      { tags: [' 网银 ', '采购'] },
      { tags: null, tag: '家务' },
    ]);
    expect(out).toEqual(['网银', '报销', '采购', '家务']);
  });

  it('丢掉空标签，并按 limit 截断', () => {
    const out = collectRecentTagCandidates([{ tags: ['', '  ', 'A'] }, { tags: ['B', 'C'] }, { tags: ['D'] }], 3);
    expect(out).toEqual(['A', 'B', 'C']);
  });

  it('默认最多返回 100 个标签', () => {
    const rows = Array.from({ length: 105 }, (_, i) => ({ tags: [`标签${i}`] }));
    const out = collectRecentTagCandidates(rows);
    expect(out).toHaveLength(100);
    expect(out.at(-1)).toBe('标签99');
  });
});

describe('mergeTagCandidates', () => {
  it('本地候选优先，远程候选补足，并去重 trim', () => {
    expect(mergeTagCandidates([' 网银 ', '采购'], ['网银', '报销'])).toEqual(['网银', '采购', '报销']);
  });

  it('最多保留 limit 个候选', () => {
    const primary = Array.from({ length: 80 }, (_, i) => `本地${i}`);
    const secondary = Array.from({ length: 80 }, (_, i) => `远程${i}`);
    const out = mergeTagCandidates(primary, secondary, 100);
    expect(out).toHaveLength(100);
    expect(out[79]).toBe('本地79');
    expect(out[80]).toBe('远程0');
    expect(out.at(-1)).toBe('远程19');
  });
});

describe('planPersist', () => {
  it('after 里 before 没有的 → inserts，时间字段转成 Date', () => {
    const after = [makeView({ id: 'new1', expectAt: '2026-03-01T10:00:00.000Z' })];
    const { inserts, updates } = planPersist('u1', [], after);
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ id: 'new1', userId: 'u1', text: '买牛奶', taskWindow: 'today' });
    expect(inserts[0].expectAt).toBeInstanceOf(Date);
    expect((inserts[0].expectAt as Date).toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('完全没变的任务既不 insert 也不 update', () => {
    const { inserts, updates } = planPersist('u1', [makeView()], [makeView()]);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('改了字段 → update，patch 只含变化项（window 映射成 taskWindow）', () => {
    const before = [makeView({ window: 'today' })];
    const after = [makeView({ window: 'now', priority: 3 })];
    const { inserts, updates } = planPersist('u1', before, after);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('t1');
    expect(updates[0].patch).toMatchObject({ taskWindow: 'now', priority: 3 });
    expect(updates[0].patch.text).toBeUndefined();
    expect(updates[0].patch.updatedAt).toBeInstanceOf(Date);
  });

  it('tags 由有值改成空 → patch.tags = []（清空语义）', () => {
    const { updates } = planPersist('u1', [makeView({ tags: ['采购'] })], [makeView({ tags: [] })]);
    expect(updates).toHaveLength(1);
    expect(updates[0].patch.tags).toEqual([]);
  });

  it('tags 增删 → patch.tags 为新数组', () => {
    const { updates } = planPersist('u1', [makeView({ tags: ['采购'] })], [makeView({ tags: ['采购', '报销'] })]);
    expect(updates[0].patch.tags).toEqual(['采购', '报销']);
  });

  it('一批里混合 新增 / 改动 / 不变', () => {
    const before = [makeView({ id: 'a', text: '旧A' }), makeView({ id: 'b', text: '不变B' })];
    const after = [
      makeView({ id: 'a', text: '新A' }),
      makeView({ id: 'b', text: '不变B' }),
      makeView({ id: 'c', text: '新增C' }),
    ];
    const { inserts, updates } = planPersist('u1', before, after);
    expect(inserts.map((r) => r.id)).toEqual(['c']);
    expect(updates.map((u) => u.id)).toEqual(['a']);
    expect(updates[0].patch).toMatchObject({ text: '新A' });
  });
});
