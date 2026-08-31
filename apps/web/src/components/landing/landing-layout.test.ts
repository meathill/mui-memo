import { describe, expect, it } from "vitest";
import { SCENE_QUOTE_CLASS_NAME } from "./landing-layout";

describe("landing page layout", () => {
	it("场景长引语允许换行，避免撑宽桌面页面", () => {
		expect(SCENE_QUOTE_CLASS_NAME).toContain("break-words");
		expect(SCENE_QUOTE_CLASS_NAME).not.toContain("whitespace-nowrap");
	});
});
