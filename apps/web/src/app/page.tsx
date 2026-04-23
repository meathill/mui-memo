import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getServerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getServerSession();
  const authed = Boolean(session);

  return (
    <main className="relative mx-auto w-full max-w-[68rem] px-6 pb-32 sm:px-10">
      <TopBar authed={authed} />
      <Hero authed={authed} />
      <Rule />
      <Scenarios />
      <Rule />
      <Principles />
      <Rule />
      <Roadmap />
      <Rule />
      <Faq />
      <Colophon />
    </main>
  );
}

function TopBar({ authed }: { authed: boolean }) {
  return (
    <header className="flex items-center justify-between pt-8 pb-12 sm:pt-10">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-[0.28em] text-ink uppercase"
      >
        MuiMemo
      </Link>
      <nav className="flex items-center gap-5 font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
        <a href="#scenes" className="hover:text-ink">
          场景
        </a>
        <a href="#roadmap" className="hover:text-ink">
          Roadmap
        </a>
        <a href="#faq" className="hover:text-ink">
          FAQ
        </a>
        {authed ? (
          <Link href="/app" className="text-accent-warm hover:text-ink">
            进入应用 →
          </Link>
        ) : (
          <Link href="/login" className="hover:text-ink">
            登录
          </Link>
        )}
      </nav>
    </header>
  );
}

function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="grid gap-10 pt-6 pb-20 sm:grid-cols-[1.2fr_1fr] sm:gap-16 sm:pb-32">
      <div>
        <p className="font-mono text-[10px] tracking-[0.32em] text-ink-mute uppercase">
          00 · 口述备忘
        </p>
        <h1 className="font-serif mt-6 text-[clamp(2.6rem,6.2vw,5.2rem)] leading-[1.08] tracking-tight text-ink">
          说一句话，
          <br />
          就是一条<span className="text-accent-warm">备忘</span>。
        </h1>
        <p className="font-serif mt-8 max-w-[28ch] text-lg leading-relaxed text-ink-soft sm:text-xl">
          AI 语音驱动的轻量任务调度。
          <br />
          按住说，意图、时间、地点、优先级，交给模型拆。
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {authed ? (
            <Link
              href="/app"
              className={`${buttonVariants({ size: "lg" })} px-6`}
            >
              进入应用
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className={`${buttonVariants({ size: "lg" })} px-6`}
              >
                免费注册
              </Link>
              <Link
                href="/login"
                className="font-mono text-[11px] tracking-[0.2em] text-ink-soft uppercase underline-offset-4 hover:text-ink hover:underline"
              >
                已有账号 · 登录
              </Link>
            </>
          )}
        </div>
      </div>

      <aside className="relative self-end">
        <div className="rounded-sm border border-rule/70 bg-paper-2/40 p-6">
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
            示例 · 录入一条
          </p>
          <p className="font-serif mt-4 text-xl leading-snug text-ink">
            「下午三点前给老张转五百。」
          </p>
          <div className="mt-5 space-y-1.5 font-mono text-[11px] text-ink-soft">
            <Field k="意图" v="ADD" />
            <Field k="标签" v="财务" />
            <Field k="deadline" v="今日 15:00" />
            <Field k="优先级" v="高" />
          </div>
        </div>
        <p className="mt-4 text-right font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
          ↑ 模型拆解片段
        </p>
      </aside>
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 text-ink-mute">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}

function Rule() {
  return (
    <div
      aria-hidden
      className="h-px w-full bg-rule/60 sm:my-4"
      role="presentation"
    />
  );
}

const SCENES: Array<{ where: string; quote: string; effect: string }> = [
  {
    where: "通勤 · 7 点 52 分",
    quote: "今晚睡前记得给小宝打电话。",
    effect: "新增「给小宝打电话」，时间『今晚』，地点『在家』，软截止。",
  },
  {
    where: "工位 · 会议中",
    quote: "刚那个想法——下周把埋点数据拉一版给产品看。",
    effect: "新增「拉埋点数据给产品」，标签『工作』，优先级中，窗口『下周』。",
  },
  {
    where: "厨房 · 刚洗完碗",
    quote: "碗洗了。",
    effect: "识别为 DONE 补登，匹配到昨晚那条「洗碗」并标记完成。",
  },
];

