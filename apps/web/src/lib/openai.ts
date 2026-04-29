import type { TaskView } from '@mui-memo/shared/logic';
import { type Utterance, utteranceSchema } from '@mui-memo/shared/validators';
import OpenAI, { APIError } from 'openai';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import { audioToBase64, buildUserPrompt, extractJson, SYSTEM_PROMPT, type TimeAnchor } from './intent-shared';

export interface OpenAIClientConfig {
  apiKey: string;
  /** OpenAI 兼容端点，例如小米 MIMO 的 https://api.xiaomimimo.com/v1 */
  baseURL: string;
}

export function createOpenAIClient(cfg: OpenAIClientConfig): OpenAI {
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
  });
}

interface ParseOptions {
  client: OpenAI;
  model: string;
  audio: ArrayBuffer;
  audioMimeType: string;
  currentTasks: TaskView[];
  /** 时区锚点，AI 以此推算 dueAt */
  now: TimeAnchor;
}

/**
 * MIMO 文档明确支持的音频格式：MP3 / WAV / FLAC / M4A / OGG。
 * webm 不在列表里（这是 web MediaRecorder 默认产物），所以前端要避开。
 * @see https://platform.xiaomimimo.com/docs/zh-CN/usage-guide/multimodal-understanding/audio-understanding
 */
const MIMO_SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'm4a', 'ogg'] as const;
type MimoAudioFormat = (typeof MIMO_SUPPORTED_FORMATS)[number];

/**
 * 把 audio/* mimeType 映射到 MIMO 接受的 input_audio.format。
 * 不在白名单里的（比如 webm）会抛错，前端必须录成支持的格式。
 */
function pickAudioFormat(mimeType: string): MimoAudioFormat {
  const mt = mimeType.toLowerCase();
  if (mt.includes('mp3') || mt.includes('mpeg')) return 'mp3';
  if (mt.includes('flac')) return 'flac';
  if (mt.includes('m4a') || mt.includes('mp4')) return 'm4a';
  if (mt.includes('wav')) return 'wav';
  if (mt.includes('ogg') || mt.includes('opus')) return 'ogg';
  throw new Error(`MIMO 不支持的音频格式：${mimeType}（仅支持 ${MIMO_SUPPORTED_FORMATS.join(' / ')}）`);
}

/**
 * 用 OpenAI 兼容多模态 chat 接口处理音频，返回符合 utteranceSchema 的 Utterance。
 * 默认目标是小米 MIMO 的 OpenAI 兼容端点，但理论上任何同协议的服务都行。
 */
export async function parseVoiceIntent(opts: ParseOptions): Promise<Utterance> {
  const base64 = await audioToBase64(opts.audio);
  const userText = buildUserPrompt(opts.currentTasks, opts.now);
  const format = pickAudioFormat(opts.audioMimeType);

  const userParts: ChatCompletionContentPart[] = [
    { type: 'text', text: userText },
    {
      type: 'input_audio',
      // OpenAI SDK 把 format 类型缩到 'wav' | 'mp3'，但 MIMO 兼容端点接受
      // mp3/wav/flac/m4a/ogg 全部，cast 一下绕过类型限制
      input_audio: { data: base64, format: format as 'wav' | 'mp3' },
    },
  ];

  let response: Awaited<ReturnType<typeof opts.client.chat.completions.create>>;
  try {
    response = await opts.client.chat.completions.create({
      model: opts.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userParts },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });
  } catch (err) {
    // OpenAI SDK 的 APIError 把服务器返回的 JSON body 放在 .error 上，里面通常有
    // 比顶层 message 更细的描述（哪个 param 不对、code 等）。route.ts 的 catch
    // 只读 err.message，所以这里把 detail 揉进去再 throw。
    if (err instanceof APIError) {
      const body = err.error as { message?: string; type?: string } | undefined;
      const parts = [
        body?.message,
        err.code ? `code=${err.code}` : null,
        err.param ? `param=${err.param}` : null,
        body?.type ? `type=${body.type}` : null,
        `sentMime=${opts.audioMimeType}`,
        `sentFormat=${format}`,
      ].filter(Boolean);
      const detail = parts.length ? parts.join(' · ') : err.message;
      throw new Error(`OpenAI/MIMO ${err.status ?? ''} ${detail}`);
    }
    throw err;
  }

  const raw = response.choices[0]?.message?.content ?? '';
  if (!raw) throw new Error('OpenAI/MIMO returned empty content');

  const json = JSON.parse(extractJson(raw));
  // MIMO（以及大多数 OpenAI 类模型）的习惯是把 optional 字段填 null 而不是省略，
  // 但 utteranceSchema 是按 Gemini 习惯写的（缺失就省略），不接受 null。
  // 先把 null 全删掉，再交给 zod。
  return utteranceSchema.parse(stripNullsDeep(json));
}

function stripNullsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullsDeep);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = stripNullsDeep(v);
    }
    return out;
  }
  return value;
}
