'use client';

import { useNowTick } from '@/hooks/use-now-tick';
import { isOverdue, relativeTimeLabel } from '@/lib/time';
import { cn } from '@/lib/utils';
import { PLACE_LABEL, type TaskView } from '@mui-memo/shared/logic';
import { CheckIcon } from 'lucide-react';
import Link from 'next/link';

interface Props {
  task: TaskView;
  onDone: (id: string) => void | Promise<void>;
}

export function DoingCard({ task, onDone }: Props) {
  const nowMs = useNowTick();
  const now = new Date(nowMs);
  const anchor = task.expectAt ?? task.dueAt ?? null;
  const dynamicLabel = relativeTimeLabel(anchor, now);
  const overdue = !task.done && isOverdue(anchor, now);
  const displayLabel = dynamicLabel || task.deadline || '';

  return (
    <div className="mm-pulse rounded-2xl border border-accent-warm/40 bg-gradient-to-br from-accent-warm/10 to-paper-2/60 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-accent-warm uppercase">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-warm" />
        正在做
      </div>
      <Link
        href={`/app/tasks/${task.id}`}
        prefetch={false}
        className="mt-1 block font-serif text-xl leading-snug text-ink hover:underline"
      >
        {task.text}
      </Link>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-mono text-ink-mute">
        <span>
          {PLACE_LABEL[task.place].icon} {PLACE_LABEL[task.place].label}
        </span>
        {displayLabel ? (
          <span
            className={cn(overdue && 'text-red-600 font-semibold', !overdue && 'text-ink-mute')}
          >
            · ⏱ {displayLabel}
          </span>
        ) : null}
        {task.aiReason ? <span>· {task.aiReason}</span> : null}
      </div>

      {task.linked?.length ? (
        <ul className="mt-3 space-y-1 border-t border-rule/50 pt-2">
          {task.linked.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm text-ink-soft font-serif">
              <span className="text-accent-warm/70">↳</span>
              {c.text}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => onDone(task.id)}
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs text-paper',
          'transition-transform active:scale-95',
        )}
      >
        <CheckIcon className="h-3.5 w-3.5" />
        搞定了
      </button>
    </div>
  );
}
