import { rerank } from '@mui-memo/shared/logic';
import { tasks as tasksTable } from '@mui-memo/shared/schema';
import { intentConfirmSchema, taskPlaceEnum } from '@mui-memo/shared/validators';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireAuthDb } from '@/lib/route';
import { listTasksForUser, markTaskDone } from '@/lib/tasks';

/**
 * 用户在确认弹窗中决定后调用：MODIFY 落库 / MODIFY 改为新增 / DONE 完成。
 * 「取消」分支不调本接口（前端本来就没改 DB）。
 */
export async function POST(req: Request) {
  const [resp, rc] = await requireAuthDb();
  if (resp) return resp;
  const { db, session } = rc;
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = intentConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', detail: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.kind === 'modify') {
    const patch = input.patch;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.text !== undefined) set.text = patch.text;
    if (patch.place !== undefined) set.place = patch.place;
    if (patch.window !== undefined) set.taskWindow = patch.window;
    if (patch.energy !== undefined) set.energy = patch.energy;
    if (patch.priority !== undefined) set.priority = patch.priority;
    if (patch.tags !== undefined) set.tags = patch.tags;
    if (patch.deadline !== undefined) set.deadline = patch.deadline ?? null;
    if (patch.expectAt !== undefined) set.expectAt = patch.expectAt ? new Date(patch.expectAt) : null;
    if (patch.dueAt !== undefined) set.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
    if (patch.status !== undefined) set.status = patch.status;
    await db
      .update(tasksTable)
      .set(set)
      .where(and(eq(tasksTable.id, input.taskId), eq(tasksTable.userId, userId)));
  } else if (input.kind === 'modify-as-add') {
    const t = input.task;
    const text = t.text ?? input.rawText;
    await db.insert(tasksTable).values({
      id: crypto.randomUUID(),
      userId,
      rawText: input.rawText,
      text,
      place: t.place ?? 'any',
      taskWindow: t.window ?? 'today',
      energy: t.energy ?? 2,
      priority: t.priority ?? 2,
      tags: t.tags ?? [],
      deadline: t.deadline ?? null,
      expectAt: t.expectAt ? new Date(t.expectAt) : null,
      dueAt: t.dueAt ? new Date(t.dueAt) : null,
      aiReason: input.aiReason ?? null,
      status: 'pending',
    });
  } else if (input.kind === 'done') {
    await markTaskDone(db, userId, input.taskId);
  }

  // 重新读取并回吐当前任务列表，前端 hydrate
  const tasks = await listTasksForUser(db, userId);
  // 没传 place 就用 'any'，前端只用得到 tasks，ranked 取一个稳妥默认即可
  const ctxPlaceParam = new URL(req.url).searchParams.get('place') ?? 'any';
  const placeParsed = taskPlaceEnum.safeParse(ctxPlaceParam);
  const ranked = rerank(tasks, placeParsed.success ? placeParsed.data : 'any');
  return NextResponse.json({ tasks, ranked });
}
