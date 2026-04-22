"use client";

import { cn } from "@/lib/utils";
import { PLACE_LABEL } from "@mui-memo/shared/logic";
import type { TaskPlace } from "@mui-memo/shared/validators";

const OPTIONS: TaskPlace[] = ["home", "work", "out"];

interface Props {
  value: TaskPlace;
  onChange: (p: TaskPlace) => void;
  nowCount: number;
}

export function ContextStrip({ value, onChange, nowCount }: Props) {
  return (
    <div className="rounded-2xl border border-rule/60 bg-paper-2/70 px-4 py-3 shadow-xs/5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.15em] text-ink-mute uppercase">
            当前场景
          </p>
          <p className="mt-0.5 font-serif text-lg text-ink">
            {PLACE_LABEL[value].icon} {PLACE_LABEL[value].label}
            <span className="ml-2 text-sm text-ink-soft">
              · 此刻能做 <strong className="text-ink">{nowCount}</strong> 件
            </span>
          </p>
        </div>
        <div className="flex rounded-full bg-paper p-1 text-xs shadow-xs/5 ring-1 ring-rule/50">
          {OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "rounded-full px-3 py-1.5 transition-colors",
                value === p
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {PLACE_LABEL[p].icon} {PLACE_LABEL[p].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
