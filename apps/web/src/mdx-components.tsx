import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

function Anchor({
	className,
	href = "",
	...props
}: ComponentPropsWithoutRef<"a">) {
	const mergedClassName = cn(
		"font-medium text-ink underline decoration-accent-warm/38 underline-offset-4 transition-colors hover:text-accent-warm",
		className,
	);

	if (href.startsWith("/")) {
		// Issue #12：文章内链不预取，避免每篇内容页触发额外的 _rsc 请求
		return (
			<Link
				href={href}
				prefetch={false}
				className={mergedClassName}
				{...props}
			/>
		);
	}

	const isExternal = href.startsWith("http");

	return (
		<a
			href={href}
			className={mergedClassName}
			rel={isExternal ? "noreferrer noopener" : props.rel}
			target={isExternal ? "_blank" : props.target}
			{...props}
		/>
	);
}

const components: MDXComponents = {
	a: Anchor,
};

export function useMDXComponents(overrides: MDXComponents = {}): MDXComponents {
	return {
		...components,
		...overrides,
	};
}
