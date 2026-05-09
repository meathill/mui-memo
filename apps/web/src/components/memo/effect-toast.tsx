'use client';

import type { IntentEffect } from '@mui-memo/shared/logic';
import type { Utterance } from '@mui-memo/shared/validators';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
  effects: IntentEffect[];
  utterance?: Utterance | null;
}

const MAX_VISIBLE = 3;

/**
 * 多 effect 叠层显示。比如一句话拆成两个 ADD，两条小卡片竖向叠在屏幕顶部。
 * 4.5s 后整体消失。
 */
export function EffectToast({ effects, utterance }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!effects.length) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, [effects]);

  if (!effects.length || !visible) return null;
  const list = effects.slice(0, MAX_VISIBLE);
  const more = effects.length - list.length;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-1.5">
        {list.map((effect, i) => {
          const title = effect.kind === 'miss' ? '没找到匹配任务' : effect.verb;
          const body = effect.kind === 'miss' ? (utterance?.raw ?? '') : 'text' in effect ? effect.text : '';
          const reason = effect.kind === 'miss' ? '' : 'reason' in effect ? effect.reason : '';
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: effect 没有 id 时（miss）只能用位置区分；toast 是瞬态、列表不会重排
              key={`${effect.kind}-${'id' in effect ? effect.id : 'miss'}-${i}`}
              className={cn(
                'pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur',
                TONE[effect.kind],
              )}
            >
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-ink-mute">{title}</p>
              <p className="mt-0.5 font-serif text-sm text-ink">{body}</p>
              {reason ? <p className="mt-0.5 text-[11px] text-ink-soft">{reason}</p> : null}
            </div>
          );
        })}
        {more > 0 ? (
          <p className="pointer-events-auto rounded-full bg-paper-2/80 px-3 py-1 text-center text-[11px] text-ink-soft">
            还有 {more} 条
          </p>
        ) : null}
        {utterance?.dims?.length ? (
          <div className="pointer-events-auto flex flex-wrap gap-1">
            {utterance.dims.map((d) => (
              <span
                key={`${d.kind}-${d.label}`}
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
