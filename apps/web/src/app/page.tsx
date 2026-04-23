import Link from "next/link";
import { HeroDemo } from "@/components/landing/hero-demo";
import { buttonVariants } from "@/components/ui/button-variants";
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
        <p className="font-serif mt-8 max-w-[30ch] text-lg leading-relaxed text-ink-soft sm:text-xl">
          按住说一句。
          <br />
          时间、优先级、归哪一堆，AI 都替你想好。
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
        <HeroDemo />
      </aside>
    </section>
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

const ROLES: Array<{
  tag: string;
  who: string;
  context: string;
  line: string;
  effect: string;
}> = [
  {
    tag: "小卖铺店主",
    who: "王姐",
    context: "货架和收银台之间连轴转，手常常是脏的。打字这事儿，根本没空。",
    line: "晚上给老张结 3000 尾款。",
    effect:
      "记下了。晚上她对着手机说一句「要打款了」，当天所有转账任务一起摆出来，一口气清。",
  },
  {
    tag: "带娃的人",
    who: "李妈",
    context: "两岁娃的一天像打仗，宝宝睡着的十分钟要清一堆小事。",
    line: "明天早上带娃去打疫苗，记得带出生证。",
    effect:
      "自动拆成『打疫苗』+『带出生证』两件事，都归到明早。出门前看一眼清单，啥都不落下。",
  },
  {
    tag: "自由职业者",
    who: "接单的设计师小杨",
    context: "三个客户同时催不同的事，脑子里一团线。",
    line: "开始做 A 客户的 logo。",
    effect:
      "切到『A 客户』模式，这位客户的 5 条散落任务全调出来——别的先冻结，不打扰。",
  },
];

function Scenarios() {
  return (
    <section id="scenes" className="py-24 sm:py-32">
      <SectionHead
        number="01"
        label="谁在用"
        title="三种人，三双忙不过来的手。"
      />
      <div className="mt-16 space-y-14">
        {ROLES.map((r) => (
          <article
            key={r.tag}
            className="grid gap-5 sm:grid-cols-[10rem_1fr] sm:gap-10"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase sm:pt-3">
              {r.tag}
            </p>
            <div>
              <p className="font-serif text-lg text-ink sm:text-xl">
                {r.who}
                <span className="ml-3 text-ink-soft">·</span>
                <span className="ml-3 text-ink-soft">{r.context}</span>
              </p>
              <p className="font-serif mt-5 text-2xl leading-relaxed text-ink sm:text-3xl">
                <span className="select-none text-accent-warm/70">「</span>
                {r.line}
                <span className="select-none text-accent-warm/70">」</span>
              </p>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-ink-soft">
                <span className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
                  → MuiMemo
                </span>{" "}
                {r.effect}
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
    title: "说什么 = 做什么",
    body: "不分字段、不挑标签。一句大白话，AI 替你拆成「做什么 / 什么时候 / 多急」。",
  },
  {
    n: "02",
    title: "记了就找得到",
    body: "「上次那个给老张转钱的事」也能找出来——不用背关键词，像翻手账。",
  },
  {
    n: "03",
    title: "像本手账，不像软件",
    body: "三种主题、三种勾选动画，按自己习惯调。用完就合上，不抢注意力。",
  },
];

function Principles() {
  return (
    <section className="py-24 sm:py-32">
      <SectionHead number="02" label="核心" title="三件事，做到底。" />
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
      title: "网页版 · 先用起来",
      body: "说一句话就记下，想找就搜到。手机浏览器打开就能用，也能装进主屏幕当 app。",
      phase: "done",
    },
    {
      n: "Phase 2",
      title: "iOS App · 把体验做到位",
      body: "不用打开 app，对 Siri 说一句就记下。录音当场看到文字，锁屏也能瞄一眼在录什么。到点了手机会准时提醒。",
      phase: "active",
    },
    {
      n: "Phase 3",
      title: "日常延伸",
      body: "iCloud 同步、主屏小组件、一秒进入录音——让 MuiMemo 藏在手指最方便的地方。",
      phase: "planned",
    },
    {
      n: "Phase 4",
      title: "桌面端串联",
      body: "电脑前敲字也顺手，手机和桌面保持一致，换设备不用重新适应。",
      phase: "planned",
    },
  ];

function Roadmap() {
  return (
    <section id="roadmap" className="py-24 sm:py-32">
      <SectionHead number="03" label="Roadmap" title="一步一步来。" />
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
    a: "当前网页版需要联网——说的话要交给 AI 去听、去理解，结果也要存到云端。Phase 2 的 iOS App 会支持常用操作离线。",
  },
  {
    q: "能准时提醒我吗？",
    a: "网页版暂时不太行——浏览器的提醒在手机上不稳定。准时提醒留给我们正在做的 iOS App，用系统闹钟才靠谱。",
  },
  {
    q: "支持方言 / 口音吗？",
    a: "普通话和带口音普通话基本都能听懂。粤语、川话这些方言实测因人而异，建议先说几句短的试试。",
  },
  {
    q: "我说的话会被拿去训练 AI 吗？",
    a: "不会。录音只用于当次识别，可选归档也只有你能看。想删的话「输入记录」页一键清掉。",
  },
  {
    q: "要收费吗？",
    a: "现在是我的个人项目，免费注册用。如果将来要收，我会先跟你讲清楚再调整，不会突然。",
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
