/**
 * @vitest-environment node
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("OpenAI-compatible 生产配置", () => {
	it("排障期间启用全量持久化日志", async () => {
		const source = await readFile(
			new URL("../../wrangler.jsonc", import.meta.url),
			"utf8",
		);
		const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ""));
		expect(config.observability).toMatchObject({
			enabled: true,
			head_sampling_rate: 1,
			logs: { enabled: true, persist: true, invocation_logs: true },
		});
	});

	it("使用 OpenCode Go 的 MiMo-V2.6-Flash 端点", async () => {
		const config = await readFile(
			new URL("../../wrangler.jsonc", import.meta.url),
			"utf8",
		);

		expect(config).toContain(
			'"OPENAI_BASE_URL": "https://opencode.ai/zen/go/v1"',
		);
		expect(config).toContain('"OPENAI_MODEL": "mimo-v2.6-flash"');
	});
});
