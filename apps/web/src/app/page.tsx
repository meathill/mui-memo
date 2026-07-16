import { LandingPageView } from "@/components/landing/landing-page";
import { createMarketingMetadata } from "@/lib/site";

export const metadata = createMarketingMetadata({
  title: "一句话，整理整张清单",
  description:
    "叨叨记已上架 App Store：说一句就能记下、拆分、改时间、勾完成，再用标签和场景筛出当前能做的事。",
  path: "/",
  keywords: [
    "语音待办",
    "语音清单",
    "AI 任务管理",
    "App Store",
    "iOS App",
    "标签筛选",
  ],
});

export default async function LandingPage() {
  return <LandingPageView />;
}
