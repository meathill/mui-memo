import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServiceRecoveryNotice } from "./service-recovery-notice";

describe("ServiceRecoveryNotice", () => {
	it("把故障恢复状态明确告知首页用户", () => {
		const html = renderToStaticMarkup(<ServiceRecoveryNotice />);

		expect(html).toContain('role="status"');
		expect(html).toContain("服务状态 · 已恢复");
		expect(html).toContain("故障已经修复，请大家放心使用");
	});
});
