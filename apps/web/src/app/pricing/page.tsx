import { PricingPageView } from '@/components/marketing/pricing-page';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '价格',
  description:
    '叨叨记免费每月 120 次 AI 操作；Pro ¥6/月 解锁无限；Team ¥18/人/月 即将上线，给小团队 / 家庭 / 店铺协作用。',
  path: '/pricing',
  keywords: ['叨叨记价格', 'Pro 订阅', 'Team 协作'],
});

export default function PricingPage() {
  return <PricingPageView />;
}
