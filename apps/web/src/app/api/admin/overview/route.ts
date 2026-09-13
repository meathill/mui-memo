import {
	tasks as tasksTable,
	users as usersTable,
	utterances as utterancesTable,
} from "@mui-memo/shared/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { gte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { buildOverview, parseDaysParam } from "@/lib/admin-stats";
import { createDb } from "@/lib/db";

/**
 * 全站运营大盘聚合。只返回数字，不返回任何文本明细（任务正文/语音原话禁出）。
 *
 * 鉴权：不走 Better-Auth。由 Cloudflare Zero Trust Access Application
 * 在边缘按路径保护 `/admin*` + `/api/admin*`（Dashboard 配置，零代码）。
 * 详见 DEV_NOTE.md「Admin + Access」一节。
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const days = parseDaysParam(searchParams.get("days"));
	const since = new Date(Date.now() - days * 86_400_000);

	const { env } = await getCloudflareContext({ async: true });
	const db = createDb(env.TIDB_DATABASE_URL);

	const [
		[userTotal],
		[taskTotal],
		[utteranceTotal],
		userRows,
		taskRows,
		utteranceRows,
	] = await Promise.all([
		db.select({ total: sql<number>`count(*)` }).from(usersTable),
		db.select({ total: sql<number>`count(*)` }).from(tasksTable),
		db.select({ total: sql<number>`count(*)` }).from(utterancesTable),
		db
			.select({ createdAt: usersTable.createdAt })
			.from(usersTable)
			.where(gte(usersTable.createdAt, since)),
		// 完成口径按 completedAt 落桶：期内完成的任务即使创建于期外也要捞回
		db
			.select({
				createdAt: tasksTable.createdAt,
				completedAt: tasksTable.completedAt,
				status: tasksTable.status,
				userId: tasksTable.userId,
			})
			.from(tasksTable)
			.where(
				or(
					gte(tasksTable.createdAt, since),
					gte(tasksTable.completedAt, since),
				),
			),
		db
			.select({
				createdAt: utterancesTable.createdAt,
				userId: utterancesTable.userId,
			})
			.from(utterancesTable)
			.where(gte(utterancesTable.createdAt, since)),
	]);

	return NextResponse.json(
		buildOverview(
			{
				users: userRows,
				tasks: taskRows.map((r) => ({
					createdAt: r.createdAt,
					completedAt: r.completedAt,
					status: r.status,
					userId: r.userId,
				})),
				utterances: utteranceRows,
				totals: {
					users: Number(userTotal?.total ?? 0),
					tasks: Number(taskTotal?.total ?? 0),
					utterances: Number(utteranceTotal?.total ?? 0),
				},
			},
			days,
		),
	);
}
