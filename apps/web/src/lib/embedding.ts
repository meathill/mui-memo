import { EMBEDDING_DIM } from "@mui-memo/shared/schema";

const EMBED_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

interface EmbedResponse {
  embedding?: { values?: number[] };
}

/**
 * 调用 Gemini text-embedding-004 生成 768 维向量。
 * 失败时抛错，由调用方决定是否降级。
 */
export async function embedText(
  apiKey: string,
  text: string,
): Promise<number[]> {
  const res = await fetch(
    `${EMBED_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      }),
    },
  );
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Embedding ${res.status}: ${msg.slice(0, 200)}`);
  }
  const data = (await res.json()) as EmbedResponse;
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Unexpected embedding shape: got ${values?.length ?? 0}, want ${EMBEDDING_DIM}`,
    );
  }
  return values;
}

export type Embedder = (text: string) => Promise<number[]>;

export function createEmbedder(apiKey: string): Embedder {
  return (text: string) => embedText(apiKey, text);
}
