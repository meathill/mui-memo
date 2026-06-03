import { NextResponse } from 'next/server';
import { applyRecurrenceReconcile } from '@/lib/recurrences';
import { requireAuthDb } from '@/lib/route';
import { listTasksForUser } from '@/lib/tasks';

/**
 * 返回当前用户的全量未归档任务视图。
 * 前端会把结果丢进 zustand，place 筛选 / rerank 都在客户端完成，
 * 切换场景不再发新请求。
 */
export async function GET() {
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  // 周期任务 lazy 对账：生成本期实例 + 清理上期未完成。包 try/catch，绝不拖垮主列表。
  try {
    await applyRecurrenceReconcile(ctx.db, ctx.session.user.id);
  } catch {
    // 对账失败不影响任务读取，下次 fetch 再试
  }
  const all = await listTasksForUser(ctx.db, ctx.session.user.id);
  // 只返回未完成的：done 的去 /completed 页看。linked 作为子任务保留，
  // applyIntent 期待 rerank 上下文里有 doing 父任务的 linked[]。
  const tasks = all.filter((t) => t.status !== 'done');
  return NextResponse.json({ tasks });
}