function Scenarios() {
  return (
    <section id="scenes" className="py-24 sm:py-32">
      <SectionHead number="01" label="场景" title="你说什么，它听什么。" />
      <div className="mt-16 space-y-14">
        {SCENES.map((s) => (
          <article
            key={s.where}
            className="grid gap-5 sm:grid-cols-[10rem_1fr] sm:gap-10"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase sm:pt-3">
              {s.where}
            </p>
            <div>
              <p className="font-serif text-2xl leading-relaxed text-ink sm:text-3xl">
                <span className="select-none text-accent-warm/70">「</span>
                {s.quote}
                <span className="select-none text-accent-warm/70">」</span>
              </p>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-soft">
                <span className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
                  → 效果
                </span>{" "}
                {s.effect}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const PRINCIPLES: Array<{ n: string; title: string; body: string }> = [
  {
    n: "01",
    title: "意图闭环",
    body: "新增 / 完成 / 关联 / 补登 由模型判断，不让用户自己分流。过期任务红标，AI 会给调度建议。",
  },
  {
    n: "02",
    title: "混合搜索",
    body: "TiDB 向量 + 全文检索，RRF 融合排序。「上次那个」也能被找到——不依赖精确匹配关键词。",
  },
  {
    n: "03",
    title: "纸感轻量",
    body: "手账一样的排版与节奏。三主题（Paper / Night / Mono），勾选动画三变体，按习惯调。",
  },
];

function Principles() {
  return (
    <section className="py-24 sm:py-32">
      <SectionHead number="02" label="核心" title="三件事做到底，别的不做。" />
      <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-10">
        {PRINCIPLES.map((p) => (
          <article key={p.n}>
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent-warm uppercase">
              {p.n} / 03
            </p>
            <h3 className="font-serif mt-4 text-2xl text-ink">{p.title}</h3>
            <p className="mt-3 max-w-[32ch] text-[14px] leading-relaxed text-ink-soft">
              {p.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

type Phase = "done" | "active" | "planned";

const ROADMAP: Array<{ n: string; title: string; body: string; phase: Phase }> =
  [
    {
      n: "Phase 1",
      title: "Web MVP · 验证语音能力",
      body: "语音意图闭环、TiDB 混合搜索、附件与输入记录、PWA 可安装。",
      phase: "done",
    },
    {
      n: "Phase 2",
      title: "iOS App · 体验做到位",
      body: "Siri / Shortcuts 入口、端侧 ASR 实时转写、Live Activity 录音反馈、本地定时提醒、TaskSheet 抽屉。",
      phase: "active",
    },
    {
      n: "Phase 3",
      title: "Native Features · 延伸",
      body: "端侧 LLM 标签化（Foundation Models）、iCloud 同步、Widget 与锁屏入口。",
      phase: "planned",
    },
    {
      n: "Phase 4",
      title: "Desktop Worker · 串联",
      body: "桌面录入入口，与 mobile 同步；跨设备统一调度。",
      phase: "planned",
    },
  ];

function Roadmap() {
  return (
    <section id="roadmap" className="py-24 sm:py-32">
      <SectionHead number="03" label="Roadmap" title="四步走完。" />
      <ol className="mt-16 space-y-12 sm:space-y-14">
        {ROADMAP.map((item, i) => (
          <li
            key={item.n}
            className="grid gap-5 sm:grid-cols-[10rem_1fr] sm:gap-10"
          >
            <div className="flex items-baseline gap-3 sm:pt-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
                {String(i + 1).padStart(2, "0")} · {item.n}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h3 className="font-serif text-2xl text-ink">{item.title}</h3>
                <PhaseTag phase={item.phase} />
              </div>
              <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-ink-soft">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PhaseTag({ phase }: { phase: Phase }) {
  const label =
    phase === "done" ? "已交付" : phase === "active" ? "进行中" : "规划中";
  const cls =
    phase === "done"
      ? "text-ink-mute border-rule/70"
      : phase === "active"
        ? "text-accent-warm border-accent-warm/50"
        : "text-ink-mute border-rule/70";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "一定要联网吗？能离线用吗？",
    a: "当前 web 版需要联网——语音识别走 Gemini，存储走 TiDB。Phase 2 的 iOS App 会接端侧 ASR，常用操作能离线。",
  },
  {
    q: "语音数据会被用来训练模型吗？",
    a: "不会。音频只用于当次意图解析 + 可选归档（R2，仅你可访问）。你可以随时在「输入记录」页查看并删除原始语音。",
  },
  {
    q: "支持中文口音 / 方言吗？",
    a: "普通话和常见带口音普通话基本可用。粤语、川话等方言当前由底层模型决定，实测精度因人而异，建议先短句试一试。",
  },
  {
    q: "为什么 Web 版不做提醒通知？",
    a: "Web Push 在 iOS 上的可靠性不够——iOS 必须安装为 PWA、后台容易被系统回收、没有送达回执。提醒通知留给 Phase 2 的 native，用系统闹钟 API 才能准点。",
  },
  {
    q: "收费吗？",
    a: "当前是我个人项目，免费注册使用。未来若要覆盖模型与存储成本，会先告知再调整，不会突然收费。",
  },
];

function Faq() {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <SectionHead number="04" label="FAQ" title="你可能想问。" />
      <dl className="mt-16 space-y-10">
        {FAQ.map((item, i) => (
          <div
            key={item.q}
            className="grid gap-4 sm:grid-cols-[3rem_1fr] sm:gap-8"
          >
            <dt className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase sm:pt-1">
              Q.{String(i + 1).padStart(2, "0")}
            </dt>
            <div>
              <p className="font-serif text-xl text-ink sm:text-[1.4rem]">
                {item.q}
              </p>
              <dd className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
                {item.a}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SectionHead({
  number,
  label,
  title,
}: {
  number: string;
  label: string;
  title: string;
}) {
  return (
    <header className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:gap-10">
      <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase sm:pt-3">
        {number} · {label}
      </p>
      <h2 className="font-serif text-[clamp(1.8rem,3.4vw,2.8rem)] leading-tight text-ink">
        {title}
      </h2>
    </header>
  );
}

function Colophon() {
  return (
    <footer className="mt-10 flex flex-wrap items-baseline justify-between gap-4 border-t border-rule/60 pt-8 font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
      <span>MuiMemo · v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      <span>
        <Link href="/login" className="hover:text-ink">
          登录
        </Link>
        <span className="mx-2 text-ink-mute/50">/</span>
        <Link href="/register" className="hover:text-ink">
          注册
        </Link>
      </span>
      <span>Made by meathill · paper, deliberate, calm</span>
    </footer>
  );
}
