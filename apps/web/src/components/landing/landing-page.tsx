import { HeroDemo } from '@/components/landing/hero-demo';
import {
  BENEFITS,
  EXPLAINERS,
  FAQ,
  type Phase,
  ROADMAP,
  SCENES,
  type Scene,
} from '@/components/landing/landing-content';
import { buttonVariants } from '@/components/ui/button-variants';
import Image from 'next/image';
import Link from 'next/link';

type LandingPageProps = {
  authed: boolean;
};

export function LandingPageView({ authed }: LandingPageProps) {
  return (
    <main className="relative mx-auto w-full max-w-[76rem] px-5 pb-24 sm:px-8 sm:pb-28 lg:px-10">
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
    <header className="flex items-start justify-between gap-5 pt-6 pb-10 sm:items-center sm:pt-8 sm:pb-12">
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
          <span className="block font-mono text-[0.72rem] tracking-[0.2em] text-ink uppercase sm:text-[0.8rem]">
            MuiMemo
          </span>
          <span className="font-serif mt-1 hidden text-[0.95rem] leading-none text-ink-soft sm:block">
            口述备忘
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-4 font-mono text-[0.68rem] tracking-[0.16em] text-ink-mute uppercase sm:gap-6 sm:text-[0.76rem]">
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
    <section className="grid gap-10 pt-2 pb-16 sm:grid-cols-[minmax(0,1.05fr)_minmax(23rem,0.95fr)] sm:gap-12 sm:pb-22 lg:gap-14 lg:items-start">
      <div>
        <p className="font-mono text-[0.72rem] tracking-[0.24em] text-ink-mute uppercase sm:text-[0.8rem]">
          00 · 口述备忘
        </p>
        <h1 className="font-serif mt-5 max-w-[11.5ch] text-balance text-[clamp(3.25rem,6vw,5.5rem)] leading-[1.02] tracking-tight text-ink">
          说一句话，AI 就把小事收成
          <span className="text-accent-warm">待办</span>。
        </h1>
        <p className="font-serif mt-6 max-w-[36ch] text-[1.15rem] leading-[1.72] text-ink-soft sm:text-[1.38rem] sm:leading-[1.68]">
          不是先记一段语音，再回头整理。 你一开口，MuiMemo
          就开始判断你要做什么，并顺手补上时间、优先级和该归的场景。
        </p>
        <p className="mt-5 max-w-[42rem] font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.82rem]">
          记下 → 理解 → 归堆 → 到该做的时候浮出来
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-9">
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
                className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-soft uppercase underline-offset-4 hover:text-ink hover:underline sm:text-[0.8rem]"
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
    <section id="what" className="py-18 sm:py-22">
      <SectionHead number="01" label="是什么" title="不是多一个记事工具，而是少一道整理动作。" />
      <div className="mt-10 space-y-8 sm:mt-12 sm:space-y-10">
        {EXPLAINERS.map((item) => (
          <article
            key={item.n}
            className="grid gap-3 border-t border-rule/60 pt-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-8 sm:pt-6"
          >
            <p className="font-mono text-[0.72rem] tracking-[0.16em] text-accent-warm uppercase sm:text-[0.82rem]">
              {item.n}
            </p>
            <div>
              <h3 className="font-serif max-w-[26ch] text-balance text-[1.88rem] leading-tight text-ink sm:text-[2.2rem]">
                {item.title}
              </h3>
              <p className="mt-3 max-w-[60ch] text-[1rem] leading-[1.72] text-ink-soft sm:text-[1.08rem]">
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
    <section id="scenes" className="py-18 sm:py-22">
      <SectionHead number="02" label="场景" title="三种忙法，都不适合低头填表。" />
      <div className="mt-12 space-y-14 sm:mt-14 sm:space-y-18">
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
    <article className="grid gap-8 sm:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] sm:items-center sm:gap-10 lg:gap-14">
      <div className={imageFirst ? 'sm:order-1' : 'sm:order-2'}>
        <figure className="landing-sketch-frame overflow-hidden">
          <Image
            src={scene.imageSrc}
            alt={scene.imageAlt}
            width={960}
            height={1200}
            sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 1199px) 44vw, 36rem"
            className="landing-sketch-image h-auto w-full object-cover"
            loading="eager"
            unoptimized
            priority={index < 2}
          />
        </figure>
      </div>
      <div className={imageFirst ? 'sm:order-2' : 'sm:order-1'}>
        <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.82rem]">
          {String(index + 1).padStart(2, '0')} · {scene.tag}
        </p>
        <h3 className="font-serif mt-3 text-balance text-[clamp(2.1rem,3.7vw,3.3rem)] leading-tight text-ink">
          {scene.who}
        </h3>
        <p className="mt-3 max-w-[44ch] text-[1rem] leading-[1.72] text-ink-soft sm:text-[1.08rem]">
          {scene.context}
        </p>
        <div className="mt-6 border-t border-rule/60 pt-4">
          <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
            她 / 他说
          </p>
          <p className="font-serif mt-3 max-w-[20ch] text-balance text-[2rem] leading-[1.3] text-ink sm:text-[2.35rem]">
            <span className="select-none text-accent-warm/70">「</span>
            {scene.line}
            <span className="select-none text-accent-warm/70">」</span>
          </p>
        </div>
        <div className="mt-5 border-t border-rule/60 pt-4">
          <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:text-[0.8rem]">
            MuiMemo 接住
          </p>
          <p className="mt-3 max-w-[50ch] text-[1rem] leading-[1.72] text-ink-soft sm:text-[1.08rem]">
            {scene.effect}
          </p>
        </div>
      </div>
    </article>
  );
}

function BenefitsSection() {
  return (
    <section className="py-18 sm:py-22">
      <SectionHead number="03" label="省心" title="你省掉的，不只是打字。" />
      <div className="mt-12 space-y-7 sm:mt-14 sm:space-y-8">
        {BENEFITS.map((item) => (
          <article
            key={item.n}
            className="grid gap-3 border-t border-rule/60 pt-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-8 sm:pt-6"
          >
            <p className="font-mono text-[0.72rem] tracking-[0.16em] text-accent-warm uppercase sm:text-[0.82rem]">
              {item.n}
            </p>
            <div className="max-w-[60ch]">
              <h3 className="font-serif text-[1.95rem] leading-tight text-ink sm:text-[2.15rem]">
                {item.title}
              </h3>
              <p className="mt-3 text-[1rem] leading-[1.72] text-ink-soft sm:text-[1.08rem]">
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
    <section id="roadmap" className="py-18 sm:py-22">
      <SectionHead number="04" label="Roadmap" title="一步一步来。" />
      <ol className="mt-12 space-y-10 sm:mt-14 sm:space-y-12">
        {ROADMAP.map((item, index) => (
          <li key={item.n} className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-8">
            <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:pt-2 sm:text-[0.82rem]">
              {String(index + 1).padStart(2, '0')} · {item.n}
            </p>
            <div className="max-w-[60ch]">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h3 className="font-serif text-[2rem] leading-tight text-ink sm:text-[2.15rem]">
                  {item.title}
                </h3>
                <PhaseTag phase={item.phase} />
              </div>
              <p className="mt-3 text-[1rem] leading-[1.72] text-ink-soft sm:text-[1.08rem]">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="py-18 sm:py-22">
      <SectionHead number="05" label="FAQ" title="你可能想问。" />
      <dl className="mt-12 space-y-8 sm:mt-14 sm:space-y-10">
        {FAQ.map((item, index) => (
          <div key={item.q} className="grid gap-3 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:pt-1 sm:text-[0.82rem]">
              Q.{String(index + 1).padStart(2, '0')}
            </dt>
            <div className="max-w-[62ch]">
              <p className="font-serif text-[1.6rem] leading-tight text-ink sm:text-[1.75rem]">
                {item.q}
              </p>
              <dd className="mt-3 text-[1rem] leading-[1.72] text-ink-soft sm:text-[1.06rem]">
                {item.a}
              </dd>
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
    <header className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-8">
      <p className="font-mono text-[0.72rem] tracking-[0.16em] text-ink-mute uppercase sm:pt-2 sm:text-[0.82rem]">
        {number} · {label}
      </p>
      <h2 className="font-serif max-w-[26ch] text-balance text-[clamp(2.1rem,3.7vw,3.25rem)] leading-tight text-ink">
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
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] tracking-[0.16em] uppercase sm:text-[0.75rem] ${className}`}
    >
      {label}
    </span>
  );
}

function Colophon() {
  return (
    <footer className="mt-8 flex flex-wrap items-baseline justify-between gap-4 border-t border-rule/60 pt-7 font-mono text-[0.7rem] tracking-[0.16em] text-ink-mute uppercase sm:mt-10 sm:pt-8 sm:text-[0.78rem]">
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
