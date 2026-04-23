import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { applyIntent, rerank } from "@mui-memo/shared/logic";
import { taskPlaceEnum, utteranceSchema } from "@mui-memo/shared/validators";
import { getServerSession } from "@/lib/auth";
import { createDb } from "@/lib/db";
import { ensureE2EEnabled } from "@/lib/e2e-guard";
import { resolveTargetTask } from "@/lib/search";
import {
  listTasksForUser,
  logUtterance,
  persistIntentResult,
} from "@/lib/tasks";

const INTENTS_NEEDING_RESOLVE = new Set(["STATUS", "DONE", "MODIFY", "LINK"]);

/**
 * 绕过 Gemini 的测试端点：直接接收 JSON Utterance + place，跑 applyIntent 和持久化。
 * 仅在 E2E_ENABLED=1 时启用。embedding 不再由代码负责，TiDB 生成列自己来。
 * body.skipResolve=true 时也不跑 hybrid 搜索，只跑 applyIntent（正则兜底）。
 */
export async function POST(req: Request) {
  if (!(await ensureE2EEnabled())) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    utterance?: unknown;
    place?: unknown;
    skipResolve?: boolean;
  } | null;
  if (!body)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const utteranceParsed = utteranceSchema.safeParse(body.utterance);
  if (!utteranceParsed.success) {
    return NextResponse.json(
      { error: "invalid utterance", issues: utteranceParsed.error.issues },
      { status: 400 },
    );
  }
  const placeParsed = taskPlaceEnum.safeParse(body.place ?? "any");
  const ctxPlace = placeParsed.success ? placeParsed.data : "any";
  const utterance = utteranceParsed.data;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);

  const tasksBefore = await listTasksForUser(db, session.user.id);

  if (INTENTS_NEEDING_RESOLVE.has(utterance.intent) && !body.skipResolve) {
    try {
      const resolved = await resolveTargetTask(
        db,
        session.user.id,
        utterance.match?.trim() || utterance.raw,
        utterance.match,
      );
      if (resolved) utterance.matchId = resolved.id;
    } catch {}
  }

  const { tasks: tasksAfter, effect } = applyIntent(tasksBefore, utterance);
  try {
    await persistIntentResult(db, session.user.id, tasksBefore, tasksAfter);
  } catch (err) {
    const msg =
      err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error("[test-e2e/intent] persist failed:", msg);
    return NextResponse.json(
      { error: "persist_failed", detail: msg },
      { status: 500 },
    );
  }

  await logUtterance(db, session.user.id, utterance, effect, null).catch(
    () => undefined,
  );

  const ranked = rerank(tasksAfter, ctxPlace);
  return NextResponse.json({ utterance, effect, tasks: tasksAfter, ranked });
}
