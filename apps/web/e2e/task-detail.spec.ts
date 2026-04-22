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

test.describe("任务详情 · dueAt", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("ADD 时带 dueAt → 详情页展示 + /api/tasks/[id] 返回 ISO", async ({
    inject,
    page,
  }) => {
    const due = "2026-04-23T15:00:00+08:00";
    const res = await inject(
      buildUtterance({
        raw: "明天下午三点给老妈打电话",
        intent: "ADD",
        aiVerb: "新增",
        task: {
          text: "给老妈打电话",
          place: "any",
          window: "today",
          deadline: "明天 15:00",
          dueAt: due,
        },
      }),
    );
    const id = (res.effect as { id?: string }).id as string;

    // 接口往返
    const apiRes = await page.request.get(`/api/tasks/${id}`);
    const data = (await apiRes.json()) as {
      task: { deadline: string; dueAt: string };
    };
    expect(data.task.deadline).toBe("明天 15:00");
    expect(new Date(data.task.dueAt).toISOString()).toBe(
      new Date(due).toISOString(),
    );

    // 详情页渲染出 → 2026-4-23... 的展示文本（具体格式随 Intl 而定，
    // 只断言包含「4月」和「15:00」这两个关键 token）
    await page.goto(`/tasks/${id}`);
    const hint = page.locator("text=/→.*4月23日.*15:00/");
    await expect(hint).toBeVisible();
  });
});

test.describe("任务详情 · 手动编辑 dueAt", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("点「→ 点击设置具体时间」→ 输入本地时间 → PATCH ISO", async ({
    inject,
    page,
  }) => {
    const addRes = await inject(
      buildUtterance({
        raw: "ADD 无时间任务",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "等有空再看", place: "any", window: "later" },
      }),
    );
    const id = (addRes.effect as { id?: string }).id as string;

    await page.goto(`/tasks/${id}`);
    await page.getByRole("button", { name: "编辑截止时间" }).click();

    // datetime-local 输入：本机时间 2027-01-02 09:30
    const input = page.locator('input[type="datetime-local"]');
    await input.fill("2027-01-02T09:30");
    await input.blur();

    // 等 PATCH 写入
    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/tasks/${id}`);
        const data = (await res.json()) as { task: { dueAt: string | null } };
        return data.task.dueAt;
      })
      .not.toBeNull();

    const res = await page.request.get(`/api/tasks/${id}`);
    const data = (await res.json()) as { task: { dueAt: string | null } };
    const parsed = new Date(data.task.dueAt as string);
    // 以本机 tz 解析应当对上
    expect(parsed.getFullYear()).toBe(2027);
    expect(parsed.getMonth() + 1).toBe(1);
    expect(parsed.getDate()).toBe(2);
  });
});

test.describe("任务详情 · 拖拽上传", () => {
  test.beforeEach(async ({ resetTasks }) => {
    await resetTasks();
  });

  test("往附件区域 drop 一个文件 → 上传成功", async ({ inject, page }) => {
    const addRes = await inject(
      buildUtterance({
        raw: "ADD 拖拽测试",
        intent: "ADD",
        aiVerb: "新增",
        task: { text: "拖拽测试", place: "any", window: "today" },
      }),
    );
    const id = (addRes.effect as { id?: string }).id as string;

    await page.goto(`/tasks/${id}`);
    await expect(page.getByText("附件 · 0")).toBeVisible();

    // 合成一个带文件的 DataTransfer + drop 事件，丢到 attachments 区域
    const zone = page.getByTestId("attachments");
    await zone.evaluate((el) => {
      const file = new File(["hello drag"], "drop.txt", {
        type: "text/plain",
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      const mk = (type: string) =>
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        });
      el.dispatchEvent(mk("dragenter"));
      el.dispatchEvent(mk("dragover"));
      el.dispatchEvent(mk("drop"));
    });

    await expect(page.getByText("附件 · 1")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("drop.txt")).toBeVisible();
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
