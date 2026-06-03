import {
  currentPeriodIndex,
  type RecurrenceDef,
  type RecurrenceInstanceLite,
  reconcileRecurrences,
} from '@mui-memo/shared/recurrence';
import {
  type NewRecurrenceRow,
  type NewTaskRow,
  recurrences as recurrencesTable,
  type RecurrenceRow,
  tasks as tasksTable,
} from '@mui-memo/shared/schema';
import type {
  CreateRecurrenceInput,
  RecurrenceFreq,
  TaskPlace,
  TaskStatus,
  TaskWindow,
  UpdateRecurrenceInput,
} from '@mui-memo/shared/validators';
import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import type { Database } from './db';

function rowToDef(r: RecurrenceRow): RecurrenceDef {
  return {
    id: r.id,
    text: r.text,
    place: r.place as TaskPlace,
    window: r.taskWindow as TaskWindow,
    energy: r.energy,
    priority: r.priority,
    tag: r.tag,
    freq: r.freq as RecurrenceFreq,
    interval: r.interval,
    anchorAt: r.anchorAt.toISOString(),
    tzOffset: r.tzOffset,
  };
}

export async function getRecurrence(db: Database, userId: string, id: string): Promise<RecurrenceRow | null> {
  const [row] = await db
    .select()
    .from(recurrencesTable)
    .where(and(eq(recurrencesTable.id, id), eq(recurrencesTable.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createRecurrence(
  db: Database,
  userId: string,
  input: CreateRecurrenceInput,
  now: Date = new Date(),
): Promise<RecurrenceRow> {
  const id = crypto.randomUUID();
  const anchorAt = input.anchorAt ? new Date(input.anchorAt) : now;
  const row: NewRecurrenceRow = {
    id,
    userId,
    text: input.text,
    place: input.place,
    taskWindow: input.window,
    energy: input.energy,
    priority: input.priority,
    tag: input.tag ?? null,
    freq: input.freq,
    interval: input.interval,
    anchorAt,
    tzOffset: input.tzOffset,
  };
  await db.insert(recurrencesTable).values(row);

  // 把现有任务挂成首期实例，避免 reconcile 再生成一条重复的。
  // 锚点在未来时（预期时间预设都是将来），currentPeriodIndex 为 null，按第 0 期挂——
  // 用户正编辑的这条就是即将到来的首期，这样重开编辑页「重复」开关状态也不丢。
  if (input.linkTaskId) {
    const k = currentPeriodIndex(anchorAt, now, input.freq, input.interval, input.tzOffset) ?? 0;
    await db
      .update(tasksTable)
      .set({ recurrenceId: id, periodIndex: k, updatedAt: new Date() })
      .where(and(eq(tasksTable.id, input.linkTaskId), eq(tasksTable.userId, userId)));
  }

  const [created] = await db.select().from(recurrencesTable).where(eq(recurrencesTable.id, id)).limit(1);
  return created;
}

export async function updateRecurrence(
  db: Database,
  userId: string,
  id: string,
  patch: UpdateRecurrenceInput,
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.text !== undefined) update.text = patch.text;
  if (patch.place !== undefined) update.place = patch.place;
  if (patch.window !== undefined) update.taskWindow = patch.window;
  if (patch.energy !== undefined) update.energy = patch.energy;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.tag !== undefined) update.tag = patch.tag ?? null;
  if (patch.freq !== undefined) update.freq = patch.freq;
  if (patch.interval !== undefined) update.interval = patch.interval;
  if (patch.anchorAt !== undefined) update.anchorAt = new Date(patch.anchorAt);
  if (patch.tzOffset !== undefined) update.tzOffset = patch.tzOffset;
  await db
    .update(recurrencesTable)
    .set(update)
    .where(and(eq(recurrencesTable.id, id), eq(recurrencesTable.userId, userId)));
}

/**
 * 删除定义；把它名下未完成实例 unlink 成普通一次性任务（保留用户正在看的这条），
 * done 实例保留作历史。过期未完成的清理交给 reconcile。
 */
export async function deleteRecurrence(db: Database, userId: string, id: string): Promise<void> {
  await db
    .update(tasksTable)
    .set({ recurrenceId: null, periodIndex: null, updatedAt: new Date() })
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.recurrenceId, id), ne(tasksTable.status, 'done')));
  await db.delete(recurrencesTable).where(and(eq(recurrencesTable.id, id), eq(recurrencesTable.userId, userId)));
}

/**
 * 对账：生成本期缺失实例 + 删除过期未完成实例。lazy-on-fetch，幂等。
 * 不用事务：唯一索引兜重复、每次 fetch 都会再对账，部分失败下次自愈。
 */
export async function applyRecurrenceReconcile(db: Database, userId: string, now: Date = new Date()): Promise<void> {
  const defRows = await db.select().from(recurrencesTable).where(eq(recurrencesTable.userId, userId));
  if (defRows.length === 0) return;

  const instRows = await db
    .select({
      id: tasksTable.id,
      recurrenceId: tasksTable.recurrenceId,
      periodIndex: tasksTable.periodIndex,
      status: tasksTable.status,
    })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), isNotNull(tasksTable.recurrenceId)));

  const instances: RecurrenceInstanceLite[] = [];
  for (const r of instRows) {
    if (r.recurrenceId === null || r.periodIndex === null) continue;
    instances.push({
      id: r.id,
      recurrenceId: r.recurrenceId,
      periodIndex: r.periodIndex,
      status: r.status as TaskStatus,
    });
  }

  const { toCreate, toDelete } = reconcileRecurrences(defRows.map(rowToDef), instances, now);

  for (const spec of toCreate) {
    const row: NewTaskRow = {
      id: crypto.randomUUID(),
      userId,
      rawText: spec.text,
      text: spec.text,
      place: spec.place,
      taskWindow: spec.window,
      energy: spec.energy,
      priority: spec.priority,
      tag: spec.tag ?? null,
      status: 'pending',
      expectAt: new Date(spec.expectAt),
      recurrenceId: spec.recurrenceId,
      periodIndex: spec.periodIndex,
    };
    try {
      await db.insert(tasksTable).values(row);
    } catch {
      // 唯一键冲突（并发 fetch 已建）或个别失败都不阻塞主列表；下次 fetch 再对账自愈
    }
  }

  if (toDelete.length > 0) {
    await db
      .delete(tasksTable)
      .where(and(eq(tasksTable.userId, userId), inArray(tasksTable.id, toDelete), ne(tasksTable.status, 'done')));
  }
}
