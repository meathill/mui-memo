"use client";

import { CheckIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullIndicator } from "./pull-indicator";
import { SectionHeader } from "./section-header";

interface CompletedTask {
  id: string;
  text: string;
  tag: string | null;
  completedAt: string | null;
}

function formatDay(iso: string | null): string {
  if (!iso) return "更早";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "今天";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  ) {
    return "昨天";
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CompletedView() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (before?: string | null) => {
    const url = before
      ? `/api/tasks/completed?before=${encodeURIComponent(before)}`
      : "/api/tasks/completed";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as {
      tasks: CompletedTask[];
      nextCursor: string | null;
      hasMore: boolean;
    };
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchPage();
    if (!data) return;
    setTasks(data.tasks);
    setNextCursor(data.nextCursor);
    setHasMore(data.hasMore);
    setLoaded(true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      if (!data) return;
      setTasks((prev) => [...prev, ...data.tasks]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, hasMore, nextCursor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 上拉到底部自动加载
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const { pullOffset, refreshing, trigger } = usePullToRefresh(refresh);

  const grouped = useMemo(() => {
    const map = new Map<string, CompletedTask[]>();
    for (const t of tasks) {
      const day = formatDay(t.completedAt);
      const arr = map.get(day) ?? [];
      arr.push(t);
      map.set(day, arr);
    }
    return Array.from(map.entries());
  }, [tasks]);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <PullIndicator
        pullOffset={pullOffset}
        refreshing={refreshing}
        onManualRefresh={() => trigger()}
      />
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
          MuiMemo · 已完成
        </p>
        <h1 className="font-serif text-2xl text-ink">你搞定的那些事</h1>
        <p className="mt-1 text-sm text-ink-soft">
          已加载 {tasks.length} 件{hasMore ? "（还可下拉/滚到底部看更多）" : ""}
        </p>
      </header>

      {!loaded ? (
        <p className="mt-12 text-center text-sm text-ink-mute">加载中…</p>
      ) : tasks.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-rule/60 px-6 py-10 text-center">
          <p className="font-serif text-lg text-ink">还没有完成任何事</p>
          <p className="mt-1 text-sm text-ink-soft">
            勾掉第一件时会显示在这里。
          </p>
        </div>
      ) : (
        <section className="mt-2">
          {grouped.map(([day, list]) => (
            <div key={day}>
              <SectionHeader title={day} count={list.length} />
              <ul className="rounded-2xl border border-rule/60 bg-paper-2/40 px-3">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 border-b border-rule/50 px-1 py-3 last:border-b-0"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-good text-paper">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base leading-snug text-ink-soft line-through decoration-1">
                        {t.text}
                      </p>
                      <div className="mt-0.5 flex gap-x-2 text-[11px] font-mono text-ink-mute">
                        {t.tag ? <span>🏷 {t.tag}</span> : null}
                        {t.completedAt ? (
                          <span>· {formatTime(t.completedAt)}</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div
            ref={sentinelRef}
            data-testid="load-more-sentinel"
            className="h-4"
          />
          {hasMore ? (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                loading={loadingMore}
              >
                加载更多
              </Button>
            </div>
          ) : tasks.length > 0 ? (
            <p className="mt-6 text-center font-mono text-[10px] text-ink-mute">
              · 到底了 ·
            </p>
          ) : null}
        </section>
      )}
    </main>
  );
}
