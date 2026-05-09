import { ContentPage } from '@/components/marketing/content-page';
import SupportDoc from '@/content/support.md';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '支持',
  description: '叨叨记的求助入口：联系邮箱、常见问题、订阅与退款、数据删除流程。',
  path: '/support',
  keywords: ['叨叨记 支持', '帮助', '反馈', '退款'],
});

export default function SupportPage() {
  return (
    <ContentPage
      eyebrow="Support"
      title="叨叨记 帮你跑通最后一段。"
      lead="个人开发，没客服系统。所有问题、bug、订阅 / 数据请求都走邮件，最稳定也最快。"
    >
      <SupportDoc />
    </ContentPage>
  );
}
