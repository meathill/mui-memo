import type { TaskView } from '@mui-memo/shared/logic';
import type { TaskRow } from '@mui-memo/shared/schema';
import { describe, expect, it } from 'vitest';
import { planPersist, rowToView } from './tasks';

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

  it('tag 由有值改成空 → patch.tag = null（清空语义）', () => {
    const { updates } = planPersist('u1', [makeView({ tag: '采购' })], [makeView({ tag: null })]);
    expect(updates).toHaveLength(1);
    expect(updates[0].patch.tag).toBeNull();
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
