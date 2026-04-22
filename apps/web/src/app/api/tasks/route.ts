import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { listTasksForUser } from "@/lib/tasks";
import { rerank } from "@mui-memo/shared/logic";
import { taskPlaceEnum } from "@mui-memo/shared/validators";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const placeParam = url.searchParams.get("place") ?? "any";
  const placeParsed = taskPlaceEnum.safeParse(placeParam);
  const place = placeParsed.success ? placeParsed.data : "any";

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.TIDB_DATABASE_URL);
  const tasks = await listTasksForUser(db, session.user.id);
  const ranked = rerank(tasks, place);

  return NextResponse.json({ tasks, ranked, place });
}
