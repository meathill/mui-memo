import { sql } from "drizzle-orm";
import type { Database } from "./db";
import type { Embedder } from "./embedding";

/**
 * 混合搜索结果：优先从语义 + 关键词两种信号合并打分，返回最相关 task id。
 */
export interface ResolveResult {
  id: string;
  text: string;
  score: number;
  semanticDist: number;
  keywordHit: boolean;
}

const SEMANTIC_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;
/** 语义距离超过这个阈值就不算命中（越小越相似） */
const SEMANTIC_THRESHOLD = 0.55;

interface Row {
  id: string;
  text: string;
  dist: number | null;
  kw: number;
}

/**
 * 在用户的非完成任务里做混合搜索：
 *   - TiDB `VEC_COSINE_DISTANCE` 计算语义相似
 *   - MySQL `LIKE %keyword%` 做关键词命中
 *   - 把两种分数归一后加权相加，返回 Top 1
 *
 * query = AI 给出的 `match` 提示（优先）或原始语音转写文本。
 * keyword = AI 提示里的核心关键字（可选，用于 LIKE）。
 */
export async function resolveTargetTask(
  db: Database,
  userId: string,
  query: string,
  keyword: string | undefined,
  embedder: Embedder,
): Promise<ResolveResult | null> {
  if (!query.trim() && !keyword) return null;

  let embedding: number[];
  try {
    embedding = await embedder(query || keyword || "");
  } catch {
    // 没有 embedding 就退化为纯关键词搜索
    embedding = [];
  }

  const vecLiteral = embedding.length ? `[${embedding.join(",")}]` : null;
  const kwPattern = keyword ? `%${keyword}%` : null;

  // TiDB: 当 embedding 列为 NULL 时 VEC_COSINE_DISTANCE 会报错，所以 WHERE 里过滤
  // 用 sql 模板直接下推
  const result = await db.execute<Row>(sql`
    SELECT
      id,
      text,
      ${vecLiteral !== null ? sql`VEC_COSINE_DISTANCE(embedding, ${vecLiteral})` : sql`NULL`} AS dist,
      ${kwPattern !== null ? sql`CASE WHEN text LIKE ${kwPattern} THEN 1 ELSE 0 END` : sql`0`} AS kw
    FROM tasks
    WHERE user_id = ${userId}
      AND status IN ('pending', 'doing')
      ${vecLiteral !== null ? sql`AND embedding IS NOT NULL` : sql``}
    ORDER BY
      ${vecLiteral !== null ? sql`dist ASC` : sql`kw DESC`}
    LIMIT 8
  `);

  // drizzle 对 tidb-serverless 的 execute 返回 { rows }
  const rows = extractRows<Row>(result);
  if (!rows.length) return null;

  let best: ResolveResult | null = null;
  for (const row of rows) {
    const dist = row.dist ?? 1;
    const kwHit = Number(row.kw) === 1;
    const semanticScore = dist <= SEMANTIC_THRESHOLD ? 1 - dist : 0;
    const keywordScore = kwHit ? 1 : 0;
    const score =
      semanticScore * SEMANTIC_WEIGHT + keywordScore * KEYWORD_WEIGHT;
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = {
        id: row.id,
        text: row.text,
        score,
        semanticDist: dist,
        keywordHit: kwHit,
      };
    }
  }
  return best;
}

function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object") {
    const obj = result as { rows?: T[] };
    if (Array.isArray(obj.rows)) return obj.rows;
  }
  return [];
}
