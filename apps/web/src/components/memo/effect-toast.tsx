'use client';

import { cn } from '@/lib/utils';
import type { IntentEffect } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
import { useEffect, useState } from 'react';

const TONE: Record<IntentEffect['kind'], string> = {
  add: 'border-accent-warm/40 bg-accent-warm/10',
  status: 'border-accent-warm/40 bg-accent-warm/10',
  done: 'border-accent-good/40 bg-accent-good/10',
  'done-backfill': 'border-accent-good/40 bg-accent-good/10',
  modify: 'border-accent-warn/40 bg-accent-warn/10',
  link: 'border-accent-warm/40 bg-accent-warm/10',
  miss: 'border-rule bg-paper-2/80',
};

interface Props {
  effect: IntentEffect | null;
  utterance?: Utterance | null;
}

export function EffectToast({ effect, utterance }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!effect) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, [effect]);

  if (!effect || !visible) return null;

  const title = effect.kind === 'miss' ? '没找到匹配任务' : effect.verb;

  const body = effect.kind === 'miss' ? (utterance?.raw ?? '') : 'text' in effect ? effect.text : '';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 shadow-lg backdrop-blur',
          TONE[effect.kind],
        )}
      >
        <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">{title}</p>
        <p className="mt-0.5 font-serif text-sm text-ink">{body}</p>
        {effect.kind !== 'miss' && effect.reason ? (
          <p className="mt-0.5 text-[11px] text-ink-soft">{effect.reason}</p>
        ) : null}
        {utterance?.dims?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {utterance.dims.map((d, i) => (
              <span
                key={`${d.kind}-${i}`}
                className="rounded-full border border-rule/60 bg-paper/80 px-2 py-0.5 text-[10px] text-ink-soft"
              >
                {d.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
