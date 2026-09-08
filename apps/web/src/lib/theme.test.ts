import { beforeEach, describe, expect, it } from "vitest";
import {
	applyTheme,
	readTheme,
	THEME_INIT_SCRIPT,
	THEME_STORAGE_KEY,
	writeTheme,
} from "./theme";

beforeEach(() => {
	window.localStorage.clear();
	document.documentElement.classList.remove("dark", "theme-mono");
});

describe("readTheme", () => {
	it("默认返回 paper", () => {
		expect(readTheme()).toBe("paper");
	});

	it("未知取值回退 paper", () => {
		window.localStorage.setItem(THEME_STORAGE_KEY, "pink");
		expect(readTheme()).toBe("paper");
	});

	it.each(["paper", "night", "mono"] as const)("读回写入值 %s", (theme) => {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
		expect(readTheme()).toBe(theme);
	});
});

describe("applyTheme", () => {
	it("paper 清掉所有主题类", () => {
		document.documentElement.classList.add("dark", "theme-mono");
		applyTheme("paper");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.classList.contains("theme-mono")).toBe(
			false,
		);
	});

	it("night 只加 dark", () => {
		applyTheme("night");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("theme-mono")).toBe(
			false,
		);
	});

	it("mono 只加 theme-mono", () => {
		applyTheme("mono");
		expect(document.documentElement.classList.contains("theme-mono")).toBe(
			true,
		);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});
});

describe("writeTheme", () => {
	it("持久化并立即生效", () => {
		writeTheme("night");
		expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("night");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});
});

describe("THEME_INIT_SCRIPT", () => {
	it("内联脚本与 storage key 一致，避免闪烁逻辑漂移", () => {
		expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
		expect(THEME_INIT_SCRIPT).toContain("theme-mono");
	});
});
