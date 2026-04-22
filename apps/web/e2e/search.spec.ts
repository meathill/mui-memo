import { buildUtterance, expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

const DIM = 768;

/** 第 i 维为 1、其它为 0 的单位向量。 */
function unitVec(i: number): number[] {
  const v = new Array(DIM).fill(0);
  v[i] = 1;
  return v;
}

async function seed(page: Page, taskId: string, embedding: number[]) {
  const r = await page.request.post("/api/test-e2e/seed-embedding", {
    data: { taskId, embedding },
  });
  expect(r.status()).toBe(200);
}

test.describe("混合搜索", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("语义向量相同 → resolveTargetTask 命中对应任务", async ({
    inject,
    page,
  }) => {
    const addA = await inject(
      buildUtterance({
        raw: "ADD A",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "给老妈打电话", place: "any", window: "today" },
      }),
    );
    const idA = (addA.effect as { id?: string }).id as string;
    const addB = await inject(
      buildUtterance({
        raw: "ADD B",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "去超市买酱油", place: "any", window: "today" },
      }),
    );
    const idB = (addB.effect as { id?: string }).id as string;

    // 给 A 塞一个单位向量 e0，B 塞 e1（正交）
    await seed(page, idA, unitVec(0));
    await seed(page, idB, unitVec(1));

    // 用 e0 当查询向量 → 距离 A=0、距离 B=1 → 应当命中 A
    const res = await page.request.post("/api/test-e2e/resolve", {
      data: {
        query: "跟家里联系一下",
        fixedEmbedding: unitVec(0),
      },
    });
    const { resolved } = (await res.json()) as {
      resolved: { id: string; semanticDist: number } | null;
    };
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(idA);
    expect(resolved?.semanticDist).toBeLessThan(0.01);
  });

  test("语义向量正交、无关键词 → 落到阈值外，返回 null", async ({
    inject,
    page,
  }) => {
    const addA = await inject(
      buildUtterance({
        raw: "ADD A",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "给老妈打电话", place: "any", window: "today" },
      }),
    );
    const idA = (addA.effect as { id?: string }).id as string;
    await seed(page, idA, unitVec(0));

    // 用 e5 查，距离 ~1 > 阈值 0.55；没有 keyword 兜底 → null
    const res = await page.request.post("/api/test-e2e/resolve", {
      data: { query: "完全不相关的内容", fixedEmbedding: unitVec(5) },
    });
    const { resolved } = (await res.json()) as { resolved: unknown };
    expect(resolved).toBeNull();
  });

  test("没有向量、只靠关键词 LIKE → 也能命中", async ({ inject, page }) => {
    await inject(
      buildUtterance({
        raw: "ADD A",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "去超市买酱油", place: "any", window: "today" },
      }),
    );
    await inject(
      buildUtterance({
        raw: "ADD B",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "给老妈打电话", place: "any", window: "today" },
      }),
    );

    // 没 fixedEmbedding，resolver 内部 embedder 会抛 → 走纯关键词路径
    const res = await page.request.post("/api/test-e2e/resolve", {
      data: { query: "买酱油的事", keyword: "酱油" },
    });
    const { resolved } = (await res.json()) as {
      resolved: { text: string; keywordHit: boolean } | null;
    };
    expect(resolved).not.toBeNull();
    expect(resolved?.text).toBe("去超市买酱油");
    expect(resolved?.keywordHit).toBe(true);
  });
});
