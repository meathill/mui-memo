'use client';

import type { TaskPlace, TaskStatus, TaskWindow } from '@mui-memo/shared/validators';
import { useEffect, useRef, useState } from 'react';
import { useNowTick } from '@/hooks/use-now-tick';
import { formatDueAt, isOverdue, isoToLocalInput, localInputToISO, relativeTimeLabel } from '@/lib/time';
import { cn } from '@/lib/utils';

export const PLACES: TaskPlace[] = ['home', 'work', 'out', 'any'];
export const WINDOWS: TaskWindow[] = ['now', 'today', 'later'];
export const PRIORITIES = [1, 2, 3] as const;
export const STATUSES: TaskStatus[] = ['pending', 'doing', 'done'];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '待做',
  doing: '正在做',
  done: '已完成',
  linked: '顺手做',
};
export const WINDOW_LABEL: Record<TaskWindow, string> = {
  now: '此刻',
  today: '今天',
  later: '不急',
};
export const PRIORITY_LABEL: Record<number, string> = {
  1: '低',
  2: '中',
  3: '高',
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block space-y-1.5">
      <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">{label}</div>
      {children}
    </div>
  );
}

export function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-paper-2/50 p-1 ring-1 ring-rule/50">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-lg px-2 py-1.5 text-center text-xs transition-colors whitespace-nowrap',
            value === o.value ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 一行灰色辅助文案：展示 expectAt / dueAt 等时间字段的解析结果。
 * 点一下变成 datetime-local 输入框，blur 或按 Enter 保存；过期会标红。
 * label 用来区分是「预期」还是「Deadline」。
 */
export function TimeRow({
  label,
  value,
  overdueHint,
  onChange,
}: {
  label: string;
  value: string | null;
  overdueHint: boolean;
  onChange: (iso: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nowMs = useNowTick();
  const now = new Date(nowMs);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="datetime-local"
        defaultValue={isoToLocalInput(value)}
        className="mt-1 w-full rounded-lg border border-rule/60 bg-paper-2/50 px-2 py-1 font-mono text-xs text-ink outline-none focus:border-ink/60"
        aria-label={`编辑 ${label}`}
        onBlur={(e) => {
          const iso = localInputToISO(e.target.value);
          setEditing(false);
          if (iso !== value) onChange(iso);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  const rel = value ? relativeTimeLabel(value, now) : '';
  const abs = value ? formatDueAt(value) : '';
  const overdue = overdueHint && isOverdue(value, now);

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'mt-1 flex w-full items-baseline gap-2 text-left font-mono text-[10px] hover:text-ink-soft',
        overdue ? 'text-red-600 font-semibold' : 'text-ink-mute',
      )}
      aria-label={`编辑 ${label}`}
    >
      <span className="shrink-0 text-ink-mute">{label}</span>
      {value ? (
        <span>
          {abs} · {rel}
        </span>
      ) : (
        <span>→ 点击设置</span>
      )}
    </button>
  );
}
