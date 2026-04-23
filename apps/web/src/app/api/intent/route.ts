import { R2_PREFIX } from '@/lib/config';
import { createGenAI, parseVoiceIntent } from '@/lib/gemini';
import { requireAuthDb } from '@/lib/route';
import { resolveTargetTask } from '@/lib/search';
import { linkAudioKey, listTasksForUser, logUtterance, persistIntentResult } from '@/lib/tasks';
import { describeNow, normalizeTz } from '@/lib/time';
import { applyIntent, rerank } from '@mui-memo/shared/logic';
import { taskPlaceEnum } from '@mui-memo/shared/validators';
import { NextResponse } from 'next/server';

const INTENTS_NEEDING_RESOLVE = new Set(['STATUS', 'DONE', 'MODIFY', 'LINK']);

export async function POST(req: Request) {
  const [resp, rc] = await requireAuthDb();
  if (resp) return resp;
  const { db, env, execCtx, session } = rc;
  const userId = session.user.id;

  const form = await req.formData();
  const audio = form.get('audio');
  const placeStr = String(form.get('place') ?? 'any');
  const tz = normalizeTz(typeof form.get('tz') === 'string' ? (form.get('tz') as string) : undefined);
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'missing audio' }, { status: 400 });
  }

  const placeParsed = taskPlaceEnum.safeParse(placeStr);
  const ctxPlace = placeParsed.success ? placeParsed.data : 'any';

  const genai = createGenAI({
    apiKey: env.GEMINI_API_KEY,
    gatewayAccountId: env.CF_ACCOUNT_ID,
    gatewayId: env.CF_AI_GATEWAY_ID,
  });

  const tasksBefore = await listTasksForUser(db, userId);

  const audioBuffer = await audio.arrayBuffer();
  const mimeType = audio.type || 'audio/webm';

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
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: 'gemini_failed', detail: msg }, { status: 502 });
  }

  // 混合搜索：TiDB 原生 fts_match_word + VEC_EMBED_COSINE_DISTANCE，
  // 查询串直接扔进去，TiDB 内部自动嵌入，不再依赖 Gemini embedding API。
  if (INTENTS_NEEDING_RESOLVE.has(utterance.intent)) {
    try {
      const query = utterance.match?.trim() || utterance.raw;
      const resolved = await resolveTargetTask(db, userId, query, utterance.match);
      if (resolved) utterance.matchId = resolved.id;
    } catch {
      // fallback 给 applyIntent 的正则兜底
    }
  }

  const { tasks: tasksAfter, effect } = applyIntent(tasksBefore, utterance);
  await persistIntentResult(db, userId, tasksBefore, tasksAfter);

  // 归档原始音频到 R2，并把 key 挂到新建的任务行上
  const bucket = env.AUDIO_BUCKET;
  const shouldLinkAudio = (effect.kind === 'add' || effect.kind === 'done-backfill') && effect.id;
  let audioKeyForLog: string | null = null;
  if (bucket && execCtx) {
    const ext = mimeType.includes('webm')
      ? 'webm'
      : mimeType.includes('mp4') || mimeType.includes('m4a')
        ? 'm4a'
        : mimeType.includes('wav')
          ? 'wav'
          : 'bin';
    const audioKey = `${R2_PREFIX}/audio/${userId}/${Date.now()}.${ext}`;
    audioKeyForLog = audioKey;
    execCtx.waitUntil(
      bucket.put(audioKey, audioBuffer, { httpMetadata: { contentType: mimeType } }).catch(() => undefined),
    );
    if (shouldLinkAudio) {
      execCtx.waitUntil(linkAudioKey(db, userId, effect.id, audioKey).catch(() => undefined));
    }
  }

  // 写输入记录（所有意图都记，包括 miss）
  if (execCtx) {
    execCtx.waitUntil(logUtterance(db, userId, utterance, effect, audioKeyForLog).catch(() => undefined));
  }

  const ranked = rerank(tasksAfter, ctxPlace);
  return NextResponse.json({ utterance, effect, tasks: tasksAfter, ranked });
}
