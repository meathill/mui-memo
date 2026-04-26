'use client';

import type { TaskView } from '@mui-memo/shared/logic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { track } from '@/lib/analytics';
import { useAppStore } from '@/store';
import { PullIndicator } from './pull-indicator';
import { SectionHeader } from './section-header';
import { TaskRow } from './task-row';

const UNTAGGED = '（未分类）';

export function AllView() {
  const { tasks, hydrate } = useAppStore();
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/tasks', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { tasks: TaskView[] };
    hydrate({ tasks: data.tasks, ranked: [] });
    setLoaded(true);
  }, [hydrate]);

  useEffect(() => {
    // 有 store 就直接渲染；同时后台静默刷新一次拿最新数据
    if (tasks.length > 0) setLoaded(true);
    load();
  }, [load, tasks.length]);

  const { pullOffset, refreshing, trigger } = usePullToRefresh(load);

  const handleDone = useCallback(
    async (id: string) => {
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
      track({ name: 'task_complete', source: 'all' });
    },
    [hydrate],
  );

  const pending = useMemo(() => tasks.filter((t) => !t.done && t.status !== 'linked'), [tasks]);
  const grouped = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of pending) {
      const key = t.tag || UNTAGGED;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [pending]);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <PullIndicator pullOffset={pullOffset} refreshing={refreshing} onManualRefresh={() => trigger()} />
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">MuiMemo · 全部</p>
        <h1 className="font-serif text-2xl text-ink">清单全景</h1>
        <p className="mt-1 text-sm text-ink-soft">共 {pending.length} 件待办，按标签分组</p>
      </header>

      {!loaded ? (
        <p className="mt-12 text-center text-sm text-ink-mute">加载中…</p>
      ) : grouped.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule/60 px-6 py-10 text-center">
          <p className="font-serif text-lg text-ink">清单是空的</p>
          <p className="mt-1 text-sm text-ink-soft">回到今天说一句话就有了。</p>
        </div>
      ) : (
        <section className="mt-2">
          {grouped.map(([tag, list]) => (
            <div key={tag}>
              <SectionHeader title={tag} count={list.length} />
              <ul className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                {list.map((t) => (
                  <TaskRow key={t.id} task={t} onDone={handleDone} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
