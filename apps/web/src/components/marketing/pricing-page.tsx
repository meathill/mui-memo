import Link from 'next/link';
import { APP_STORE_URL, MARKETING_HEADER_LINKS } from '@/lib/site';
import { MarketingShell } from './marketing-shell';

type Tier = {
  id: 'free' | 'pro' | 'team';
  name: string;
  tagline: string;
  price: string;
  priceSub?: string;
  altPrice?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaExternal?: boolean;
  status?: 'current' | 'recommended' | 'coming-soon';
};

const TIERS: Tier[] = [
  {
    id: 'free',
    name: '免费',
    tagline: '先用起来，看看顺不顺手',
    price: '¥0',
    priceSub: '永久免费',
    features: [
      '每月 120 次 AI 操作（约每天 4 次）',
      '任务条数不限、云同步不限',
      '输入记录、归档、搜索全部可用',
      '4 档主题、深浅自动跟随',
      '免费下载 iOS App',
    ],
    ctaLabel: '下载 iOS App',
    ctaHref: APP_STORE_URL,
    ctaExternal: true,
    status: 'current',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: '量大的人值这一杯奶茶钱',
    price: '¥6',
    priceSub: '/月',
    altPrice: '或 ¥58/年（省 ¥14）',
    features: [
      '上面免费版全部',
      '无限 AI 操作',
      '优先 AI 识别线路：识别更快、更稳',
      '语音原声归档无限期保留',
      '后续新功能优先邀请',
    ],
    ctaLabel: '升级 Pro',
    ctaHref: '/register?upgrade=pro',
    status: 'recommended',
  },
  {
    id: 'team',
    name: 'Team 候补',
    tagline: '暂不开放，先收集真实需求',
    price: '未开放',
    features: ['个人版稳定后再评估', '不会影响免费 / Pro 当前功能', '候补用户优先收到开放通知', '真实需求明确后再定价'],
    ctaLabel: '留下邮箱',
    ctaHref: '/contact?topic=team-waitlist',
    status: 'coming-soon',
  },
];

