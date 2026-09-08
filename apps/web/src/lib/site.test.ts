import { describe, expect, it } from "vitest";
import {
	absoluteUrl,
	buildPageTitle,
	createMarketingMetadata,
	PUBLIC_SITE_ROUTES,
	SITE_DESCRIPTION,
	SITE_NAME,
	SITE_TITLE,
} from "./site";

describe("absoluteUrl", () => {
	it("相对路径拼出完整 URL", () => {
		expect(absoluteUrl("/pricing")).toBe(
			"https://muimemo.meathill.com/pricing",
		);
	});

	it("默认指向首页", () => {
		expect(absoluteUrl()).toBe("https://muimemo.meathill.com/");
	});
});

describe("buildPageTitle", () => {
	it("无标题时返回站点标题", () => {
		expect(buildPageTitle()).toBe(SITE_TITLE);
		expect(SITE_TITLE).toContain(SITE_NAME);
	});

	it("有标题时后缀站点名", () => {
		expect(buildPageTitle("价格")).toBe(`价格 · ${SITE_NAME}`);
	});
});

describe("createMarketingMetadata", () => {
	it("默认描述与 canonical 路径正确", () => {
		const meta = createMarketingMetadata({ path: "/pricing" });
		expect(meta.description).toBe(SITE_DESCRIPTION);
		expect(meta.alternates?.canonical).toBe("/pricing");
	});

	it("自定义标题进入 openGraph/twitter，keywords 追加默认词", () => {
		const meta = createMarketingMetadata({
			title: "价格",
			path: "/pricing",
			keywords: ["会员"],
		});
		expect(meta.openGraph?.title).toBe(`价格 · ${SITE_NAME}`);
		expect(meta.twitter?.title).toBe(`价格 · ${SITE_NAME}`);
		expect(meta.keywords).toContain("会员");
		expect(meta.keywords).toContain("叨叨记");
	});
});

describe("PUBLIC_SITE_ROUTES", () => {
	it("路由唯一且 priority 在 0-1 之间", () => {
		const hrefs = PUBLIC_SITE_ROUTES.map((r) => r.href);
		expect(new Set(hrefs).size).toBe(hrefs.length);
		for (const r of PUBLIC_SITE_ROUTES) {
			expect(r.priority).toBeGreaterThan(0);
			expect(r.priority).toBeLessThanOrEqual(1);
		}
	});
});
