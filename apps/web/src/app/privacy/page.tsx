import { ContentPage } from '@/components/marketing/content-page';
import PrivacyDoc from '@/content/privacy.md';
import { createMarketingMetadata } from '@/lib/site';

export const metadata = createMarketingMetadata({
  title: '隐私说明',
  description: '查看 MuiMemo 当前真实的数据处理链路，包括账号信息、任务、录音、附件、AI 解析与分析埋点。',
  path: '/privacy',
  keywords: ['MuiMemo 隐私', '数据处理', '录音存储'],
});

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Privacy"
      title="只写当前真实发生的数据处理。"
      lead="这份说明基于现有代码链路：账号、任务、语音、附件、AI 解析和基础分析分别去了哪里、拿来做什么、哪些数据你现在能自己删。"
    >
      <PrivacyDoc />
    </ContentPage>
  );
}
