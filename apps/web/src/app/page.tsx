import { LandingPageView } from '@/components/landing/landing-page';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '说一句话，AI 就把小事收成待办',
  description: '叨叨记会理解你的意图，顺手补上时间、优先级和场景，让该做的事在该浮出来的时候浮出来。',
  path: '/',
  keywords: ['语音待办', 'AI 口述备忘', '意图驱动任务'],
});

export default async function LandingPage() {
  return <LandingPageView />;
}
