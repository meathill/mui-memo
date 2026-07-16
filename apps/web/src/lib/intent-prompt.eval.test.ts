/**
 * @vitest-environment node
 *
 * AI prompt 行为评估套件——纯文本输入，跑真实模型，断言 actions[] 结构。
 *
 * 必须用 node 环境：vitest 默认 happy-dom 会注入 window，OpenAI SDK 一看到
 * 就拒绝跑（怕浏览器里泄 key）。这套测试只调外部 API，不动 DOM，node 环境刚好。
 *
 * **opt-in 跑**：常规 `pnpm test` 不跑这套（要花 50+ 秒 + 真实 API call）。
 * 改 prompt 或加 case 后用专用 script 显式跑：
 *
 *   pnpm -F @mui-memo/web test:prompt-eval
 *
 * 该 script 设了 `PROMPT_EVAL=1`，配合 .dev.vars 里的 OPENAI_API_KEY /
 * OPENAI_BASE_URL / OPENAI_MODEL（或 GEMINI_API_KEY）整套就开跑。
 *
 * **provider 自动选择**（PROMPT_EVAL=1 + 满足以下之一）：
 *   1. OPENAI_API_KEY + OPENAI_BASE_URL + OPENAI_MODEL → 走 OpenAI 兼容（MIMO）
 *   2. GEMINI_API_KEY → 走 Gemini
 *   3. 都没有 → describe.skip 整套跳过
 *
 * env 来源：vitest.config.ts 在启动时把 .dev.vars / .env 加到 process.env。
 *
 * AI 输出有方差（temperature=0.2 已经很低，但仍非确定），断言只锁结构和
 * 关键 token，不锁文案；挂了通常说明 prompt 行为变了，需要 review。
 */

import type { TaskView } from "@mui-memo/shared/logic";
import type { Action, Utterance } from "@mui-memo/shared/validators";
import { describe, expect, test } from "vitest";
import { createGenAI, parseTextIntent as parseGemini } from "./gemini";
import {
  CASES,
  type ExpectedAction,
  type TaskFixture,
} from "./intent-prompt.cases";
import type { TimeAnchor } from "./intent-shared";
import { createOpenAIClient, parseTextIntent as parseOpenAI } from "./openai";
import { describeNow, normalizeTz } from "./time";

interface ParseArgs {
  text: string;
  currentTasks: TaskView[];
  now: TimeAnchor;
}

function makeParser(): {
  name: string;
  parse: (a: ParseArgs) => Promise<Utterance>;
} | null {
  // opt-in：默认不跑，要跑显式设 PROMPT_EVAL=1（专用 npm script: test:prompt-eval）
  if (process.env.PROMPT_EVAL !== "1" && process.env.PROMPT_EVAL !== "true") {
    return null;
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBase = process.env.OPENAI_BASE_URL;
  const openaiModel = process.env.OPENAI_MODEL;
  if (openaiKey && openaiBase && openaiModel) {
    const client = createOpenAIClient({
      apiKey: openaiKey,
      baseURL: openaiBase,
    });
    return {
      name: `OpenAI 兼容 (${openaiModel} @ ${openaiBase})`,
      parse: (args) => parseOpenAI({ client, model: openaiModel, ...args }),
    };
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const genai = createGenAI({
      apiKey: geminiKey,
      gatewayAccountId: process.env.CF_ACCOUNT_ID,
      gatewayId: process.env.CF_AI_GATEWAY_ID,
    });
    return { name: "Gemini", parse: (args) => parseGemini({ genai, ...args }) };
  }
  return null;
}

const TIMEOUT_MS = 30_000;

function buildTaskView(p: TaskFixture): TaskView {
  return {
    id: p.id,
    text: p.text,
    place: p.place ?? "any",
    window: p.window ?? "today",
    energy: 2,
    priority: 2,
    status: p.status ?? "pending",
    done: false,
  };
}

function assertAction(actual: Action, exp: ExpectedAction, idx: number): void {
  expect(actual.intent, `actions[${idx}].intent`).toBe(exp.intent);

  if (actual.intent === "ADD") {
    if (exp.taskTextContains) {
      expect(actual.task?.text ?? "", `actions[${idx}].task.text`).toContain(
        exp.taskTextContains,
      );
    }
    if (exp.hasExpectAt) {
      expect(
        actual.task?.expectAt,
        `actions[${idx}].task.expectAt 应填`,
      ).toBeTruthy();
    }
    if (exp.hasNoExpectAt) {
      expect(
        actual.task?.expectAt,
        `actions[${idx}].task.expectAt 应不填`,
      ).toBeFalsy();
    }
    if (exp.hasDueAt) {
      expect(
        actual.task?.dueAt,
        `actions[${idx}].task.dueAt 应填`,
      ).toBeTruthy();
    }
    if (exp.hasNoDueAt) {
      expect(
        actual.task?.dueAt,
        `actions[${idx}].task.dueAt 应不填`,
      ).toBeFalsy();
    }
  }

  if (
    actual.intent === "MODIFY" ||
    actual.intent === "STATUS" ||
    actual.intent === "DONE" ||
    actual.intent === "LINK"
  ) {
    if (exp.matchContains) {
      expect(actual.match ?? "", `actions[${idx}].match`).toContain(
        exp.matchContains,
      );
    }
  }

  if (actual.intent === "MODIFY") {
    if (exp.patchTextContains) {
      expect(actual.patch?.text ?? "", `actions[${idx}].patch.text`).toContain(
        exp.patchTextContains,
      );
    }
    if (exp.patchHasExpectAt) {
      expect(
        actual.patch?.expectAt,
        `actions[${idx}].patch.expectAt 应填`,
      ).toBeTruthy();
    }
  }

  if (actual.intent === "STATUS" && exp.patchStatus) {
    expect(actual.patch?.status, `actions[${idx}].patch.status`).toBe(
      exp.patchStatus,
    );
  }
}

const parser = makeParser();

describe.skipIf(!parser)(
  `AI prompt eval (${parser?.name ?? "未配置 provider，已跳过"})`,
  () => {
    const tz = normalizeTz("Asia/Shanghai");

    for (const c of CASES) {
      test(
        c.name,
        async () => {
          const anchor = describeNow(tz);
          const tasks = (c.currentTasks ?? []).map(buildTaskView);
          // biome-ignore lint/style/noNonNullAssertion: describe.skipIf 已经守卫了 parser 非空，TS 推断不到
          const u = await parser!.parse({
            text: c.text,
            currentTasks: tasks,
            now: { iso: anchor.iso, tz, weekday: anchor.weekday },
          });
          expect(u.actions, "生成 actions 数量与期望不一致").toHaveLength(
            c.expected.length,
          );
          for (const [i, exp] of c.expected.entries()) {
            assertAction(u.actions[i], exp, i);
          }
        },
        TIMEOUT_MS,
      );
    }
  },
);
