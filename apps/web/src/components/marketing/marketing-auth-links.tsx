"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { track, trackAppStoreClick } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import { APP_STORE_URL } from "@/lib/site";

export function MarketingHeaderAuthLink() {
	const { data } = useSession();
	const authed = Boolean(data?.user);

	if (authed) {
		return (
			<Link href="/app" className="text-accent-warm hover:text-ink">
				进入应用 →
			</Link>
		);
	}

	return (
		// Issue #12：页眉登录入口不预取（低频目标页，本身很轻）
		<Link href="/login" prefetch={false} className="hover:text-ink">
			登录
		</Link>
	);
}

export function MarketingHeroActions() {
	const { data } = useSession();
	const authed = Boolean(data?.user);

	if (authed) {
		return (
			<Link href="/app" className={`${buttonVariants({ size: "lg" })} px-6`}>
				进入应用
			</Link>
		);
	}

	return (
		<>
			<a
				href={APP_STORE_URL}
				target="_blank"
				rel="noreferrer"
				className={`${buttonVariants({ size: "lg" })} px-6`}
				onClick={() => trackAppStoreClick("hero")}
			>
				App Store 下载
			</a>
			<span className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.72rem] tracking-[0.16em] text-ink-soft uppercase sm:text-[0.8rem]">
				{/* Issue #12：hero 次级链接不预取，主 CTA（/app）保留预取 */}
				<Link
					href="/register"
					prefetch={false}
					className="underline-offset-4 hover:text-ink hover:underline"
					onClick={() => track({ name: "web_trial_click", location: "hero" })}
				>
					网页版试用
				</Link>
				<span aria-hidden className="text-rule-strong">
					/
				</span>
				<Link
					href="/login"
					prefetch={false}
					className="underline-offset-4 hover:text-ink hover:underline"
				>
					登录
				</Link>
			</span>
		</>
	);
}
