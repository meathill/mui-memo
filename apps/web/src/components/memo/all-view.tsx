"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TaskView } from "@mui-memo/shared/logic";
import { TaskRow } from "./task-row";
import { SectionHeader } from "./section-header";

const UNTAGGED = "（未分类）";

export function AllView() {
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks?place=any", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { tasks: TaskView[] };
    setTasks(data.tasks.filter((t) => !t.done && t.status !== "linked"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDone = useCallback(
    async (id: string) => {
      await fetch(`/api/tasks/${id}/done`, { method: "POST" });
      await load();
    },
    [load],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TaskView[]>();
    for (const t of tasks) {
      const key = t.tag || UNTAGGED;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [tasks]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pt-6 pb-24 sm:pt-10">
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
          MuiMemo · 全部
        </p>
        <h1 className="font-serif text-2xl text-ink">清单全景</h1>
        <p className="mt-1 text-sm text-ink-soft">
          共 {tasks.length} 件待办，按标签分组
        </p>
      </header>

      {loading ? (
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
