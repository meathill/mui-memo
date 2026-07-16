import {
  applyActions,
  type IntentEffect,
  rerank,
  type TaskView,
} from "@mui-memo/shared/logic";
import { type Action, taskPlaceEnum } from "@mui-memo/shared/validators";
import { NextResponse } from "next/server";
import { R2_PREFIX } from "@/lib/config";
import { resolveAndParseVoiceIntent } from "@/lib/intent";
import { requireAuthDb } from "@/lib/route";
import { resolveTargetTask } from "@/lib/search";
import {
  linkAudioKey,
  listRecentTagCandidatesForUser,
  listTasksForUser,
  logUtterance,
  mergeTagCandidates,
  persistIntentResult,
} from "@/lib/tasks";
import { describeNow, normalizeTz } from "@/lib/time";

const RESOLVE_INTENTS = new Set<Action["intent"]>([
  "STATUS",
  "DONE",
  "MODIFY",
  "LINK",
]);

/**
 * 待用户确认的 effect。前端在弹窗里给出「确认 / 改为新增 / 取消」三按钮，
 * 之后调 /api/intent/confirm 真正落库。
 */
export interface PendingConfirm {
  /** 在 effects[] 中的位置，方便前端匹配 */
  index: number;
  effect: IntentEffect;
}

function hasMatch(
  action: Action,
): action is Extract<Action, { match?: string; matchId?: string }> {
  return action.intent !== "ADD";
}

export async function POST(req: Request) {
  const [resp, rc] = await requireAuthDb();
  if (resp) return resp;
  const { db, env, execCtx, session } = rc;
  const userId = session.user.id;

  const form = await req.formData();
  const audio = form.get("audio");
  const placeStr = String(form.get("place") ?? "any");
  const tz = normalizeTz(
    typeof form.get("tz") === "string" ? (form.get("tz") as string) : undefined,
  );
  const localTagCandidates = parseTagCandidates(form.get("tagCandidates"));
  // Cloudflare 边缘注入的来源地区码（ISO 3166-1 alpha-2），供 auto 模式选 provider；本地 dev 为 null。
  const country = req.headers.get("cf-ipcountry");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "missing audio" }, { status: 400 });
  }

  const placeParsed = taskPlaceEnum.safeParse(placeStr);
  const ctxPlace = placeParsed.success ? placeParsed.data : "any";

  const [tasksBefore, dbTagCandidates] = await Promise.all([
    listTasksForUser(db, userId),
    listRecentTagCandidatesForUser(db, userId),
  ]);
  const tagCandidates = mergeTagCandidates(localTagCandidates, dbTagCandidates);

  const audioBuffer = await audio.arrayBuffer();
  const mimeType = audio.type || "audio/webm";

  let utterance: Awaited<ReturnType<typeof resolveAndParseVoiceIntent>>;
  try {
    const anchor = describeNow(tz);
    utterance = await resolveAndParseVoiceIntent(env, {
      audio: audioBuffer,
      audioMimeType: mimeType,
      currentTasks: tasksBefore,
      now: { iso: anchor.iso, tz, weekday: anchor.weekday },
      tagCandidates,
      country,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "ai_failed", detail: msg },
      { status: 502 },
    );
  }

  // 并发解析每个非 ADD 的 action 的 matchId。一个清单最多 30 条，并发上限不必太严。
  await Promise.all(
    utterance.actions.map(async (action) => {
      if (!RESOLVE_INTENTS.has(action.intent)) return;
      if (!hasMatch(action)) return;
      try {
        const query = action.match?.trim() || utterance.raw;
        const resolved = await resolveTargetTask(
          db,
          userId,
          query,
          action.match,
        );
        if (resolved) {
          (action as { matchId?: string }).matchId = resolved.id;
        }
      } catch {
        // 静默 fallback：applyAction 内部还会用正则兜底
      }
    }),
  );

  const { tasks: tasksAfter, effects } = applyActions(tasksBefore, utterance);

  // MODIFY/DONE 命中视为「待确认」：DB 不立刻 update。
  // - DONE 命中：applyAction 没改 tasks，无需 revert。
  // - MODIFY 命中：tasks 已被改，要把 patch 还原成 before 才能 persist。
  const pendingModifyById = new Map<
    string,
    IntentEffect & { kind: "modify" }
  >();
  for (const e of effects) {
    if (e.kind === "modify") pendingModifyById.set(e.id, e);
  }
  const tasksAutoOnly: TaskView[] = pendingModifyById.size
    ? tasksAfter.map((t) => {
        const m = pendingModifyById.get(t.id);
        return m ? { ...t, ...m.before } : t;
      })
    : tasksAfter;

  await persistIntentResult(db, userId, tasksBefore, tasksAutoOnly);

  // R2 归档：所有自动落库的新建任务（add / done-backfill）都挂同一个 audioKey
  const bucket = env.AUDIO_BUCKET;
  let audioKeyForLog: string | null = null;
  if (bucket && execCtx) {
    const ext = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("mp4") || mimeType.includes("m4a")
        ? "m4a"
        : mimeType.includes("wav")
          ? "wav"
          : "bin";
    const audioKey = `${R2_PREFIX}/audio/${userId}/${Date.now()}.${ext}`;
    audioKeyForLog = audioKey;
    execCtx.waitUntil(
      bucket
        .put(audioKey, audioBuffer, { httpMetadata: { contentType: mimeType } })
        .catch(() => undefined),
    );
    for (const e of effects) {
      if (e.kind === "add" || e.kind === "done-backfill") {
        execCtx.waitUntil(
          linkAudioKey(db, userId, e.id, audioKey).catch(() => undefined),
        );
      }
    }
  }

  if (execCtx) {
    execCtx.waitUntil(
      logUtterance(db, userId, utterance, effects, audioKeyForLog).catch(
        () => undefined,
      ),
    );
  }

  const pendingConfirms: PendingConfirm[] = [];
  effects.forEach((effect, index) => {
    if (effect.kind === "modify" || effect.kind === "done") {
      pendingConfirms.push({ index, effect });
    }
  });

  const ranked = rerank(tasksAutoOnly, ctxPlace);
  return NextResponse.json({
    utterance,
    effects,
    tasks: tasksAutoOnly,
    ranked,
    pendingConfirms,
  });
}

function parseTagCandidates(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}
