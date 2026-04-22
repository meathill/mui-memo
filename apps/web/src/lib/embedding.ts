import type { GoogleGenAI } from "@google/genai";
import { EMBEDDING_DIM } from "@mui-memo/shared/schema";

const EMBED_MODEL = "text-embedding-004";

/**
 * 用 @google/genai 生成 768 维向量。`genai` 由 gemini.ts 的 `createGenAI`
 * 统一构造，自带 AI Gateway 路由。
 */
export async function embedText(
  genai: GoogleGenAI,
  text: string,
): Promise<number[]> {
  const res = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
  });
  const values = res.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Unexpected embedding shape: got ${values?.length ?? 0}, want ${EMBEDDING_DIM}`,
    );
  }
  return values;
}

export type Embedder = (text: string) => Promise<number[]>;

export function createEmbedder(genai: GoogleGenAI): Embedder {
  return (text: string) => embedText(genai, text);
}
