import { GoogleGenAI } from "@google/genai";
import type { TaskView } from "@mui-memo/shared/logic";
import { type Utterance, utteranceSchema } from "@mui-memo/shared/validators";

const CHAT_MODEL = "gemini-3-flash-preview";

const SYSTEM_PROMPT = `你是 MuiMemo 的语音意图解析器。用户会说一句中文大白话，你需要把它转成一条结构化的 JSON 操作，用来更新用户的任务清单。

输出必须严格符合如下 JSON Schema（只输出 JSON，不要任何解释）：

{
  "raw": string,                   // 语音转写的原话
  "intent": "ADD" | "STATUS" | "DONE" | "MODIFY" | "LINK",
  "match"?: string,                // 在现有清单里定位任务的正则（中文 substring 也行）
  "aiReason": string,              // 你的推理原因，一句话，≤20字
  "aiVerb": string,                // 动作动词，≤4字，例如 "新增" "已完成" "改时间" "开始做" "顺手做"
  "task"?: {                       // ADD 时必填
    "text": string,                // 精炼的任务标题（≤16字）
    "place"?: "home"|"work"|"out"|"any",
    "window"?: "now"|"today"|"later",
    "energy"?: 1|2|3,
    "priority"?: 1|2|3,
    "tag"?: string,                // 「工作」「家务」「财务」「联络」「采购」「自我」等
    "deadline"?: string,           // 自然语言 label，如「明天」「下周一」「下午三点」「17:00」
    "expectAt"?: string,           // 用户「打算做」的时间，ISO 8601（见 "时间解析" 节）
    "dueAt"?: string               // 真正 deadline（最晚要做完），仅当用户显式说「最晚…」「…之前必须」时才填
  },
  "patch"?: {                      // STATUS/MODIFY 时写补丁字段（同 task 结构的子集，可含 status）
    ...
  },
  "createIfMissing"?: {            // DONE 时如果清单里找不到，才补一条
    ...                            // 结构同 task
  },
  "dims": [                        // AI 逐步推断出的维度，2~5 条即可
    { "kind": "intent"|"match"|"time"|"place"|"people"|"tag"|"note"|"energy"|"link",
      "label": string,             // 展示用（带 emoji 更好，如 "⏱ 今天 · 下班后"）
      "tone": "accent"|"good"|"warn"|"mute",
      "hint": string }             // 一句话解释（≤16字）
  ]
}

## 意图判断规则
- 完成时态（「…了」「搞定了」「买了」）→ DONE；如果清单有匹配，不要带 createIfMissing
- 「我现在去…」「我开始做…」「我去 X 办…」→ STATUS，并在 patch 中把 status="doing"
- 「顺便…」「顺手…」→ LINK（挂到当前 doing 任务下）
- 「改到…」「推迟到…」「改成…」→ MODIFY
- 其它新建场景（「记得…」「提醒我…」「晚上…买…」）→ ADD
- 当用户的话无法匹配清单里任何已有项，且是完成语义，把 createIfMissing 填好；其它无匹配场景 dims 里加 tone=warn 的 note

## 字段推断提示
- 只能在家做（浇花、洗碗、扔垃圾）→ place:home
- 公司相关（回邮件、见同事）→ place:work
- 出门才能做（跑腿、买东西、去银行）→ place:out
- 电话、打开电脑即可做 → place:any
- 「现在」「等一下」「马上」→ window:now
- 「今天」「下午」「晚上」 → window:today
- 「下周」「改天」「有空」「月底」 → window:later
- 有明确硬截止（数字时间/日期）→ priority:3
- 纯娱乐/自我 → priority:1
- 其它一般 → priority:2

## 时间解析（expectAt / dueAt）
- 锚点是 user message 里给出的「当前时间 / 时区」，**绝对不要**猜今天是哪天，
  所有相对时间都要以这个锚点推算。
- 两个时间字段语义截然不同：
  - **expectAt**：用户「打算做」的时刻。默认大部分时间表达都落在这里。
  - **dueAt**：真正 deadline（最晚要做完）。**只有**用户显式说了「最晚…」、
    「…之前必须」、「周五前要交」、「这周内」这种「宽限上限」时才填；否则
    就不填 dueAt，让 expectAt 唱主角。
- 两者都写进 deadline 这个自然语言 label（用户原话的规整短语）。
- 两者都是 ISO 8601，带跟锚点相同的时区偏移，精确到分钟。
- 样例：
  - 「明天下午三点给老妈打电话」→ expectAt=明天 15:00；dueAt 不填
  - 「明天给老妈打电话，最晚这周」→ expectAt=明天 23:59；dueAt=本周日 23:59
  - 「下周一前把物业费交了」→ dueAt=下周一 23:59；expectAt 不填（或填同值）
  - 「月底前」→ dueAt=本月最后一天 23:59
  - 「晚上八点」→ expectAt=今天 20:00（当前已过 20:00 则明天 20:00）
  - 「明天」「后天」不带时间 → expectAt=当日 23:59
  - 纯「改天」「有空」「看心情」→ expectAt 和 dueAt 都不填，window=later
- MODIFY 意图里用户改的时间通常是 expectAt（「改到下周一」）；除非他明
  确说「最晚…」才改 dueAt。把变化写进 patch。
`;

