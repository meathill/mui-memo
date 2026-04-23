import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, eq } from "drizzle-orm";
import {
  attachments as attachmentsTable,
  tasks as tasksTable,
} from "@mui-memo/shared/schema";
import type {
  TaskPlace,
  TaskStatus,
  TaskWindow,
} from "@mui-memo/shared/validators";
import { taskCoreSchema, taskStatusEnum } from "@mui-memo/shared/validators";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);

  const [row] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, session.user.id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const atts = await db
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
      and(
        eq(attachmentsTable.taskId, id),
        eq(attachmentsTable.userId, session.user.id),
      ),
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
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  await db
    .update(tasksTable)
    .set(update)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
