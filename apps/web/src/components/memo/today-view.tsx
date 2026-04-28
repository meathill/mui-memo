'use client';

import { BUCKET_LABEL, type Bucket, rerank, type TaskView } from '@mui-memo/shared/logic';
import type { TaskPlace } from '@mui-memo/shared/validators';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { track } from '@/lib/analytics';
import { useAppStore } from '@/store';
import { ContextStrip } from './context-strip';
import { DoingCard } from './doing-card';
import { EffectToast } from './effect-toast';
import { MicButton } from './mic-button';
import { PullIndicator } from './pull-indicator';
import { SectionHeader } from './section-header';
import { TaskRow } from './task-row';

const SECTION_ORDER: Bucket[] = ['now', 'today_here', 'today_else', 'blocked', 'later'];

interface Props {
  userName: string;
}

export function TodayView({ userName }: Props) {
  const router = useRouter();
  useEffect(() => {
    try {
      if (!window.localStorage.getItem('muimemo:onboarded')) {
        router.replace('/onboarding');
      }
    } catch {}
  }, [router]);

  const { place, setPlace, tasks, hydrate, setProcessing, isProcessing, lastEffect, lastUtterance, setLastEffect } =
    useAppStore();

  // 单次拉取：只拉全量 tasks，不带 place；筛选和 rerank 都在前端。
  const fetchAll = useCallback(async () => {
    const res = await fetch(`/api/tasks`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { tasks: TaskView[] };
    hydrate({ tasks: data.tasks, ranked: [] });
  }, [hydrate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const { pullOffset, refreshing, trigger } = usePullToRefresh(fetchAll);

  const ranked = useMemo(() => rerank(tasks, place), [tasks, place]);
  const doing = useMemo(() => tasks.find((t) => t.status === 'doing'), [tasks]);
  const grouped = useMemo(() => {
    const buckets = new Map<Bucket, TaskView[]>();
    for (const t of ranked) {
      if (t.bucket === 'doing') continue;
      const arr = buckets.get(t.bucket) ?? [];
      arr.push(t);
      buckets.set(t.bucket, arr);
    }
    return buckets;
  }, [ranked]);
  const nowCount = (grouped.get('now')?.length ?? 0) + (grouped.get('today_here')?.length ?? 0);

  const handlePlaceChange = useCallback((p: TaskPlace) => setPlace(p), [setPlace]);

  // 切场景时重放一次淡入脉冲：避开 key={place} 那种 remount 方案，
  // 不重置 TaskRow 的本地状态（checked / checking / 事件订阅）。
  // 经典 trick：移掉 class → 强制 reflow → 再加回去。
  const pulseRef = useRef<HTMLDivElement>(null);
  const lastPlaceRef = useRef(place);
  useEffect(() => {
    if (lastPlaceRef.current === place) return;
    lastPlaceRef.current = place;
    const el = pulseRef.current;
    if (!el) return;
    el.classList.remove('animate-filter-pulse');
    void el.offsetWidth;
    el.classList.add('animate-filter-pulse');
  }, [place]);

  const handleAudio = useCallback(
    async (blob: Blob) => {
      setProcessing(true);
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'utterance.webm');
        fd.append('place', place);
        try {
          fd.append('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
        } catch {}
        const res = await fetch('/api/intent', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            detail?: string;
          };
          setLastEffect({ kind: 'miss', verb: err.detail ?? '识别失败' }, null);
          return;
        }
        const data = (await res.json()) as {
          utterance: typeof lastUtterance;
          effect: typeof lastEffect;
          tasks: TaskView[];
        };
        hydrate({ tasks: data.tasks, ranked: [] });
        setLastEffect(data.effect, data.utterance);
        track({ name: 'voice_intent', intent: data.effect?.kind });
      } finally {
        setProcessing(false);
      }
    },
    [place, setProcessing, setLastEffect, hydrate],
  );

  const handleDone = useCallback(
    async (id: string) => {
      // 乐观更新：本地先打 done，省一次回拉
      const current = useAppStore.getState().tasks;
      hydrate({
        tasks: current.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'done',
                done: true,
                completedAt: new Date().toISOString(),
              }
            : t,
        ),
        ranked: [],
      });
      await fetch(`/api/tasks/${id}/done`, { method: 'POST' });
      track({ name: 'task_complete', source: 'today' });
    },
    [hydrate],
  );

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-48 sm:pt-10">
      <EffectToast effect={lastEffect} utterance={lastUtterance} />
      <PullIndicator pullOffset={pullOffset} refreshing={refreshing} onManualRefresh={() => trigger()} />

      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">MuiMemo · 今天</p>
        <h1 className="font-serif text-2xl text-ink">你好，{userName}</h1>
      </header>

      <div className="mt-5">
        <ContextStrip value={place} onChange={handlePlaceChange} nowCount={nowCount} />
      </div>

      {doing ? (
        <div className="mt-5">
          <DoingCard task={doing} onDone={handleDone} />
        </div>
      ) : null}

      <section className="mt-4">
        {/* animate-filter-pulse 不写在默认 className 里：写了首屏 mount 就会自动播一次。
            effect 在 place 真变化时才 add，跟 RN 侧 isFirstRender 守护对齐。 */}
        <div ref={pulseRef}>
          {SECTION_ORDER.map((bucket) => {
            const list = grouped.get(bucket) ?? [];
            if (!list.length) return null;
            return (
              <div key={bucket}>
                <SectionHeader title={BUCKET_LABEL[bucket]} count={list.length} />
                <ul className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onDone={handleDone} />
                  ))}
                </ul>
              </div>
            );
          })}

          {ranked.length === 0 && !doing ? (
            <div className="mt-10 rounded-2xl border border-dashed border-rule/60 px-6 py-10 text-center">
              <p className="font-serif text-lg text-ink">清单里还没有事</p>
              <p className="mt-1 text-sm text-ink-soft">
                按住下面的麦克风说一句，比如：
                <br />
                「下午三点前给老张转五百」
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <div
        className="fixed inset-x-0 z-30 flex justify-center bg-gradient-to-t from-paper via-paper/95 to-transparent pt-10 pb-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}
      >
        <MicButton disabled={isProcessing} onAudio={handleAudio} />
      </div>
    </main>
  );
}
