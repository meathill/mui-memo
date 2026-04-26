'use client';

import { useEffect, useState } from 'react';

type Frame = {
  step: string;
  stage: string;
  quote: string;
  label: string;
  summary: string;
  lines: Array<{ k: string; v: string }>;
};

const FRAMES: Frame[] = [
  {
    step: '01',
    stage: '记下',
    quote: '明天下午给老张转五百。',
    label: '一句话先收成待办',
    summary: 'AI 先判断你要做什么，再补进清单。',
    lines: [
      { k: '动作', v: '新增任务' },
      { k: '内容', v: '给老张转 500' },
      { k: '时间', v: '明日 15:00 前' },
      { k: '紧急', v: '较高' },
    ],
  },
  {
    step: '02',
    stage: '切场景',
    quote: '我到公司了，开始处理账。',
    label: '换到此刻能做的那一堆',
    summary: '不是全盘重排，而是让相关事项先浮出来。',
    lines: [
      { k: '状态', v: '网银 / 转账' },
      { k: '浮出', v: '给老张转 500' },
      { k: '浮出', v: '退 3 号桌押金' },
      { k: '其余', v: '先安静待着' },
    ],
  },
  {
    step: '03',
    stage: '正在做',
    quote: '我现在去网银转账。',
    label: '先把当前这一件顶到前面',
    summary: '进入单线程模式，顺手项也能被带出来。',
    lines: [
      { k: '正在做', v: '招行转账确认' },
      { k: '顺手', v: '物业费' },
      { k: '其它', v: '暂时收起' },
      { k: '目的', v: '别被别的事打断' },
    ],
  },
  {
    step: '04',
    stage: '完成',
    quote: '老张那笔已经打了。',
    label: '说一声就勾掉，不用翻找',
    summary: '说的是结果，系统处理的是对应任务状态。',
    lines: [
      { k: '动作', v: '补登完成' },
      { k: '命中', v: '「给老张转 500」' },
      { k: '状态', v: '已勾 ✓' },
      { k: '下一条', v: '继续处理账单' },
    ],
  },
];

const INTERVAL = 4200;

export function HeroDemo() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setIdx((i) => (i + 1) % FRAMES.length);
    }, INTERVAL);
    return () => {
      window.clearInterval(timer);
    };
  }, [paused]);

  function handleSelect(index: number) {
    setIdx(index);
  }

  return (
    <section
      className="relative"
      aria-label="预览演示"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-sm border border-rule/70 bg-paper-2/40">
        <div className="flex items-center justify-between border-b border-rule/50 px-5 py-3 sm:px-6">
          <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
            {FRAMES[idx].step} · {FRAMES[idx].stage}
          </p>
          <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
            {String(idx + 1).padStart(2, '0')} / {FRAMES.length.toString().padStart(2, '0')}
          </p>
        </div>

        <div className="relative min-h-[17rem] px-5 py-6 sm:min-h-[18rem] sm:px-6 sm:py-7">
          {FRAMES.map((f, i) => (
            <div
              key={f.stage}
              aria-hidden={i !== idx}
              className={`absolute inset-0 px-5 py-6 transition-[opacity,transform] duration-[520ms] ease-[cubic-bezier(.22,.61,.36,1)] sm:px-6 sm:py-7 ${
                i === idx
                  ? 'opacity-100 translate-y-0'
                  : i < idx
                    ? '-translate-y-3 opacity-0'
                    : 'translate-y-3 opacity-0'
              }`}
            >
              <p className="font-serif text-[1.45rem] leading-[1.4] text-ink sm:text-[1.62rem]">
                <span className="select-none text-accent-warm/70">「</span>
                {f.quote}
                <span className="select-none text-accent-warm/70">」</span>
              </p>
              <p className="mt-1 font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
                ↓ {f.label}
              </p>
              <p className="mt-4 text-[0.98rem] leading-[1.7] text-ink-soft sm:text-[1.02rem] sm:whitespace-nowrap">
                {f.summary}
              </p>
              <div className="mt-5 space-y-1.5 font-mono text-[0.8rem] text-ink-soft sm:text-[0.86rem]">
                {f.lines.map((l) => (
                  <div key={`${l.k}-${l.v}`} className="flex items-baseline gap-3">
                    <span className="w-16 text-ink-mute sm:w-[4.5rem]">{l.k}</span>
                    <span className="text-ink">{l.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border-t border-rule/50 px-5 py-3 sm:px-6">
          {FRAMES.map((f, i) => (
            <button
              key={f.stage}
              type="button"
              onClick={() => handleSelect(i)}
              aria-label={`切到${f.stage}`}
              className={`h-1 rounded-full transition-all ${
                i === idx ? 'w-8 bg-accent-warm' : 'w-4 bg-ink-mute/40 hover:bg-ink-mute/70'
              }`}
            />
          ))}
          <span className="ml-auto font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
            {paused ? '已暂停' : '自动演示'}
          </span>
        </div>
      </div>

      <p className="mt-3 text-right font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
        ↑ 从一句话到完成的四步闭环
      </p>
    </section>
  );
}
