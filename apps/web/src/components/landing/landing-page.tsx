import Image from 'next/image';
import Link from 'next/link';
import {
  BENEFITS,
  EXPLAINERS,
  FAQ,
  ROADMAP,
  SCENES,
  type Phase,
  type Scene,
} from '@/components/landing/landing-content';
import { HeroDemo } from '@/components/landing/hero-demo';
import { buttonVariants } from '@/components/ui/button-variants';

type LandingPageProps = {
  authed: boolean;
};

export function LandingPageView({ authed }: LandingPageProps) {
  return (
    <main className="relative mx-auto w-full max-w-[72rem] px-6 pb-28 sm:px-10 lg:px-12">
      <TopBar authed={authed} />
      <Hero authed={authed} />
      <Rule />
      <ExplainSection />
      <Rule />
      <ScenesSection />
      <Rule />
      <BenefitsSection />
      <Rule />
      <RoadmapSection />
      <Rule />
      <FaqSection />
      <Colophon />
    </main>
  );
}

function TopBar({ authed }: { authed: boolean }) {
  return (
    <header className="flex items-center justify-between pt-8 pb-12 sm:pt-10">
      <Link
        href="/"
        aria-label="MuiMemo 首页"
        className="inline-flex items-center gap-3 text-ink transition-opacity hover:opacity-80"
      >
        <Image
          src="/brand/logo-mark.svg"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0"
          priority
        />
        <span className="min-w-0">
          <span className="block font-mono text-[11px] tracking-[0.28em] text-ink uppercase">
            MuiMemo
          </span>
          <span className="font-serif mt-1 hidden text-[0.85rem] leading-none text-ink-soft sm:block">
            口述备忘
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-5 font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
        <a href="#what" className="hover:text-ink">
          是什么
        </a>
        <a href="#scenes" className="hover:text-ink">
          场景
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
    <section className="grid gap-12 pt-4 pb-18 sm:grid-cols-[1.08fr_0.92fr] sm:gap-16 sm:pb-30 lg:items-end">
      <div>
        <p className="font-mono text-[10px] tracking-[0.32em] text-ink-mute uppercase">
          00 · 口述备忘
        </p>
        <h1 className="font-serif mt-6 max-w-[10ch] text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[1.04] tracking-tight text-ink">
          说一句话，
          <br />
          AI 就把小事收成
          <span className="text-accent-warm">待办</span>。
        </h1>
        <p className="font-serif mt-7 max-w-[31ch] text-lg leading-relaxed text-ink-soft sm:text-[1.32rem]">
          不是先记一段语音，再回头整理。
          <br />
          你一开口，MuiMemo 就开始判断你要做什么，并顺手补上时间、优先级和该归的场景。
        </p>
        <p className="mt-6 max-w-[40rem] font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
          记下 → 理解 → 归堆 → 到该做的时候浮出来
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {authed ? (
            <Link href="/app" className={`${buttonVariants({ size: 'lg' })} px-6`}>
              进入应用
            </Link>
          ) : (
            <>
              <Link href="/register" className={`${buttonVariants({ size: 'lg' })} px-6`}>
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

function ExplainSection() {
  return (
    <section id="what" className="py-24 sm:py-30">
      <SectionHead number="01" label="是什么" title="不是多一个记事工具，而是少一道整理动作。" />
      <div className="mt-14 space-y-10 sm:mt-16">
        {EXPLAINERS.map((item) => (
          <article
            key={item.n}
            className="grid gap-3 border-t border-rule/60 pt-5 sm:grid-cols-[8rem_1fr] sm:gap-10 sm:pt-6"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent-warm uppercase">
              {item.n}
            </p>
            <div>
              <h3 className="font-serif max-w-[22ch] text-[1.65rem] leading-tight text-ink sm:text-[2rem]">
                {item.title}
              </h3>
              <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-ink-soft sm:text-base">
                {item.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScenesSection() {
  return (
    <section id="scenes" className="py-24 sm:py-30">
      <SectionHead number="02" label="场景" title="三种忙法，都不适合低头填表。" />
      <div className="mt-16 space-y-18 sm:space-y-24">
        {SCENES.map((scene, index) => (
          <SceneArticle key={scene.tag} scene={scene} index={index} />
        ))}
      </div>
    </section>
  );
}

function SceneArticle({
  scene,
  index,
}: {
  scene: Scene;
  index: number;
}) {
  const imageFirst = scene.imageSide === 'left';

  return (
    <article className="grid gap-8 sm:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)] sm:items-center sm:gap-12 lg:gap-16">
      <div className={imageFirst ? 'sm:order-1' : 'sm:order-2'}>
        <figure className="landing-sketch-frame overflow-hidden">
          <Image
            src={scene.imageSrc}
            alt={scene.imageAlt}
            width={960}
            height={1200}
            sizes="(max-width: 639px) 100vw, (max-width: 1199px) 42vw, 34rem"
            className="landing-sketch-image h-auto w-full"
            priority={index === 0}
          />
        </figure>
      </div>
      <div className={imageFirst ? 'sm:order-2' : 'sm:order-1'}>
        <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase">
          {String(index + 1).padStart(2, '0')} · {scene.tag}
        </p>
        <h3 className="font-serif mt-4 text-[clamp(1.9rem,3.4vw,3rem)] leading-tight text-ink">
          {scene.who}
        </h3>
        <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-ink-soft sm:text-base">
          {scene.context}
        </p>
        <div className="mt-7 border-t border-rule/60 pt-5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
            她 / 他说
          </p>
          <p className="font-serif mt-3 max-w-[16ch] text-[1.8rem] leading-snug text-ink sm:text-[2.15rem]">
            <span className="select-none text-accent-warm/70">「</span>
            {scene.line}
            <span className="select-none text-accent-warm/70">」</span>
          </p>
        </div>
        <div className="mt-6 border-t border-rule/60 pt-5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ink-mute uppercase">
            MuiMemo 接住
          </p>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-ink-soft sm:text-base">
            {scene.effect}
          </p>
        </div>
      </div>
    </article>
  );
}

function BenefitsSection() {
  return (
    <section className="py-24 sm:py-30">
      <SectionHead number="03" label="省心" title="你省掉的，不只是打字。" />
      <div className="mt-16 space-y-8">
        {BENEFITS.map((item) => (
          <article
            key={item.n}
            className="grid gap-3 border-t border-rule/60 pt-5 sm:grid-cols-[8rem_1fr] sm:gap-10 sm:pt-6"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent-warm uppercase">
              {item.n}
            </p>
            <div className="max-w-[56ch]">
              <h3 className="font-serif text-[1.7rem] leading-tight text-ink">{item.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft sm:text-base">
                {item.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RoadmapSection() {
  return (
    <section id="roadmap" className="py-24 sm:py-28">
      <SectionHead number="04" label="Roadmap" title="一步一步来。" />
      <ol className="mt-16 space-y-12 sm:space-y-14">
        {ROADMAP.map((item, index) => (
          <li key={item.n} className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:gap-10">
            <p className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase sm:pt-3">
              {String(index + 1).padStart(2, '0')} · {item.n}
            </p>
            <div className="max-w-[56ch]">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h3 className="font-serif text-2xl text-ink">{item.title}</h3>
                <PhaseTag phase={item.phase} />
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="py-24 sm:py-28">
      <SectionHead number="05" label="FAQ" title="你可能想问。" />
      <dl className="mt-16 space-y-10">
        {FAQ.map((item, index) => (
          <div key={item.q} className="grid gap-4 sm:grid-cols-[3rem_1fr] sm:gap-8">
            <dt className="font-mono text-[10px] tracking-[0.22em] text-ink-mute uppercase sm:pt-1">
              Q.{String(index + 1).padStart(2, '0')}
            </dt>
            <div className="max-w-[58ch]">
              <p className="font-serif text-xl text-ink sm:text-[1.4rem]">{item.q}</p>
              <dd className="mt-3 text-[15px] leading-relaxed text-ink-soft">{item.a}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Rule() {
  return <div aria-hidden className="h-px w-full bg-rule/60 sm:my-2" role="presentation" />;
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
      <h2 className="font-serif max-w-[22ch] text-[clamp(1.95rem,3.6vw,3rem)] leading-tight text-ink">
        {title}
      </h2>
    </header>
  );
}

function PhaseTag({ phase }: { phase: Phase }) {
  const label = phase === 'done' ? '已交付' : phase === 'active' ? '进行中' : '规划中';
  const className =
    phase === 'done'
      ? 'border-rule/70 text-ink-mute'
      : phase === 'active'
        ? 'border-accent-warm/50 text-accent-warm'
        : 'border-rule/70 text-ink-mute';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase ${className}`}
    >
      {label}
    </span>
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
