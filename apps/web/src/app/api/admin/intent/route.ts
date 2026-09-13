import { utterances as utterancesTable } from "@mui-memo/shared/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { buildIntentStats, parseDaysParam } from "@/lib/admin-stats";
import { createDb } from "@/lib/db";

/**
 * AI 质量聚合：intent / effectKind 分布 + miss 率 + 日趋势。
 * 只返回计数，不返回 rawText 等用户原话。
 *
 * 鉴权同 overview：Cloudflare Access 在边缘按路径保护（见该文件注释）。
 * provider / 地区切分暂无：utterances 表尚无 provider/country 列（v2 迁移再加）。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const days = parseDaysParam(searchParams.get("days"));
	const since = new Date(Date.now() - days * 86_400_000);

	const { env } = await getCloudflareContext({ async: true });
	const db = createDb(env.TIDB_DATABASE_URL);

	const rows = await db
		.select({
			createdAt: utterancesTable.createdAt,
			intent: utterancesTable.intent,
			effectKind: utterancesTable.effectKind,
		})
		.from(utterancesTable)
		.where(gte(utterancesTable.createdAt, since));

	return NextResponse.json(buildIntentStats(rows, days));
}
