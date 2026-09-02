/**
 * @vitest-environment node
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("OpenAI-compatible 生产配置", () => {
	it("使用 OpenCode Go 的 MiMo-V2.5 端点", async () => {
		const config = await readFile(
			new URL("../../wrangler.jsonc", import.meta.url),
			"utf8",
		);

		expect(config).toContain(
			'"OPENAI_BASE_URL": "https://opencode.ai/zen/go/v1"',
		);
		expect(config).toContain('"OPENAI_MODEL": "mimo-v2.5"');
	});
});
