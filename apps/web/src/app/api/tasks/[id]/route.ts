import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import {
  attachments as attachmentsTable,
  tasks as tasksTable,
  utterances as utterancesTable,
} from "@mui-memo/shared/schema";
import type {
  TaskPlace,
  TaskStatus,
  TaskWindow,
} from "@mui-memo/shared/validators";
import { taskCoreSchema, taskStatusEnum } from "@mui-memo/shared/validators";
import { requireAuthDb } from "@/lib/route";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  const userId = ctx.session.user.id;

  const [row] = await ctx.db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const atts = await ctx.db
    .select({
      id: attachmentsTable.id,
      key: attachmentsTable.key,
      mime: attachmentsTable.mime,
      size: attachmentsTable.size,
      originalName: attachmentsTable.originalName,
      createdAt: attachmentsTable.createdAt,
    })
    .from(attachmentsTable)
    .where(
      and(eq(attachmentsTable.taskId, id), eq(attachmentsTable.userId, userId)),
    )
    .orderBy(asc(attachmentsTable.createdAt));

  return NextResponse.json({
    task: {
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
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      audioKey: row.audioKey ?? null,
    },
    attachments: atts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

const patchSchema = taskCoreSchema.partial().extend({
  status: taskStatusEnum.optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const p = parsed.data;
  // 映射 window → taskWindow 列名，过滤 undefined 字段
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (p.text !== undefined) update.text = p.text;
  if (p.place !== undefined) update.place = p.place;
  if (p.window !== undefined) update.taskWindow = p.window;
  if (p.energy !== undefined) update.energy = p.energy;
  if (p.priority !== undefined) update.priority = p.priority;
  if (p.tag !== undefined) update.tag = p.tag ?? null;
  if (p.deadline !== undefined) update.deadline = p.deadline ?? null;
  if (p.expectAt !== undefined)
    update.expectAt = p.expectAt ? new Date(p.expectAt) : null;
  if (p.dueAt !== undefined) update.dueAt = p.dueAt ? new Date(p.dueAt) : null;
  if (p.status !== undefined) {
    update.status = p.status;
    if (p.status === "done") update.completedAt = new Date();
    if (p.status === "pending" || p.status === "doing")
      update.completedAt = null;
  }

  await ctx.db
    .update(tasksTable)
    .set(update)
    .where(
      and(eq(tasksTable.id, id), eq(tasksTable.userId, ctx.session.user.id)),
    );

  return NextResponse.json({ ok: true });
}

/**
 * 删除任务：级联删附件（DB + R2）、置空 utterance.task_id、删任务本体与语音音频。
 * 幂等：找不到也返回 ok。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const { id } = await params;
  const userId = ctx.session.user.id;

  const [task] = await ctx.db
    .select({ id: tasksTable.id, audioKey: tasksTable.audioKey })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)))
    .limit(1);

  if (!task) return NextResponse.json({ ok: true });

  const atts = await ctx.db
    .select({ id: attachmentsTable.id, key: attachmentsTable.key })
    .from(attachmentsTable)
    .where(
      and(eq(attachmentsTable.taskId, id), eq(attachmentsTable.userId, userId)),
    );

  await ctx.db
    .delete(attachmentsTable)
    .where(
      and(eq(attachmentsTable.taskId, id), eq(attachmentsTable.userId, userId)),
    );

  // utterance 记录保留（用户的语音历史），只把 task_id 置空避免悬挂指针
  await ctx.db
    .update(utterancesTable)
    .set({ taskId: null })
    .where(
      and(eq(utterancesTable.taskId, id), eq(utterancesTable.userId, userId)),
    );

  await ctx.db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, userId)));

  const bucket = ctx.env.AUDIO_BUCKET;
  if (bucket) {
    const keys = atts.map((a) => a.key);
    if (task.audioKey) keys.push(task.audioKey);
    await Promise.allSettled(keys.map((k) => bucket.delete(k)));
  }

  return NextResponse.json({ ok: true });
}