export function PricingPageView() {
  return (
    <MarketingShell nav={MARKETING_HEADER_LINKS}>
      <section className="pt-2 pb-12 sm:pb-16">
        <header className="max-w-[48rem]">
          <p className="font-mono text-[0.72rem] tracking-[0.24em] text-accent-warm uppercase sm:text-[0.8rem]">
            Pricing
          </p>
          <h1 className="font-serif mt-5 text-[clamp(2.75rem,5.5vw,4.5rem)] leading-[1.04] tracking-tight text-ink">
            先免费用，量大再升级。
          </h1>
          <p className="mt-5 max-w-[36rem] text-[1.05rem] leading-[1.72] text-ink-soft sm:text-[1.18rem]">
            个人记事免费够用。AI 用得猛升级 Pro。Team 先不作为当前主推，等个人版稳定后再开放候补。
          </p>
        </header>
      </section>

      <section className="grid gap-5 pb-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
        {TIERS.map((tier) => (
          <PricingCard key={tier.id} tier={tier} />
        ))}
      </section>

      <section className="border-t border-rule/60 pt-12 pb-16 sm:pt-14">
        <div className="max-w-[48rem]">
          <p className="font-mono text-[0.72rem] tracking-[0.2em] text-ink-mute uppercase sm:text-[0.8rem]">
            Q.01 · 「AI 操作」是怎么算的？
          </p>
          <p className="mt-3 text-[1rem] leading-[1.78] text-ink-soft sm:text-[1.06rem]">
            每次按住麦克风说一句话、由 AI 解析后生成 / 修改 / 完成任务，算 1 次。手动勾选完成、手动改字段不算。
            一句话拆成多个任务也只算 1 次。120 次 ≈ 每天 4 句，普通用户够用。
          </p>
        </div>

        <div className="mt-10 max-w-[48rem]">
          <p className="font-mono text-[0.72rem] tracking-[0.2em] text-ink-mute uppercase sm:text-[0.8rem]">
            Q.02 · 超过免费额度会怎样？
          </p>
          <p className="mt-3 text-[1rem] leading-[1.78] text-ink-soft sm:text-[1.06rem]">
            当月剩余的 AI
            操作用完，下次按麦克风会弹升级提示。任务管理、云同步、查看历史不受影响——你已经记下的事不会消失。 额度每月 1
            号清零重置，等到 1 号又会回来 120 次。
          </p>
        </div>

        <div className="mt-10 max-w-[48rem]">
          <p className="font-mono text-[0.72rem] tracking-[0.2em] text-ink-mute uppercase sm:text-[0.8rem]">
            Q.03 · Team 什么时候开放？
          </p>
          <p className="mt-3 text-[1rem] leading-[1.78] text-ink-soft sm:text-[1.06rem]">
            短期不作为当前主推。叨叨记会先把个人语音录入、标签筛选和订阅体验打磨稳定；如果你确实想跟进多人场景，可以先在{' '}
            <Link href="/contact?topic=team-waitlist" className="text-accent-warm underline-offset-4 hover:underline">
              候补名单
            </Link>{' '}
            留个邮箱，准备开放试用时第一批通知到你。
          </p>
        </div>

        <div className="mt-10 max-w-[48rem]">
          <p className="font-mono text-[0.72rem] tracking-[0.2em] text-ink-mute uppercase sm:text-[0.8rem]">
            Q.04 · 退订或退款？
          </p>
          <p className="mt-3 text-[1rem] leading-[1.78] text-ink-soft sm:text-[1.06rem]">
            订阅在 App Store / Apple ID 设置里随时取消，到期后自动降回免费。退款规则按 Apple
            平台政策处理。如果遇到具体问题，发邮件到{' '}
            <a href="mailto:meathill@gmail.com" className="text-accent-warm underline-offset-4 hover:underline">
              meathill@gmail.com
            </a>
            ，我会帮忙跟进。
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}

function PricingCard({ tier }: { tier: Tier }) {
  const isRecommended = tier.status === 'recommended';
  const isComingSoon = tier.status === 'coming-soon';

  return (
    <article
      className={
        isRecommended
          ? 'relative flex flex-col rounded-[1.5rem] border-2 border-accent-warm/60 bg-paper-2/60 p-6 sm:p-7'
          : 'relative flex flex-col rounded-[1.5rem] border border-rule/60 bg-paper-2/40 p-6 sm:p-7'
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[1.95rem] leading-tight text-ink">{tier.name}</h2>
        {isRecommended ? <Tag tone="accent">推荐</Tag> : null}
        {isComingSoon ? <Tag tone="muted">Coming Soon</Tag> : null}
      </div>
      <p className="mt-2 text-[0.95rem] text-ink-soft">{tier.tagline}</p>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="font-serif text-[2.6rem] leading-none text-ink">{tier.price}</span>
        {tier.priceSub ? <span className="text-[0.95rem] text-ink-soft">{tier.priceSub}</span> : null}
      </div>
      {tier.altPrice ? <p className="mt-1 text-[0.85rem] text-ink-mute">{tier.altPrice}</p> : null}

      <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-rule/60 pt-5 text-[0.95rem] text-ink-soft">
        {tier.features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="select-none text-accent-warm/70" aria-hidden>
              ·
            </span>
            <span className="leading-[1.55]">{f}</span>
          </li>
        ))}
      </ul>

      {tier.ctaExternal ? (
        <a
          href={tier.ctaHref}
          target="_blank"
          rel="noreferrer"
          className={
            isRecommended
              ? 'mt-7 inline-flex items-center justify-center rounded-full bg-accent-warm px-5 py-3 text-center font-mono text-[0.78rem] tracking-[0.16em] text-paper uppercase transition-opacity hover:opacity-85'
              : 'mt-7 inline-flex items-center justify-center rounded-full border border-rule/70 px-5 py-3 text-center font-mono text-[0.78rem] tracking-[0.16em] text-ink uppercase transition-colors hover:border-accent-warm/60 hover:text-accent-warm'
          }
        >
          {tier.ctaLabel}
        </a>
      ) : (
        <Link
          href={tier.ctaHref}
          className={
            isRecommended
              ? 'mt-7 inline-flex items-center justify-center rounded-full bg-accent-warm px-5 py-3 text-center font-mono text-[0.78rem] tracking-[0.16em] text-paper uppercase transition-opacity hover:opacity-85'
              : 'mt-7 inline-flex items-center justify-center rounded-full border border-rule/70 px-5 py-3 text-center font-mono text-[0.78rem] tracking-[0.16em] text-ink uppercase transition-colors hover:border-accent-warm/60 hover:text-accent-warm'
          }
        >
          {tier.ctaLabel}
        </Link>
      )}
    </article>
  );
}

function Tag({ tone, children }: { tone: 'accent' | 'muted'; children: string }) {
  const className =
    tone === 'accent'
      ? 'inline-flex items-center rounded-full border border-accent-warm/50 px-2.5 py-0.5 font-mono text-[0.66rem] tracking-[0.16em] text-accent-warm uppercase'
      : 'inline-flex items-center rounded-full border border-rule/70 px-2.5 py-0.5 font-mono text-[0.66rem] tracking-[0.16em] text-ink-mute uppercase';
  return <span className={className}>{children}</span>;
}
