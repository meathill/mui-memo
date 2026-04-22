"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks/completed", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((data: { tasks: CompletedTask[] }) => {
        setTasks(data.tasks);
        setLoading(false);
      });
  }, []);

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
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
          MuiMemo · 已完成
        </p>
        <h1 className="font-serif text-2xl text-ink">你搞定的那些事</h1>
        <p className="mt-1 text-sm text-ink-soft">累计 {tasks.length} 件</p>
      </header>

      {loading ? (
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
        </section>
      )}
    </main>
  );
}
