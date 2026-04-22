import { buildUtterance, expect, test } from "./fixtures";

async function addTaskAndGetId(
  inject: (
    utterance: ReturnType<typeof buildUtterance>,
  ) => Promise<{ effect: { kind: string; id?: string } }>,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await inject(
    buildUtterance({
      raw: `ADD ${text}`,
      intent: "ADD",
      aiVerb: "新增",
      task: {
        text,
        place: "any",
        window: "today",
        priority: 2,
        ...extra,
      },
    }),
  );
  expect(res.effect.kind).toBe("add");
  expect(res.effect.id).toBeTruthy();
  return res.effect.id as string;
}

test.describe("任务详情 · 字段编辑", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("详情页展示 + 修改标签 + 修改状态 + 切换优先级", async ({
    inject,
    page,
  }) => {
    const id = await addTaskAndGetId(inject, "付物业费", { tag: "财务" });

    await page.goto(`/tasks/${id}`);
    await expect(page.getByText("任务详情")).toBeVisible();
    await expect(page.getByLabel("内容")).toHaveValue("付物业费");

    // 改标签
    const tagInput = page.getByLabel("标签");
    await tagInput.fill("家务");
    await tagInput.blur();

    // 改状态为 正在做
    await page.getByRole("button", { name: "正在做", exact: true }).click();

    // 改优先级为 高
    await page.getByRole("button", { name: "高", exact: true }).click();

    // 通过 API 直接拉，确认持久化
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/tasks/${id}`);
          const data = (await res.json()) as {
            task: { tag: string; status: string; priority: number };
          };
          return data.task;
        },
        { timeout: 10_000, intervals: [400, 800, 1500] },
      )
      .toMatchObject({ tag: "家务", status: "doing", priority: 3 });
  });

  test("改完状态=done 会写 completedAt，并在 /completed 里看到", async ({
    inject,
    page,
  }) => {
    const id = await addTaskAndGetId(inject, "寄快递");

    await page.goto(`/tasks/${id}`);
    await page.getByRole("button", { name: "已完成", exact: true }).click();

    // API 端 completedAt 非空
    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/tasks/${id}`);
        const data = (await res.json()) as {
          task: { status: string; completedAt: string | null };
        };
        return data.task.completedAt;
      })
      .not.toBeNull();

    await page.goto("/completed");
    await expect(page.getByText("寄快递")).toBeVisible();
  });
});

test.describe("任务详情 · 附件", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  // 最小合法 PNG（1×1 透明像素）
  const TINY_PNG = Buffer.from(
    "89504E470D0A1A0A0000000D4948445200000001000000010806000000" +
      "1F15C4890000000D49444154789C6360000000000200010B3C2D0B000000" +
      "0049454E44AE426082",
    "hex",
  );

  test("上传图片 → 列表出现 → 删除 → 消失", async ({ inject, page }) => {
    const id = await addTaskAndGetId(inject, "装修参考");

    await page.goto(`/tasks/${id}`);
    await expect(page.getByText("附件 · 0")).toBeVisible();

    // 直接喂 input[type=file]，触发 onChange → POST 上传
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });

    // 上传完列表更新
    await expect(page.getByText("附件 · 1")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("tiny.png")).toBeVisible();
    await expect(page.getByText(/image\/png/)).toBeVisible();

    // 删除（等后端 DELETE 完成再查库，避免竞态）
    const deletePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/attachments/") &&
        r.request().method() === "DELETE",
    );
    await page.getByRole("button", { name: "删除附件" }).click();
    await deletePromise;
    await expect(page.getByText("附件 · 0")).toBeVisible();
    await expect(page.getByText("tiny.png")).toHaveCount(0);

    // DB 端也确认
    const res = await page.request.get(`/api/tasks/${id}`);
    const data = (await res.json()) as { attachments: unknown[] };
    expect(data.attachments).toEqual([]);
  });
});

test.describe("任务详情 · 导航", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("Today 页点任务行进入详情", async ({ inject, page }) => {
    const id = await addTaskAndGetId(inject, "点进去试试", {
      window: "now",
      place: "any",
    });

    await page.goto("/");
    await page.getByText("点进去试试").first().click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${id}$`));
    await expect(page.getByText("任务详情")).toBeVisible();
  });
});
