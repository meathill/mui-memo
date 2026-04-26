'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UtteranceItem {
  id: string;
  rawText: string;
  intent: string;
  effectKind: string;
  verb: string | null;
  reason: string | null;
  taskId: string | null;
  audioKey: string | null;
  createdAt: string;
}

const INTENT_LABEL: Record<string, string> = {
  ADD: '新增',
  STATUS: '切状态',
  DONE: '完成',
  MODIFY: '修改',
  LINK: '顺手做',
};

const EFFECT_TONE: Record<string, string> = {
  add: 'bg-accent-warm/10 text-accent-warm border-accent-warm/40',
  status: 'bg-accent-warm/10 text-accent-warm border-accent-warm/40',
  done: 'bg-accent-good/10 text-accent-good border-accent-good/40',
  'done-backfill': 'bg-accent-good/10 text-accent-good border-accent-good/40',
  modify: 'bg-accent-warn/10 text-accent-warn border-accent-warn/40',
  link: 'bg-accent-warm/10 text-accent-warm border-accent-warm/40',
  miss: 'bg-paper-2/80 text-ink-mute border-rule/60',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function UtteranceLogView() {
  const router = useRouter();
  const [items, setItems] = useState<UtteranceItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (before?: string | null) => {
    const url = before ? `/api/utterances?before=${encodeURIComponent(before)}` : '/api/utterances';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as {
      items: UtteranceItem[];
      nextCursor: string | null;
      hasMore: boolean;
    };
  }, []);

  useEffect(() => {
    fetchPage().then((data) => {
      if (!data) return;
      setItems(data.items);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setLoaded(true);
    });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      if (!data) return;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="返回">
          <ArrowLeftIcon />
        </Button>
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">MuiMemo · 输入记录</p>
          <h1 className="font-serif text-2xl text-ink">你说过的每一句</h1>
        </div>
      </header>

      {!loaded ? (
        <p className="mt-12 text-center text-sm text-ink-mute">加载中…</p>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule/60 px-6 py-10 text-center">
          <p className="font-serif text-lg text-ink">还没有说过话</p>
          <p className="mt-1 text-sm text-ink-soft">按住麦克风讲一句试试。</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((u) => (
            <li key={u.id} className="rounded-2xl border border-rule/60 bg-paper-2/40 p-3">
              <div className="flex items-center gap-2 font-mono text-[10px] text-ink-mute">
                <span className={cn('rounded-full border px-2 py-0.5', EFFECT_TONE[u.effectKind] ?? EFFECT_TONE.miss)}>
                  {INTENT_LABEL[u.intent] ?? u.intent}
                  {u.verb ? ` · ${u.verb}` : ''}
                </span>
                <span>{formatWhen(u.createdAt)}</span>
              </div>
              <p className="mt-2 font-serif text-base text-ink">{u.rawText}</p>
              {u.reason ? <p className="mt-1 text-xs text-ink-soft">{u.reason}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-mono text-ink-mute">
                {u.taskId ? (
                  <Link href={`/app/tasks/${u.taskId}`} className="text-accent-warm hover:underline">
                    → 查看任务
                  </Link>
                ) : null}
                {u.audioKey ? <span>🎙 录音已归档</span> : null}
                {u.effectKind === 'miss' ? <span>⚠️ 未命中清单</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div ref={sentinelRef} className="h-4" data-testid="log-sentinel" />
      {hasMore && items.length > 0 ? (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={loadMore} loading={loadingMore}>
            加载更多
          </Button>
        </div>
      ) : items.length > 0 ? (
        <p className="mt-6 text-center font-mono text-[10px] text-ink-mute">· 到底了 ·</p>
      ) : null}
    </main>
  );
}
