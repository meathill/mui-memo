"use client";

import { useSearchParams } from "next/navigation";
import { SITE_EMAIL } from "@/lib/site";

/**
 * 根据 URL `?topic=xxx` 显示一个醒目的"打开邮件 · 模板已填好"按钮，
 * 让用户从其它页面（如 /pricing 的 Team 候补 CTA）点过来后能一键
 * 用预填好的 subject / body 写邮件，省去翻找联系方式 + 自己组织语言。
 *
 * 没有 `?topic` 或 topic 没匹配的预设 → 不渲染，contact 页只显示原本的 doc。
 */

interface Preset {
  eyebrow: string;
  title: string;
  description: string;
  subject: string;
  body: string;
  buttonLabel: string;
}

const TOPIC_PRESETS: Record<string, Preset> = {
  "team-waitlist": {
    eyebrow: "Team 候补",
    title: "Team 多人场景 · 候补名单",
    description:
      "点下面的按钮，会用你默认邮件 app 打开一封模板信，主题和正文都已填好。把人数、典型用法补上发出来即可。Team 开放试用时会优先通知到你。",
    subject: "叨叨记 Team 候补名单",
    body:
      "你好 meathill，\n\n" +
      "我想加入 Team 多人场景的候补名单。\n\n" +
      "- 团队 / 家庭 / 店铺人数：\n" +
      "- 典型用法（家务分工 / 项目协作 / 班次接力 / 其他）：\n" +
      "- 联系邮箱（如果跟当前发件邮箱不一致）：\n" +
      "- 其他想说的：\n\n" +
      "谢谢！",
    buttonLabel: "打开邮件 · 模板已填好",
  },
  "data-deletion": {
    eyebrow: "数据删除",
    title: "账号 / 输入记录 / 归档录音 删除请求",
    description:
      "点下面按钮发邮件给我，注明要删除的范围（账号 / 全部输入历史 / 某段时间归档）。7 天内处理完会回邮件确认。",
    subject: "叨叨记 数据删除请求",
    body:
      "你好 meathill，\n\n" +
      "我希望删除以下数据：\n\n" +
      "- 注册邮箱：\n" +
      "- 删除范围（账号 / 输入记录 / 归档录音 / 全部）：\n" +
      "- 期望生效时间：\n\n" +
      "谢谢！",
    buttonLabel: "打开邮件 · 提交删除请求",
  },
  bug: {
    eyebrow: "Bug 反馈",
    title: "报告一个具体的 bug",
    description:
      "把当时说的话、期望的结果、实际发生了什么、设备 / 浏览器 / iOS 版本写清楚，复现概率会大大增加。",
    subject: "叨叨记 Bug 反馈",
    body:
      "你好 meathill，\n\n" +
      "遇到了一个 bug：\n\n" +
      "- 我说的那句话：\n" +
      "- 期望的结果：\n" +
      "- 实际发生了什么：\n" +
      "- 设备 / 浏览器 / iOS 版本：\n" +
      "- 发生时间（精确到分钟）：\n" +
      "- 截图 / 录屏（可选附件）：\n\n" +
      "谢谢！",
    buttonLabel: "打开邮件 · 提交 bug 报告",
  },
};

export function TopicAwareEmailComposer() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");
  const preset = topic ? TOPIC_PRESETS[topic] : null;
  if (!preset) return null;

  const href = `mailto:${SITE_EMAIL}?subject=${encodeURIComponent(preset.subject)}&body=${encodeURIComponent(preset.body)}`;

  return (
    <aside className="not-prose mb-10 rounded-2xl border border-accent-warm/40 bg-accent-warm/8 px-5 py-6 sm:px-7 sm:py-7">
      <p className="font-mono text-[0.72rem] tracking-[0.16em] text-accent-warm uppercase sm:text-[0.78rem]">
        {preset.eyebrow}
      </p>
      <h2 className="font-serif mt-3 text-[1.7rem] leading-tight text-ink sm:text-[1.85rem]">
        {preset.title}
      </h2>
      <p className="mt-3 max-w-[44rem] text-[0.98rem] leading-[1.7] text-ink-soft sm:text-[1.04rem]">
        {preset.description}
      </p>
      <a
        href={href}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-accent-warm px-5 py-3 font-mono text-[0.78rem] tracking-[0.16em] text-paper uppercase transition-opacity hover:opacity-85"
      >
        {preset.buttonLabel}
      </a>
    </aside>
  );
}
