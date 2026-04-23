import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  tasks as tasksTable,
  utterances as utterancesTable,
  type NewTaskRow,
  type NewUtteranceRow,
  type TaskRow,
} from "@mui-memo/shared/schema";
import type { IntentEffect } from "@mui-memo/shared/logic";
import type { Utterance } from "@mui-memo/shared/validators";
import type { Embedder } from "./embedding";
import type { TaskView } from "@mui-memo/shared/logic";
import type {
  TaskPlace,
  TaskStatus,
  TaskWindow,
} from "@mui-memo/shared/validators";
import type { Database } from "./db";

type NullableField<T> = T | null | undefined;

function rowToView(
  row: TaskRow,
  linkedChildren: Array<{ id: string; text: string }> = [],
): TaskView {
  return {
    id: row.id,
    text: row.text,
    rawText: row.rawText,
    place: row.place as TaskPlace,
    window: row.taskWindow as TaskWindow,
    energy: row.energy,
    priority: row.priority,
    tag: row.tag,
    deadline: row.deadline,
    expectAt: row.expectAt ? row.expectAt.toISOString() : null,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    aiReason: row.aiReason,
    status: row.status as TaskStatus,
    linkedTo: row.linkedTo,
    linked: linkedChildren,
    done: row.status === "done",
    completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
    audioKey: row.audioKey,
  };
}

/**
 * 把一个已经写入 R2 的音频 key 关联到任务行（ADD / DONE-backfill 路径用）。
 */
export async function linkAudioKey(
  db: Database,
  userId: string,
  taskId: string,
  audioKey: string,
): Promise<void> {
  await db
    .update(tasksTable)
    .set({ audioKey, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)));
}

export async function listTasksForUser(
  db: Database,
  userId: string,
): Promise<TaskView[]> {
  const rows = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId))
    .orderBy(desc(tasksTable.createdAt));

  const byId = new Map<string, TaskRow>();
  const linkedMap = new Map<string, Array<{ id: string; text: string }>>();
  for (const r of rows) byId.set(r.id, r);
  for (const r of rows) {
    if (r.status === "linked" && r.linkedTo) {
      const arr = linkedMap.get(r.linkedTo) ?? [];
      arr.push({ id: r.id, text: r.text });
      linkedMap.set(r.linkedTo, arr);
    }
  }
  return rows.map((r) => rowToView(r, linkedMap.get(r.id) ?? []));
}

interface ViewPatch {
  text?: string;
  rawText?: string;
  place?: NullableField<TaskPlace>;
  window?: NullableField<TaskWindow>;
  energy?: NullableField<number>;
  priority?: NullableField<number>;
  tag?: NullableField<string>;
  deadline?: NullableField<string>;
  expectAt?: NullableField<Date>;
  dueAt?: NullableField<Date>;
  aiReason?: NullableField<string>;
  status?: NullableField<TaskStatus>;
  linkedTo?: NullableField<string>;
  completedAt?: NullableField<Date>;
}

function viewPatchToRow(patch: ViewPatch): Partial<NewTaskRow> {
  const out: Partial<NewTaskRow> = {};
  if (patch.text !== undefined) out.text = patch.text;
  if (patch.rawText !== undefined) out.rawText = patch.rawText;
  if (patch.place !== undefined && patch.place !== null)
    out.place = patch.place;
  if (patch.window !== undefined && patch.window !== null)
    out.taskWindow = patch.window;
  if (patch.energy !== undefined && patch.energy !== null)
    out.energy = patch.energy;
  if (patch.priority !== undefined && patch.priority !== null)
    out.priority = patch.priority;
  if (patch.tag !== undefined) out.tag = patch.tag ?? null;
  if (patch.deadline !== undefined) out.deadline = patch.deadline ?? null;
  if (patch.expectAt !== undefined) out.expectAt = patch.expectAt ?? null;
  if (patch.dueAt !== undefined) out.dueAt = patch.dueAt ?? null;
  if (patch.aiReason !== undefined) out.aiReason = patch.aiReason ?? null;
  if (patch.status !== undefined && patch.status !== null)
    out.status = patch.status;
  if (patch.linkedTo !== undefined) out.linkedTo = patch.linkedTo ?? null;
  if (patch.completedAt !== undefined)
    out.completedAt = patch.completedAt ?? null;
  out.updatedAt = new Date();
  return out;
}

/**
 * 将 applyIntent 后的内存视图 diff 回数据库。
 * 没有复杂的 diff 算法——只做四种事：新建、status/completed 变化、link/unlink、字段 patch。
 */
