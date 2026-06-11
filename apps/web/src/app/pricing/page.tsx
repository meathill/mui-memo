import { PricingPageView } from '@/components/marketing/pricing-page';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '价格',
  description: '叨叨记已上架 App Store，免费每月 120 次 AI 操作；Pro ¥6/月解锁无限 AI 操作。',
  path: '/pricing',
  keywords: ['叨叨记价格', 'Pro 订阅', 'App Store', 'iOS App'],
});

export default function PricingPage() {
  return <PricingPageView />;
}
