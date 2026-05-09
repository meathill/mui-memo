import { LandingPageView } from '@/components/landing/landing-page';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '一句话，整理整张清单',
  description: '叨叨记是语音操控的 todo：说一句就能记下、拆分、改时间、勾完成、找回，未来还能 @ 联系人把事派出去。',
  path: '/',
  keywords: ['语音待办', '语音清单', 'AI 任务管理', '意图驱动任务'],
});

export default async function LandingPage() {
  return <LandingPageView />;
}