export async function persistIntentResult(
  db: Database,
  userId: string,
  before: TaskView[],
  after: TaskView[],
  embedder?: Embedder,
): Promise<void> {
  const beforeMap = new Map(before.map((t) => [t.id, t]));
  const afterMap = new Map(after.map((t) => [t.id, t]));

  const inserts: NewTaskRow[] = [];
  const updates: Array<{ id: string; patch: Partial<NewTaskRow> }> = [];

  for (const a of after) {
    const b = beforeMap.get(a.id);
    if (!b) {
      let embedding: number[] | null = null;
      if (embedder) {
        try {
          embedding = await embedder(a.text);
        } catch {
          embedding = null;
        }
      }
      inserts.push({
        id: a.id,
        userId,
        rawText: a.rawText ?? a.text,
        text: a.text,
        place: a.place,
        taskWindow: a.window,
        energy: a.energy,
        priority: a.priority,
        tag: a.tag ?? null,
        deadline: a.deadline ?? null,
        expectAt: a.expectAt ? new Date(a.expectAt) : null,
        dueAt: a.dueAt ? new Date(a.dueAt) : null,
        aiReason: a.aiReason ?? null,
        status: a.status,
        linkedTo: a.linkedTo ?? null,
        completedAt: a.completedAt ? new Date(a.completedAt) : null,
        embedding,
      });
      continue;
    }
    const diff: ViewPatch = {};
    if (b.text !== a.text) diff.text = a.text;
    if (b.place !== a.place) diff.place = a.place;
    if (b.window !== a.window) diff.window = a.window;
    if (b.energy !== a.energy) diff.energy = a.energy;
    if (b.priority !== a.priority) diff.priority = a.priority;
    if ((b.tag ?? null) !== (a.tag ?? null)) diff.tag = a.tag ?? null;
    if ((b.deadline ?? null) !== (a.deadline ?? null))
      diff.deadline = a.deadline ?? null;
    if ((b.expectAt ?? null) !== (a.expectAt ?? null)) {
      diff.expectAt = a.expectAt ? new Date(a.expectAt) : null;
    }
    if ((b.dueAt ?? null) !== (a.dueAt ?? null)) {
      diff.dueAt = a.dueAt ? new Date(a.dueAt) : null;
    }
    if ((b.aiReason ?? null) !== (a.aiReason ?? null))
      diff.aiReason = a.aiReason ?? null;
    if (b.status !== a.status) diff.status = a.status;
    if ((b.linkedTo ?? null) !== (a.linkedTo ?? null))
      diff.linkedTo = a.linkedTo ?? null;
    if ((b.completedAt ?? null) !== (a.completedAt ?? null)) {
      diff.completedAt = a.completedAt ? new Date(a.completedAt) : null;
    }
    if (Object.keys(diff).length > 0) {
      const patchRow = viewPatchToRow(diff);
      // text 变了，重算 embedding
      if (diff.text && embedder) {
        try {
          patchRow.embedding = await embedder(a.text);
        } catch {}
      }
      updates.push({ id: a.id, patch: patchRow });
    }
  }

  if (inserts.length) {
    await db.insert(tasksTable).values(inserts);
  }
  for (const u of updates) {
    await db
      .update(tasksTable)
      .set(u.patch)
      .where(and(eq(tasksTable.id, u.id), eq(tasksTable.userId, userId)));
  }
}

/**
 * 机会性补齐：取最多 N 条 embedding 为 NULL 的任务，并行生成并写入。
 * 调用方会把它挂在 ctx.waitUntil 里；Worker 对 waitUntil 时间有上限，
 * 串行跑 8 次 Gemini 容易被砍，所以限制到 4 条 + Promise.allSettled。
 */
export async function backfillEmbeddings(
  db: Database,
  userId: string,
  embedder: Embedder,
  limit = 4,
): Promise<void> {
  const rows = await db
    .select({ id: tasksTable.id, text: tasksTable.text })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), isNull(tasksTable.embedding)))
    .limit(limit);

  await Promise.allSettled(
    rows.map(async (r) => {
      try {
        const emb = await embedder(r.text);
        await db
          .update(tasksTable)
          .set({ embedding: emb, updatedAt: new Date() })
          .where(and(eq(tasksTable.id, r.id), eq(tasksTable.userId, userId)));
      } catch {
        // swallow
      }
    }),
  );
}

/**
 * 写一条 utterance 记录，供「我的 · 输入记录」页回看。
 * effect 里能拿到的 task id / verb / reason 都摊平进去；
 * dims 直接塞 JSON 保全调试信息。
 */
export async function logUtterance(
  db: Database,
  userId: string,
  utterance: Utterance,
  effect: IntentEffect,
  audioKey: string | null,
): Promise<void> {
  const taskId =
    effect.kind === "miss" ? null : ((effect as { id?: string }).id ?? null);
  const row: NewUtteranceRow = {
    id: crypto.randomUUID(),
    userId,
    rawText: utterance.raw,
    intent: utterance.intent,
    effectKind: effect.kind,
    verb: effect.verb ?? null,
    reason:
      effect.kind === "miss"
        ? null
        : ((effect as { reason?: string }).reason ?? null),
    taskId,
    audioKey,
    dims: utterance.dims,
  };
  await db.insert(utterancesTable).values(row);
}

export async function markTaskDone(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .update(tasksTable)
    .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)));
}

export async function markBatchDone(
  db: Database,
  userId: string,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  await db
    .update(tasksTable)
    .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(tasksTable.id, ids), eq(tasksTable.userId, userId)));
}
