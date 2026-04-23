import { ensureE2EEnabled } from '@/lib/e2e-guard';
import { requireAuthDb } from '@/lib/route';
import { resolveTargetTask } from '@/lib/search';
import { listTasksForUser, logUtterance, persistIntentResult } from '@/lib/tasks';
import { applyIntent, rerank } from '@mui-memo/shared/logic';
import { taskPlaceEnum, utteranceSchema } from '@mui-memo/shared/validators';
import { NextResponse } from 'next/server';

const INTENTS_NEEDING_RESOLVE = new Set(['STATUS', 'DONE', 'MODIFY', 'LINK']);

/**
 * 绕过 Gemini 的测试端点：直接接收 JSON Utterance + place，跑 applyIntent 和持久化。
 * 仅在 E2E_ENABLED=1 时启用。embedding 不再由代码负责，TiDB 生成列自己来。
 * body.skipResolve=true 时也不跑 hybrid 搜索，只跑 applyIntent（正则兜底）。
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const [resp, ctx] = await requireAuthDb();
  if (resp) return resp;
  const userId = ctx.session.user.id;

  const body = (await req.json().catch(() => null)) as {
    utterance?: unknown;
    place?: unknown;
    skipResolve?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const utteranceParsed = utteranceSchema.safeParse(body.utterance);
  if (!utteranceParsed.success) {
    return NextResponse.json({ error: 'invalid utterance', issues: utteranceParsed.error.issues }, { status: 400 });
  }
  const placeParsed = taskPlaceEnum.safeParse(body.place ?? 'any');
  const ctxPlace = placeParsed.success ? placeParsed.data : 'any';
  const utterance = utteranceParsed.data;

  const tasksBefore = await listTasksForUser(ctx.db, userId);

  if (INTENTS_NEEDING_RESOLVE.has(utterance.intent) && !body.skipResolve) {
    try {
      const resolved = await resolveTargetTask(
        ctx.db,
        userId,
        utterance.match?.trim() || utterance.raw,
        utterance.match,
      );
      if (resolved) utterance.matchId = resolved.id;
    } catch {}
  }

  const { tasks: tasksAfter, effect } = applyIntent(tasksBefore, utterance);
  try {
    await persistIntentResult(ctx.db, userId, tasksBefore, tasksAfter);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error('[test-e2e/intent] persist failed:', msg);
    return NextResponse.json({ error: 'persist_failed', detail: msg }, { status: 500 });
  }

  await logUtterance(ctx.db, userId, utterance, effect, null).catch(() => undefined);

  const ranked = rerank(tasksAfter, ctxPlace);
  return NextResponse.json({ utterance, effect, tasks: tasksAfter, ranked });
}
