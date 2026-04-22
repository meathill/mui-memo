"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLACE_LABEL, type TaskView } from "@mui-memo/shared/logic";

interface Props {
  task: TaskView;
  onDone: (id: string) => void | Promise<void>;
}

export function TaskRow({ task, onDone }: Props) {
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  async function handleCheck() {
    if (checked || checking) return;
    setChecking(true);
    setChecked(true);
    try {
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

  return (
    <li className="flex gap-3 px-1 py-3 border-b border-rule/50 last:border-b-0">
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
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-mute font-mono">
          <span>
            {PLACE_LABEL[task.place].icon} {PLACE_LABEL[task.place].label}
          </span>
          {task.tag ? <span>· 🏷 {task.tag}</span> : null}
          {task.deadline ? <span>· ⏱ {task.deadline}</span> : null}
          {task.aiReason ? (
            <span className="text-ink-soft not-italic">· {task.aiReason}</span>
          ) : null}
        </div>
      </div>
      <span
        className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", priorityDot)}
        aria-hidden
      />
    </li>
  );
}
