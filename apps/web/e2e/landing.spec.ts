import { expect, test } from './fixtures';

test.describe('landing 首页', () => {
  test('未登录时展示新版首屏、场景插画和注册 CTA', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /AI 就把小事收成待办/,
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: '免费注册' })).toBeVisible();
    await expect(page.getByText('01 · 记下')).toBeVisible();
    await expect(page.locator('a[href="#faq"]')).toBeVisible();

    const images = [
      page.getByRole('img', { name: /小卖铺店主/ }),
      page.getByRole('img', { name: /带娃的家长/ }),
      page.getByRole('img', { name: /自由职业设计师/ }),
    ];

    for (const image of images) {
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('src', /webp/);
    }
  });

  test('已登录时顶部和首屏 CTA 都切到进入应用', async ({ page }) => {
    await page.goto('/');

    const appLinks = page.getByRole('link', { name: /进入应用/ });
    await expect(appLinks).toHaveCount(2);
    await expect(appLinks.first()).toBeVisible();
    await expect(page.getByRole('link', { name: '免费注册' })).toHaveCount(0);
  });
});
