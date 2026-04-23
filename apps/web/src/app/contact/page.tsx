import { ContentPage } from '@/components/marketing/content-page';
import ContactDoc from '@/content/contact.mdx';
import { createMarketingMetadata, SITE_EMAIL } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '联系',
  description: `通过 ${SITE_EMAIL} 联系 MuiMemo，反馈 bug、讨论产品、处理隐私或数据删除请求。`,
  path: '/contact',
  keywords: ['联系 MuiMemo', '反馈 bug', '数据删除'],
});

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Contact"
      title="有问题，直接发邮件。"
      lead="当前没有表单后端，也没有客服系统。对于 bug、建议、合作与数据删除请求，邮件是最直接、最稳定的入口。"
    >
      <ContactDoc />
    </ContentPage>
  );
}
