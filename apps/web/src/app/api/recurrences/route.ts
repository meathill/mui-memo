import { createRecurrenceSchema } from '@mui-memo/shared/validators';
import { NextResponse } from 'next/server';
import { applyRecurrenceReconcile, createRecurrence } from '@/lib/recurrences';
import { requireAuthDb } from '@/lib/route';

/**
 * 新建周期任务定义。可带 linkTaskId 把现有任务挂成当前期实例。
 * 建完即对账：linkTaskId 已挂当前期；无 linkTaskId 时这里生成首期实例。
 */
export async function POST(req: Request) {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const body = await req.json().catch(() => null);
  const parsed = createRecurrenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  const userId = ctx.session.user.id;
  const rec = await createRecurrence(ctx.db, userId, parsed.data);
  try {
    await applyRecurrenceReconcile(ctx.db, userId);
  } catch {
    // 首期实例生成失败不阻塞创建，下次 fetch 自愈
  }
  return NextResponse.json({
    recurrence: {
      id: rec.id,
      freq: rec.freq,
      interval: rec.interval,
      anchorAt: rec.anchorAt.toISOString(),
    },
  });
}
