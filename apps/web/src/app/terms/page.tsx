import { ContentPage } from '@/components/marketing/content-page';
import TermsDoc from '@/content/terms.md';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '服务条款',
  description: '查看 MuiMemo 当前个人项目版本的服务边界、可接受使用规则、责任限制与联系方式。',
  path: '/terms',
  keywords: ['MuiMemo 条款', '服务边界', '责任限制'],
});

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Terms"
      title="先把服务边界讲清楚。"
      lead="MuiMemo 现在是持续迭代中的个人项目。这里说明它适合怎么用、不承诺什么，以及你和我各自承担哪些责任。"
    >
      <TermsDoc />
    </ContentPage>
  );
}
