'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MicIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface Slide {
  tag: string;
  title: string;
  body: string;
  hint: string;
  demo?: 'mic' | 'scene' | 'doing' | 'check';
}

const SLIDES: Slide[] = [
  {
    tag: '01 · 核心',
    title: '说一句话，记一件事',
    body: '按住下面的麦克风，把脑子里闪过的小事直接说出来。不用打字、不用分标签，AI 自动帮你提炼成一条任务。',
    hint: '示例：「等下记得给王老板转 500」',
    demo: 'mic',
  },
  {
    tag: '02 · 场景',
    title: '切换场景，能做的自然浮上来',
    body: '顶部的 🏠/💼/🚶 是你现在的位置或状态。换一下，清单就自动过滤出「此刻可做」的事。',
    hint: '用「我在公司」这种话也能切换。',
    demo: 'scene',
  },
  {
    tag: '03 · 正在做',
    title: '一次只专注一件',
    body: '说「我现在去银行办转账」就会把相关任务 pinned 到顶端，其它事先冻起来。',
    hint: '想再顺手做一件？说「顺便把物业费也交了」。',
    demo: 'doing',
  },
  {
    tag: '04 · 勾掉',
    title: '完成了，说一声就好',
    body: '「水买了」「老张那个打款了」——AI 会在清单里找到对应任务划掉。找不到也不怕，它会补记为已完成。',
    hint: '也可以点任务左边的小圆圈手动勾。',
    demo: 'check',
  },
  {
    tag: '05 · 开始',
    title: '准备好啦',
    body: '剩下的事都交给你的嘴。',
    hint: '',
  },
];

export function OnboardingView() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  function finish() {
    try {
      window.localStorage.setItem('muimemo:onboarded', '1');
    } catch {}
    router.replace('/app');
  }

  function next() {
    if (isLast) finish();
    else setIdx(idx + 1);
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col px-6 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex justify-between font-mono text-[11px] text-ink-mute">
          <span>{slide.tag}</span>
          <button type="button" onClick={finish} className="hover:text-ink-soft">
            跳过
          </button>
        </div>

        <div className="mt-10 flex flex-col">
          <h1 className="font-serif text-3xl leading-tight text-ink">{slide.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">{slide.body}</p>
          {slide.hint ? (
            <p className="mt-6 rounded-xl border border-rule/60 bg-paper-2/50 px-4 py-3 font-mono text-xs text-ink-mute">
              {slide.hint}
            </p>
          ) : null}
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <SlideDemo kind={slide.demo} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === idx ? 'w-6 bg-ink' : 'w-1.5 bg-ink-mute/30',
                )}
              />
            ))}
          </div>
          <div className="flex-1" />
          {idx > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setIdx(idx - 1)}>
              上一步
            </Button>
          ) : null}
          <Button onClick={next} size="lg">
            {isLast ? '开始使用' : '下一步'}
          </Button>
        </div>
      </div>
    </main>
  );
}

function SlideDemo({ kind }: { kind?: Slide['demo'] }) {
  if (kind === 'mic') return <DemoMic />;
  if (kind === 'scene') return <DemoScene />;
  if (kind === 'doing') return <DemoDoing />;
  if (kind === 'check') return <DemoCheck />;
  return null;
}

/**
 * 按住演示用的麦克风，只做视觉反馈——不真的调 MediaRecorder。
 * 松手就回到 idle。
 */
function DemoMic() {
  const [active, setActive] = useState(false);

  const stop = useCallback(() => setActive(false), []);
  useEffect(() => {
    if (!active) return;
    // 手指/鼠标移出页面时也要收尾
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
  }, [active, stop]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onMouseDown={() => setActive(true)}
        onTouchStart={() => setActive(true)}
        onTouchEnd={() => setActive(false)}
        className={cn(
          'relative flex h-20 w-20 items-center justify-center rounded-full transition-all touch-manipulation select-none',
          'bg-ink text-paper shadow-lg shadow-ink/25 active:scale-95',
          active && 'bg-accent-warm shadow-accent-warm/30 scale-105',
        )}
        aria-label="演示：按住说话"
      >
        {active ? (
          <div className="flex h-8 items-end gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="mm-bar w-1 rounded-full bg-paper"
                style={{ height: '100%', animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        ) : (
          <MicIcon className="h-7 w-7" />
        )}
      </button>
      <p className="h-4 font-mono text-[11px] text-ink-mute">
        {active ? '松开就结束（演示）' : '试试按住 →'}
      </p>
    </div>
  );
}

function DemoScene() {
  const [active, setActive] = useState<'home' | 'work' | 'out'>('home');
  const options: Array<{
    v: 'home' | 'work' | 'out';
    icon: string;
    label: string;
  }> = [
    { v: 'home', icon: '🏠', label: '在家' },
    { v: 'work', icon: '💼', label: '在公司' },
    { v: 'out', icon: '🚶', label: '在外' },
  ];
  return (
    <div className="flex rounded-full bg-paper p-1 text-xs shadow-xs/5 ring-1 ring-rule/50">
      {options.map((o) => (
        <button
          type="button"
          key={o.v}
          onClick={() => setActive(o.v)}
          className={cn(
            'rounded-full px-3 py-1.5 transition-colors',
            active === o.v ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}

function DemoDoing() {
  return (
    <div className="mm-pulse w-full rounded-2xl border border-accent-warm/40 bg-gradient-to-br from-accent-warm/10 to-paper-2/60 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-accent-warm uppercase">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-warm" />
        正在做
      </div>
      <p className="mt-1 font-serif text-lg leading-snug text-ink">招行转账确认</p>
      <p className="mt-2 text-xs text-ink-soft font-serif">
        <span className="text-accent-warm/70">↳</span> 顺手：付物业费
      </p>
    </div>
  );
}

function DemoCheck() {
  const [checked, setChecked] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setChecked((v) => !v)}
      className="flex items-center gap-3 rounded-2xl border border-rule/60 bg-paper-2/40 px-4 py-3 text-left select-none"
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-accent-good bg-accent-good text-paper' : 'border-ink-mute/50',
        )}
      >
        {checked ? '✓' : null}
      </span>
      <span className={cn('font-serif text-base text-ink', checked && 'mm-strike text-ink-soft')}>
        带水
      </span>
    </button>
  );
}
