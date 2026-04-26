import { NextResponse } from 'next/server';
import { R2_PREFIX } from '@/lib/config';
import { requireAuth } from '@/lib/route';

/**
 * 私有音频流式返回。
 * key 路径形如：muimemo/audio/{userId}/{ts}.webm
 * 只有归属自己的 userId 前缀才能读；其它任意前缀直接 403。
 *
 * 走 Worker 代理（而非 NEXT_PUBLIC_ASSETS_URL）是因为音频是敏感数据，
 * 不能放在 public bucket 直链后面。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
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

  const obj = await bucket.get(key);
  if (!obj) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'audio/webm',
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
}
