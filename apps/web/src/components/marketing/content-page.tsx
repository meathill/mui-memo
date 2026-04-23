import type { ReactNode } from 'react';
import { MARKETING_HEADER_LINKS } from '@/lib/site';
import { MarketingShell } from './marketing-shell';

type ContentPageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
};

export function ContentPage({ eyebrow, title, lead, children }: ContentPageProps) {
  return (
    <MarketingShell nav={MARKETING_HEADER_LINKS}>
      <section className="mx-auto max-w-[48rem] pb-4">
        <header className="rounded-[2rem] border border-rule/60 bg-paper-2/40 px-6 py-8 sm:px-9 sm:py-10">
          <p className="font-mono text-[0.72rem] tracking-[0.2em] text-accent-warm uppercase sm:text-[0.8rem]">
            {eyebrow}
          </p>
          <h1 className="font-serif mt-4 text-[clamp(2.5rem,5vw,4rem)] leading-[1.04] tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-4 max-w-[40rem] text-[1.05rem] leading-[1.78] text-ink-soft sm:text-[1.15rem]">{lead}</p>
        </header>

        <article className="content-doc mt-10">{children}</article>
      </section>
    </MarketingShell>
  );
}
