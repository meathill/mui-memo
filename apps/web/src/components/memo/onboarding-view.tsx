"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Slide {
  tag: string;
  title: string;
  body: string;
  hint: string;
}

const SLIDES: Slide[] = [
  {
    tag: "01 · 核心",
    title: "说一句话，记一件事",
    body: "按住下面的麦克风，把脑子里闪过的小事直接说出来。不用打字、不用分标签，AI 自动帮你提炼成一条任务。",
    hint: "示例：「等下记得给王老板转 500」",
  },
  {
    tag: "02 · 场景",
    title: "切换场景，能做的自然浮上来",
    body: "顶部的 🏠/💼/🚶 是你现在的位置或状态。换一下，清单就自动过滤出「此刻可做」的事。",
    hint: "用「我在公司」这种话也能切换。",
  },
  {
    tag: "03 · 正在做",
    title: "一次只专注一件",
    body: "说「我现在去银行办转账」就会把相关任务 pinned 到顶端，其它事先冻起来。",
    hint: "想再顺手做一件？说「顺便把物业费也交了」。",
  },
  {
    tag: "04 · 勾掉",
    title: "完成了，说一声就好",
    body: "「水买了」「老张那个打款了」——AI 会在清单里找到对应任务划掉。找不到也不怕，它会补记为已完成。",
    hint: "也可以点任务左边的小圆圈手动勾。",
  },
  {
    tag: "05 · 开始",
    title: "准备好啦",
    body: "剩下的事都交给你的嘴。",
    hint: "",
  },
];

export function OnboardingView() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  function finish() {
    try {
      window.localStorage.setItem("muimemo:onboarded", "1");
    } catch {}
    router.replace("/");
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
          <button
            type="button"
            onClick={finish}
            className="hover:text-ink-soft"
          >
            跳过
          </button>
        </div>

        <div className="mt-10 flex flex-1 flex-col">
          <h1 className="font-serif text-3xl leading-tight text-ink">
            {slide.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            {slide.body}
          </p>
          {slide.hint ? (
            <p className="mt-6 rounded-xl border border-rule/60 bg-paper-2/50 px-4 py-3 font-mono text-xs text-ink-mute">
              {slide.hint}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (i === idx ? "w-6 bg-ink" : "w-1.5 bg-ink-mute/30")
                }
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
            {isLast ? "开始使用" : "下一步"}
          </Button>
        </div>
      </div>
    </main>
  );
}
