import { ContentPage } from '@/components/marketing/content-page';
import AboutDoc from '@/content/about.mdx';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '关于',
  description: '了解叨叨记想解决的问题、当前阶段，以及这个个人项目接下来会怎么推进。',
  path: '/about',
  keywords: ['关于叨叨记', '产品定位'],
});

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="这是一个把口语收成待办的个人项目。"
      lead="叨叨记先把一句大白话收住，再让任务慢慢变得有秩序。它不是全能系统，而是一个尽量减少整理动作的入口。"
    >
      <AboutDoc />
    </ContentPage>
  );
}
