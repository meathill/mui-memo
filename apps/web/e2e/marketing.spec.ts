import { expect, test } from './fixtures';

const SITE_URL = 'https://muimemo.roudan.io';

const PUBLIC_PAGES = [
  {
    href: '/about',
    heading: '这是一个把口语收成待办的个人项目。',
    title: /关于 · MuiMemo/,
  },
  {
    href: '/contact',
    heading: '有问题，直接发邮件。',
    title: /联系 · MuiMemo/,
  },
  {
    href: '/privacy',
    heading: '只写当前真实发生的数据处理。',
    title: /隐私说明 · MuiMemo/,
  },
  {
    href: '/terms',
    heading: '先把服务边界讲清楚。',
    title: /服务条款 · MuiMemo/,
  },
] as const;

test.describe('marketing 静态页与 SEO', () => {
  test('四个静态页可访问、标题正确，页脚可互通', async ({ page }) => {
    for (const item of PUBLIC_PAGES) {
      await page.goto(item.href);

      await expect(page).toHaveTitle(item.title);
      await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
      const footer = page.locator('footer');

      await expect(footer.getByRole('link', { name: 'About' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
    }
  });

  test('robots.txt 与 sitemap.xml 只暴露公开路由', async ({ page }) => {
    const robots = await page.request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();

    const robotsText = await robots.text();
    expect(robotsText).toContain('Allow: /');
    expect(robotsText).toContain('Disallow: /app');
    expect(robotsText).toContain('Disallow: /api/');
    expect(robotsText).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);

    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();

    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(sitemapText).toContain(`<loc>${SITE_URL}/about</loc>`);
    expect(sitemapText).toContain(`<loc>${SITE_URL}/contact</loc>`);
    expect(sitemapText).toContain(`<loc>${SITE_URL}/privacy</loc>`);
    expect(sitemapText).toContain(`<loc>${SITE_URL}/terms</loc>`);
    expect(sitemapText).not.toContain(`${SITE_URL}/app</loc>`);
    expect(sitemapText).not.toContain(`${SITE_URL}/login</loc>`);
  });

  test('登录、注册、onboarding 与 app 页面都输出 noindex', async ({ page }) => {
    for (const href of ['/login', '/register', '/onboarding', '/app']) {
      await page.goto(href);

      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveAttribute('content', /noindex/i);
    }
  });
});
