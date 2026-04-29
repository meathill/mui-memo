import { NextResponse } from 'next/server';
import { R2_PREFIX } from '@/lib/config';
import { streamR2Object, withHeadBodyStripped } from '@/lib/r2-stream';
import { requireAuth } from '@/lib/route';

/**
 * 私有音频流式返回。
 * key 路径形如：muimemo/audio/{userId}/{timestamp}.{webm|m4a}
 * （web MediaRecorder 默认 webm，iOS expo-audio 默认 m4a）。
 * 只有归属自己的 userId 前缀才能读；其它任意前缀直接 403。
 *
 * 走 Worker 代理（而非 NEXT_PUBLIC_ASSETS_URL）是因为音频是敏感数据，
 * 不能放在 public bucket 直链后面。
 *
 * GET / HEAD 都走 streamR2Object：iOS AVPlayer 严格依赖 Range/206，
 * 历史上只回 200 全量会让 iOS 静默不播 (#2)。
 */
async function handle(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const [resp, ctx] = await requireAuth();
  if (resp) return resp;

  const { key: segments } = await params;
  const key = segments.join('/');

  const required = `${R2_PREFIX}/audio/${ctx.session.user.id}/`;
  if (!key.startsWith(required)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const bucket = ctx.env.AUDIO_BUCKET;
  if (!bucket) {
    return NextResponse.json({ error: 'r2_not_bound' }, { status: 500 });
  }

  return streamR2Object({ bucket, key, request: req, fallbackContentType: 'audio/mp4' });
}

export const GET = handle;
// HEAD 走 wrapper 自动剥 body：requireAuth / 前缀校验 / R2 未绑定等错误分支
// 默认带 JSON body，HEAD 必须无 body（RFC 7231 §4.3.2）
export const HEAD = withHeadBodyStripped(handle);
