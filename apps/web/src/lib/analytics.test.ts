import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	GA_KEY_EVENTS,
	hasTrackedFirstTask,
	track,
	trackAppStoreClick,
	trackFirstTaskCreated,
} from "./analytics";

beforeEach(() => {
	// happy-dom 默认不带 localStorage，这里补最小内存实现
	if (!window.localStorage) {
		const store = new Map<string, string>();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			writable: true,
			value: {
				getItem: (k: string) => store.get(k) ?? null,
				setItem: (k: string, v: string) => {
					store.set(k, String(v));
				},
				removeItem: (k: string) => {
					store.delete(k);
				},
				clear: () => store.clear(),
			},
		});
	}
	window.localStorage.clear();
	delete (window as unknown as { gtag?: unknown }).gtag;
});

describe("GA 关键事件契约（issue #11）", () => {
	it("关键事件清单包含首次记录/完成/下载三类转化", () => {
		expect(GA_KEY_EVENTS).toContain("first_task_created");
		expect(GA_KEY_EVENTS).toContain("task_complete");
		expect(GA_KEY_EVENTS).toContain("app_store_click");
		expect(GA_KEY_EVENTS).toContain("sign_up");
		expect(GA_KEY_EVENTS).toContain("login");
	});

	it("无 gtag 时静默丢弃，不抛错", () => {
		expect(() =>
			track({ name: "task_complete", source: "today" }),
		).not.toThrow();
	});

	it("透传事件名与参数", () => {
		const gtag = vi.fn();
		(window as unknown as { gtag: unknown }).gtag = gtag;
		track({ name: "sign_up", method: "email" });
		expect(gtag).toHaveBeenCalledWith("event", "sign_up", {
			method: "email",
		});
	});
});

describe("first_task_created 去重", () => {
	it("首次发出并落 localStorage，再次调用被吞掉", () => {
		const gtag = vi.fn();
		(window as unknown as { gtag: unknown }).gtag = gtag;
		expect(trackFirstTaskCreated("voice")).toBe(true);
		expect(hasTrackedFirstTask()).toBe(true);
		expect(trackFirstTaskCreated("voice")).toBe(false);
		expect(gtag).toHaveBeenCalledTimes(1);
		expect(gtag).toHaveBeenCalledWith("event", "first_task_created", {
			method: "voice",
		});
	});
});

describe("app_store_click 跨端归因参数", () => {
	it("携带点击位置与落地页路径", () => {
		const gtag = vi.fn();
		(window as unknown as { gtag: unknown }).gtag = gtag;
		trackAppStoreClick("hero");
		expect(gtag).toHaveBeenCalledWith(
			"event",
			"app_store_click",
			expect.objectContaining({
				location: "hero",
				platform: "web",
				landing_path: expect.any(String),
			}),
		);
	});
});