export interface GenAIConfig {
  apiKey: string;
  /** Cloudflare AI Gateway account id；设了就走 Gateway，未设直连 Google */
  gatewayAccountId?: string;
  /** Cloudflare AI Gateway id */
  gatewayId?: string;
}

/**
 * 创建一个共用的 Google GenAI 客户端。
 * 带 AI Gateway 时走：
 *   https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio
 * SDK 会自动补 `/v1beta/models/...`。
 */
export function createGenAI(cfg: GenAIConfig): GoogleGenAI {
  const baseUrl =
    cfg.gatewayAccountId && cfg.gatewayId
      ? `https://gateway.ai.cloudflare.com/v1/${cfg.gatewayAccountId}/${cfg.gatewayId}/google-ai-studio`
      : undefined;
  return new GoogleGenAI({
    apiKey: cfg.apiKey,
    httpOptions: baseUrl ? { baseUrl } : undefined,
  });
}

interface TimeAnchor {
  /** 当前时刻 ISO 8601（带时区偏移） */
  iso: string;
  /** IANA 时区名，如 Asia/Shanghai */
  tz: string;
  /** 中文星期，"周三" */
  weekday: string;
}

function buildUserPrompt(tasks: TaskView[], now: TimeAnchor): string {
  const head = `当前时间：${now.iso}（${now.tz}，${now.weekday}）。所有相对时间都要以此为锚。`;
  if (!tasks.length) return `${head}\n\n当前清单：空。`;
  const lines = tasks
    .filter((t) => !t.done && t.status !== "linked")
    .slice(0, 30)
    .map(
      (t) =>
        `- [${t.status}] ${t.text} · 地点:${t.place} · 时段:${t.window} · 优先:${t.priority}${
          t.deadline ? ` · 截止:${t.deadline}` : ""
        }${t.expectAt ? ` · expectAt:${t.expectAt}` : ""}${
          t.dueAt ? ` · dueAt:${t.dueAt}` : ""
        }${t.tag ? ` · #${t.tag}` : ""}`,
    );
  return `${head}\n\n当前清单：\n${lines.join("\n")}`;
}

async function audioToBase64(audio: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(audio);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extractJson(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced) return fenced[1];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

interface ParseOptions {
  genai: GoogleGenAI;
  audio: ArrayBuffer;
  audioMimeType: string;
  currentTasks: TaskView[];
  /** 时区锚点，AI 以此推算 dueAt */
  now: TimeAnchor;
}

/**
 * 把音频交给 Gemini，返回一条符合 utteranceSchema 的 Utterance。
 */
export async function parseVoiceIntent(opts: ParseOptions): Promise<Utterance> {
  const base64 = await audioToBase64(opts.audio);
  const userText = buildUserPrompt(opts.currentTasks, opts.now);

  const response = await opts.genai.models.generateContent({
    model: CHAT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: userText },
          { inlineData: { mimeType: opts.audioMimeType, data: base64 } },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const raw = response.text ?? "";
  if (!raw) throw new Error("Gemini returned empty content");

  const json = JSON.parse(extractJson(raw));
  return utteranceSchema.parse(json);
}
