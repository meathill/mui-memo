import { type Utterance, utteranceSchema } from "@mui-memo/shared/validators";
import type { TaskView } from "@mui-memo/shared/logic";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
    "deadline"?: string            // 自然语言，如「下周一」「17:00」
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
`;

function buildUserPrompt(tasks: TaskView[]): string {
  if (!tasks.length) return "当前清单：空。";
  const lines = tasks
    .filter((t) => !t.done && t.status !== "linked")
    .slice(0, 30)
    .map(
      (t) =>
        `- [${t.status}] ${t.text} · 地点:${t.place} · 时段:${t.window} · 优先:${t.priority}${
          t.deadline ? ` · 截止:${t.deadline}` : ""
        }${t.tag ? ` · #${t.tag}` : ""}`,
    );
  return `当前清单：\n${lines.join("\n")}`;
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
  apiKey: string;
  audio: ArrayBuffer;
  audioMimeType: string;
  currentTasks: TaskView[];
}

/**
 * 把音频交给 Gemini，返回一条符合 utteranceSchema 的 Utterance。
 */
export async function parseVoiceIntent(opts: ParseOptions): Promise<Utterance> {
  const base64 = await audioToBase64(opts.audio);
  const userText = buildUserPrompt(opts.currentTasks);

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: userText },
          {
            inline_data: {
              mime_type: opts.audioMimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };

  const res = await fetch(
    `${GEMINI_ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  if (!raw) throw new Error("Gemini returned empty content");

  const json = JSON.parse(extractJson(raw));
  return utteranceSchema.parse(json);
}
