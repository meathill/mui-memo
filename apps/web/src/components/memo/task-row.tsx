"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PLACE_LABEL, type TaskView } from "@mui-memo/shared/logic";
import { useNowTick } from "@/hooks/use-now-tick";
import {
  type CheckAnim,
  CHECK_ANIM_DURATION,
  readCheckAnim,
} from "@/lib/settings";
import { isOverdue, relativeTimeLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

interface Props {
  task: TaskView;
  onDone: (id: string) => void | Promise<void>;
}

export function TaskRow({ task, onDone }: Props) {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [anim, setAnim] = useState<CheckAnim>("strike");
  const nowMs = useNowTick();
  const now = new Date(nowMs);

  useEffect(() => {
    setAnim(readCheckAnim());
    function onChange() {
      setAnim(readCheckAnim());
    }
    window.addEventListener("muimemo:check-anim-change", onChange);
    return () =>
      window.removeEventListener("muimemo:check-anim-change", onChange);
  }, []);

  async function handleCheck(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (checked || checking) return;
    setChecking(true);
    setChecked(true);
    try {
      if (anim !== "strike") {
        await new Promise((r) => setTimeout(r, CHECK_ANIM_DURATION[anim]));
      }
      await onDone(task.id);
    } catch {
      setChecked(false);
    } finally {
      setChecking(false);
    }
  }

  const priorityDot =
    task.priority === 3
      ? "bg-accent-warm"
      : task.priority === 2
        ? "bg-accent-warn"
        : "bg-ink-mute/40";

  // 优先看 expectAt；没有就看 dueAt；两者都没就退回静态 deadline label
  const anchor = task.expectAt ?? task.dueAt ?? null;
  const dynamicLabel = relativeTimeLabel(anchor, now);
  const overdue = !task.done && isOverdue(anchor, now);
  const displayLabel = dynamicLabel || task.deadline || "";

  const exitClass =
    checked && anim === "fade"
      ? "mm-fade"
      : checked && anim === "fly"
        ? "mm-fly"
        : "";

  return (
    <li className={exitClass}>
      <Link
        href={`/tasks/${task.id}`}
        prefetch={false}
        className="flex gap-3 border-b border-rule/50 px-1 py-3 last:border-b-0 active:bg-paper/40"
      >
        <button
          type="button"
          onClick={handleCheck}
          aria-label="标记为完成"
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            checked
              ? "border-accent-good bg-accent-good text-paper"
              : "border-ink-mute/50 text-transparent hover:border-ink",
          )}
        >
          <CheckIcon className="h-3 w-3" />
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-serif text-base leading-snug text-ink",
              checked && "mm-strike text-ink-soft",
            )}
          >
            {task.text}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink-mute">
            <span>
              {PLACE_LABEL[task.place].icon} {PLACE_LABEL[task.place].label}
            </span>
            {task.tag ? <span>· 🏷 {task.tag}</span> : null}
            {displayLabel ? (
              <span
                className={cn(
                  overdue && "text-red-600 font-semibold",
                  !overdue && "text-ink-mute",
                )}
              >
                · ⏱ {displayLabel}
              </span>
            ) : null}
            {task.aiReason ? (
              <span className="not-italic text-ink-soft">
                · {task.aiReason}
              </span>
            ) : null}
          </div>
        </div>
        <span
          className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", priorityDot)}
          aria-hidden
        />
      </Link>
    </li>
  );
}
