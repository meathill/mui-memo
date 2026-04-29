import { GoogleGenAI } from '@google/genai';
import type { TaskView } from '@mui-memo/shared/logic';
import { type Utterance, utteranceSchema } from '@mui-memo/shared/validators';
import { audioToBase64, buildUserPrompt, extractJson, SYSTEM_PROMPT, type TimeAnchor } from './intent-shared';

const CHAT_MODEL = 'gemini-3-flash-preview';

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
        role: 'user',
        parts: [{ text: userText }, { inlineData: { mimeType: opts.audioMimeType, data: base64 } }],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const raw = response.text ?? '';
  if (!raw) throw new Error('Gemini returned empty content');

  const json = JSON.parse(extractJson(raw));
  return utteranceSchema.parse(json);
}
