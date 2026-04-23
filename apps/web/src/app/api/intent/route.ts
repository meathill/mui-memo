import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import {
  backfillEmbeddings,
  linkAudioKey,
  listTasksForUser,
  logUtterance,
  persistIntentResult,
} from "@/lib/tasks";
import { createGenAI, parseVoiceIntent } from "@/lib/gemini";
import { createEmbedder } from "@/lib/embedding";
import { resolveTargetTask } from "@/lib/search";
import { applyIntent, rerank } from "@mui-memo/shared/logic";
import { taskPlaceEnum } from "@mui-memo/shared/validators";
import { R2_PREFIX } from "@/lib/config";
import { describeNow, normalizeTz } from "@/lib/time";

const INTENTS_NEEDING_RESOLVE = new Set(["STATUS", "DONE", "MODIFY", "LINK"]);

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const audio = form.get("audio");
  const placeStr = String(form.get("place") ?? "any");
  const tz = normalizeTz(
    typeof form.get("tz") === "string" ? (form.get("tz") as string) : undefined,
  );
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "missing audio" }, { status: 400 });
  }

  const placeParsed = taskPlaceEnum.safeParse(placeStr);
  const ctxPlace = placeParsed.success ? placeParsed.data : "any";

  const { env, ctx } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  const genai = createGenAI({
    apiKey: env.GEMINI_API_KEY,
    gatewayAccountId: env.CF_ACCOUNT_ID,
    gatewayId: env.CF_AI_GATEWAY_ID,
  });
  const embedder = createEmbedder(genai);

  const tasksBefore = await listTasksForUser(db, session.user.id);

  const audioBuffer = await audio.arrayBuffer();
  const mimeType = audio.type || "audio/webm";

  let utterance;
  try {
    const anchor = describeNow(tz);
    utterance = await parseVoiceIntent({
      genai,
      audio: audioBuffer,
      audioMimeType: mimeType,
      currentTasks: tasksBefore,
      now: { iso: anchor.iso, tz, weekday: anchor.weekday },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "gemini_failed", detail: msg },
      { status: 502 },
    );
  }

  // 混合搜索：为需要匹配的意图补一个 matchId
  if (INTENTS_NEEDING_RESOLVE.has(utterance.intent)) {
    try {
      const query = utterance.match?.trim() || utterance.raw;
      const resolved = await resolveTargetTask(
        db,
        session.user.id,
        query,
        utterance.match,
        embedder,
      );
      if (resolved) {
        utterance.matchId = resolved.id;
      }
    } catch {
      // 解析失败就退回给 applyIntent 用正则兜底
    }
  }

  const { tasks: tasksAfter, effect } = applyIntent(tasksBefore, utterance);
  await persistIntentResult(
    db,
    session.user.id,
    tasksBefore,
    tasksAfter,
    embedder,
  );

  // 归档原始音频到 R2，并把 key 挂到新建的任务行上，方便详情页回放
  const bucket = env.AUDIO_BUCKET;
  const shouldLinkAudio =
    (effect.kind === "add" || effect.kind === "done-backfill") && effect.id;
  let audioKeyForLog: string | null = null;
  if (bucket && ctx) {
    const ext = mimeType.includes("webm") ? "webm" : "bin";
    const audioKey = `${R2_PREFIX}/audio/${session.user.id}/${Date.now()}.${ext}`;
    audioKeyForLog = audioKey;
    ctx.waitUntil(
      bucket
        .put(audioKey, audioBuffer, { httpMetadata: { contentType: mimeType } })
        .catch(() => undefined),
    );
    if (shouldLinkAudio) {
      ctx.waitUntil(
        linkAudioKey(db, session.user.id, effect.id, audioKey).catch(
          () => undefined,
        ),
      );
    }
  }

  // 写输入记录（所有意图都记，包括 miss 以便回看「没识别到」的那些）
  if (ctx) {
    ctx.waitUntil(
      logUtterance(
        db,
        session.user.id,
        utterance,
        effect,
        audioKeyForLog,
      ).catch(() => undefined),
    );
  }

  // 机会性回填历史任务的 embedding
  if (ctx) {
    ctx.waitUntil(
      backfillEmbeddings(db, session.user.id, embedder).catch(() => undefined),
    );
  }

  const ranked = rerank(tasksAfter, ctxPlace);
  return NextResponse.json({ utterance, effect, tasks: tasksAfter, ranked });
}
