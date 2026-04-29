import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MARKETING_HEADER_LINKS, type MarketingLink, PUBLIC_SITE_ROUTES } from '@/lib/site';
import { MarketingHeaderAuthLink } from './marketing-auth-links';

type MarketingShellProps = {
  children: ReactNode;
  nav?: MarketingLink[];
};

export function MarketingShell({ children, nav = MARKETING_HEADER_LINKS }: MarketingShellProps) {
  return (
    <main className="relative mx-auto w-full max-w-[76rem] px-5 pb-24 sm:px-8 sm:pb-28 lg:px-10">
      <MarketingHeader nav={nav} />
      {children}
      <MarketingFooter />
    </main>
  );
}

function MarketingHeader({ nav }: { nav: MarketingLink[] }) {
  return (
    <header className="flex items-start justify-between gap-5 pt-6 pb-10 sm:items-center sm:pt-8 sm:pb-12">
      <Link
        href="/"
        aria-label="叨叨记 首页"
        className="inline-flex items-center gap-3 text-ink transition-opacity hover:opacity-80"
      >
        <Image src="/brand/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" priority />
        <span className="min-w-0">
          <span className="block font-mono text-[0.72rem] tracking-[0.2em] text-ink uppercase sm:text-[0.8rem]">
            叨叨记
          </span>
          <span className="font-serif mt-1 hidden text-[0.95rem] leading-none text-ink-soft sm:block">口述备忘</span>
        </span>
      </Link>
      <nav className="flex items-center gap-4 font-mono text-[0.68rem] tracking-[0.16em] text-ink-mute uppercase sm:gap-6 sm:text-[0.76rem]">
        {nav.map((item) =>
          item.href.startsWith('#') ? (
            <a key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          ),
        )}
        <MarketingHeaderAuthLink />
      </nav>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="mt-8 flex flex-wrap items-baseline justify-between gap-4 border-t border-rule/60 pt-7 font-mono text-[0.7rem] tracking-[0.16em] text-ink-mute uppercase sm:mt-10 sm:pt-8 sm:text-[0.78rem]">
      <span>叨叨记 · v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
      <span className="flex flex-wrap items-center gap-2">
        {PUBLIC_SITE_ROUTES.map((item, index) => (
          <span key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span className="text-ink-mute/50">/</span> : null}
            <Link href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          </span>
        ))}
      </span>
      <span>Made by meathill · paper, deliberate, calm</span>
    </footer>
  );
}
