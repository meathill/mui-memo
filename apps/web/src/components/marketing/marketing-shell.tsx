import { BrandFooter, BrandHeader } from "meathill-brand-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
	MARKETING_HEADER_LINKS,
	type MarketingLink,
	PUBLIC_SITE_ROUTES,
	SITE_TAGLINE,
} from "@/lib/site";
import { MarketingHeaderAuthLink } from "./marketing-auth-links";

type MarketingShellProps = {
	children: ReactNode;
	nav?: MarketingLink[];
};

export function MarketingShell({
	children,
	nav = MARKETING_HEADER_LINKS,
}: MarketingShellProps) {
	return (
		<div className="min-h-screen">
			<MarketingHeader nav={nav} />
			<main className="relative mx-auto w-full max-w-[76rem] px-5 pb-24 sm:px-8 sm:pb-28 lg:px-10">
				{children}
			</main>
			<MarketingFooter />
		</div>
	);
}

function MarketingHeader({ nav }: { nav: MarketingLink[] }) {
	return (
		<BrandHeader
			currentSiteId="muimemo"
			locale="zh"
			productName="叨叨记"
			productUrl="https://muimemo.meathill.com"
			actions={
				<nav className="flex items-center gap-4 font-mono text-[12px] tracking-[0.16em] text-ink-mute uppercase sm:gap-6">
					{nav.map((item) =>
						item.href.startsWith("#") ? (
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
			}
		/>
	);
}

function MarketingFooter() {
	return (
		<BrandFooter currentSiteId="muimemo" description={SITE_TAGLINE} locale="zh">
			<div className="flex flex-wrap items-center gap-2 font-mono text-[12px] tracking-[0.16em] text-ink-mute uppercase">
				<span>叨叨记 · v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
				{PUBLIC_SITE_ROUTES.map((item, index) => (
					<span key={item.href} className="flex items-center gap-2">
						{index > 0 ? <span className="text-ink-mute/50">/</span> : null}
						<Link href={item.href} className="hover:text-ink">
							{item.label}
						</Link>
					</span>
				))}
			</div>
		</BrandFooter>
	);
}
