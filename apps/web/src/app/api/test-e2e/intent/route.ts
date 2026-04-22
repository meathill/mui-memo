import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { applyIntent, rerank } from "@mui-memo/shared/logic";
import { taskPlaceEnum, utteranceSchema } from "@mui-memo/shared/validators";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { ensureE2EEnabled } from "@/lib/e2e-guard";
import { listTasksForUser, persistIntentResult } from "@/lib/tasks";
import { resolveTargetTask } from "@/lib/search";
import { createEmbedder } from "@/lib/embedding";
import { createGenAI } from "@/lib/gemini";

const INTENTS_NEEDING_RESOLVE = new Set(["STATUS", "DONE", "MODIFY", "LINK"]);

/**
 * 绕过 Gemini 的测试端点：直接接收 JSON Utterance + place，跑 applyIntent 和持久化。
 * 仅在 E2E_ENABLED=1 时启用。嵌入/搜索仍然调真实 Gemini/TiDB，方便验证混合搜索。
 * 若 body.skipEmbedding=true 则完全跳过，便于无网环境。
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
    skipEmbedding?: boolean;
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
  const embedder = body.skipEmbedding
    ? undefined
    : createEmbedder(
        createGenAI({
          apiKey: env.GEMINI_API_KEY,
          gatewayAccountId: env.CF_AI_GATEWAY_ACCOUNT_ID,
          gatewayId: env.CF_AI_GATEWAY_ID,
        }),
      );

  const tasksBefore = await listTasksForUser(db, session.user.id);

  if (INTENTS_NEEDING_RESOLVE.has(utterance.intent) && embedder) {
    try {
      const resolved = await resolveTargetTask(
        db,
        session.user.id,
        utterance.match?.trim() || utterance.raw,
        utterance.match,
        embedder,
      );
      if (resolved) utterance.matchId = resolved.id;
    } catch {}
  }

  const { tasks: tasksAfter, effect } = applyIntent(tasksBefore, utterance);
  try {
    await persistIntentResult(
      db,
      session.user.id,
      tasksBefore,
      tasksAfter,
      embedder,
    );
  } catch (err) {
    const msg =
      err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error("[test-e2e/intent] persist failed:", msg);
    return NextResponse.json(
      { error: "persist_failed", detail: msg },
      { status: 500 },
    );
  }

  const ranked = rerank(tasksAfter, ctxPlace);
  return NextResponse.json({ utterance, effect, tasks: tasksAfter, ranked });
}
