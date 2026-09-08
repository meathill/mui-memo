import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CHECK_ANIM_DURATION,
	CHECK_ANIM_STORAGE_KEY,
	readCheckAnim,
	writeCheckAnim,
} from "./settings";

beforeEach(() => {
	window.localStorage.clear();
});

describe("readCheckAnim", () => {
	it("默认返回 strike", () => {
		expect(readCheckAnim()).toBe("strike");
	});

	it("未知取值回退 strike", () => {
		window.localStorage.setItem(CHECK_ANIM_STORAGE_KEY, "bounce");
		expect(readCheckAnim()).toBe("strike");
	});

	it.each(["strike", "fade", "fly"] as const)("读回写入值 %s", (anim) => {
		window.localStorage.setItem(CHECK_ANIM_STORAGE_KEY, anim);
		expect(readCheckAnim()).toBe(anim);
	});
});

describe("writeCheckAnim", () => {
	it("持久化并广播变更事件", () => {
		const onChange = vi.fn();
		window.addEventListener("muimemo:check-anim-change", onChange);
		writeCheckAnim("fly");
		expect(window.localStorage.getItem(CHECK_ANIM_STORAGE_KEY)).toBe("fly");
		expect(onChange).toHaveBeenCalledTimes(1);
		window.removeEventListener("muimemo:check-anim-change", onChange);
	});
});

describe("CHECK_ANIM_DURATION", () => {
	it("三种动画都有正数时长", () => {
		for (const anim of ["strike", "fade", "fly"] as const) {
			expect(CHECK_ANIM_DURATION[anim]).toBeGreaterThan(0);
		}
	});
});
