"use client";

import { useEffect, useRef, useState } from "react";

type Frame = {
  stage: string;
  quote: string;
  label: string;
  lines: Array<{ k: string; v: string }>;
};

const FRAMES: Frame[] = [
  {
    stage: "帧 01 · 录入",
    quote: "下午三点前给老张转五百。",
    label: "一句话建立任务",
    lines: [
      { k: "意图", v: "新增任务" },
      { k: "标签", v: "财务" },
      { k: "截止", v: "今日 15:00" },
      { k: "优先级", v: "高" },
    ],
  },
  {
    stage: "帧 02 · 归堆",
    quote: "我要登网银打款了。",
    label: "声明状态，自动挑相关的",
    lines: [
      { k: "状态", v: "网银 / 转账" },
      { k: "归堆", v: "给老张转 500" },
      { k: "归堆", v: "退 3 号桌押金" },
      { k: "其余", v: "先按下不表" },
    ],
  },
  {
    stage: "帧 03 · 完成",
    quote: "老张的钱打过了。",
    label: "说一声就勾掉，不用找",
    lines: [
      { k: "意图", v: "补登完成" },
      { k: "命中", v: "「给老张转 500」" },
      { k: "状态", v: "已勾 ✓" },
      { k: "耗时", v: "3 秒" },
    ],
  },
];

const INTERVAL = 4200;

export function HeroDemo() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % FRAMES.length);
    }, INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-sm border border-rule/70 bg-paper-2/40">
        <div className="flex items-center justify-between border-b border-rule/50 px-6 py-3">
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
            {FRAMES[idx].stage}
          </p>
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
            {String(idx + 1).padStart(2, "0")} /{" "}
            {FRAMES.length.toString().padStart(2, "0")}
          </p>
        </div>

        <div className="relative min-h-[18rem] px-6 py-7">
          {FRAMES.map((f, i) => (
            <div
              key={f.stage}
              aria-hidden={i !== idx}
              className={`absolute inset-0 px-6 py-7 transition-[opacity,transform] duration-[520ms] ease-[cubic-bezier(.22,.61,.36,1)] ${
                i === idx
                  ? "opacity-100 translate-y-0"
                  : i < idx
                    ? "-translate-y-3 opacity-0"
                    : "translate-y-3 opacity-0"
              }`}
            >
              <p className="font-serif text-xl leading-snug text-ink sm:text-[1.4rem]">
                <span className="select-none text-accent-warm/70">「</span>
                {f.quote}
                <span className="select-none text-accent-warm/70">」</span>
              </p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
                ↓ {f.label}
              </p>
              <div className="mt-5 space-y-1.5 font-mono text-[11px] text-ink-soft">
                {f.lines.map((l) => (
                  <div
                    key={`${l.k}-${l.v}`}
                    className="flex items-baseline gap-3"
                  >
                    <span className="w-16 text-ink-mute">{l.k}</span>
                    <span className="text-ink">{l.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border-t border-rule/50 px-6 py-3">
          {FRAMES.map((f, i) => (
            <button
              key={f.stage}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`切到${f.stage}`}
              className={`h-1 rounded-full transition-all ${
                i === idx
                  ? "w-8 bg-accent-warm"
                  : "w-4 bg-ink-mute/40 hover:bg-ink-mute/70"
              }`}
            />
          ))}
          <span className="ml-auto font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
            {paused ? "已暂停" : "自动演示"}
          </span>
        </div>
      </div>

      <p className="mt-4 text-right font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
        ↑ 一个完整的生活片段
      </p>
    </div>
  );
}
