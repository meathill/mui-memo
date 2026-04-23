import { sql } from 'drizzle-orm';
import type { Database } from './db';

/**
 * 混合搜索结果：fts + vec 各跑一遍 Top-K，在 TS 里用 RRF 合并，返回得分最高的一条。
 */
export interface ResolveResult {
  id: string;
  text: string;
  score: number;
  fromFts: boolean;
  fromVec: boolean;
}

const TOP_K = 8;
const RRF_K = 60;
const FTS_WEIGHT = 1.2;
const VEC_WEIGHT = 1;
/**
 * 纯向量命中（没有 fts 支撑）时要求的最大余弦距离。
 * 实测 Titan embed-v2 在中文任务文本上：
 * - 语义相似（「跟家里联系」vs「给老妈打电话」）≈ 0.66
 * - 完全无关 ≥ 0.85
 * 取 0.75 作为门槛，留足间距。
 */
const VEC_ONLY_MAX_DIST = 0.75;

interface Row {
  id: string;
  text: string;
}

interface VecRow extends Row {
  dist: number;
}

type DbExecute = unknown;

function extractRows<T>(result: DbExecute): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object') {
    const obj = result as { rows?: T[] };
    if (Array.isArray(obj.rows)) return obj.rows;
  }
  return [];
}

/**
 * 混合搜索 tasks.text：
 * - 全文召回：`fts_match_word(query, text)`，按 BM25 排序
 * - 向量召回：`VEC_EMBED_COSINE_DISTANCE(embedding, query)`，TiDB 内部自动嵌入
 * - TS 侧用 RRF 合并双方 Top-K，返回单条最佳匹配
 *
 * fts 是 early-stage 特性，有的 region 没开；抛错时回退到 LIKE。
 */
export async function resolveTargetTask(
  db: Database,
  userId: string,
  query: string,
  keyword: string | undefined,
): Promise<ResolveResult | null> {
  const q = (query || keyword || '').trim();
  if (!q) return null;

  // fts / vec 分两路，各 fallback 单路也能出结果
  const [ftsRows, vecRows] = await Promise.all([
    queryFts(db, userId, q).catch(() => queryLike(db, userId, q)),
    queryVec(db, userId, q).catch(() => [] as VecRow[]),
  ]);

  if (!ftsRows.length && !vecRows.length) return null;

  // 纯语义召回但距离都超阈值 → 视为无关，放弃。防止无关 query 瞎 match。
  const ftsIds = new Set(ftsRows.map((r) => r.id));
  const qualifiedVec = vecRows.filter((r) => ftsIds.has(r.id) || r.dist <= VEC_ONLY_MAX_DIST);

  if (!ftsRows.length && !qualifiedVec.length) return null;

  // RRF：第 i 位贡献 weight / (K + i + 1)
  const scoreMap = new Map<string, ResolveResult>();
  const accumulate = (rows: Row[], weight: number, flag: 'fromFts' | 'fromVec') => {
    rows.forEach((r, i) => {
      const inc = weight / (RRF_K + i + 1);
      const prev = scoreMap.get(r.id);
      if (prev) {
        prev.score += inc;
        prev[flag] = true;
      } else {
        scoreMap.set(r.id, {
          id: r.id,
          text: r.text,
          score: inc,
          fromFts: flag === 'fromFts',
          fromVec: flag === 'fromVec',
        });
      }
    });
  };
  accumulate(ftsRows, FTS_WEIGHT, 'fromFts');
  accumulate(qualifiedVec, VEC_WEIGHT, 'fromVec');

  let best: ResolveResult | null = null;
  for (const r of scoreMap.values()) {
    if (!best || r.score > best.score) best = r;
  }
  return best;
}

async function queryFts(db: Database, userId: string, q: string): Promise<Row[]> {
  const res = await db.execute<Row>(sql`
    SELECT id, text
    FROM tasks
    WHERE user_id = ${userId}
      AND status IN ('pending', 'doing')
      AND fts_match_word(${q}, text)
    ORDER BY fts_match_word(${q}, text) DESC, id DESC
    LIMIT ${TOP_K}
  `);
  return extractRows<Row>(res);
}

async function queryVec(db: Database, userId: string, q: string): Promise<VecRow[]> {
  // 走向量子查询拿 top-K，再回主表取 text，避免把 vector 列读回来
  const res = await db.execute<VecRow>(sql`
    SELECT t.id, t.text, ranked.dist AS dist
    FROM tasks t
    INNER JOIN (
      SELECT id, VEC_EMBED_COSINE_DISTANCE(embedding, ${q}) AS dist
      FROM tasks
      WHERE user_id = ${userId}
        AND status IN ('pending', 'doing')
      ORDER BY dist ASC
      LIMIT ${TOP_K}
    ) AS ranked ON ranked.id = t.id
    ORDER BY ranked.dist ASC
  `);
  return extractRows<VecRow>(res).map((r) => ({
    ...r,
    dist: Number(r.dist),
  }));
}

async function queryLike(db: Database, userId: string, q: string): Promise<Row[]> {
  const like = `%${q}%`;
  const res = await db.execute<Row>(sql`
    SELECT id, text
    FROM tasks
    WHERE user_id = ${userId}
      AND status IN ('pending', 'doing')
      AND text LIKE ${like}
    ORDER BY id DESC
    LIMIT ${TOP_K}
  `);
  return extractRows<Row>(res);
}
