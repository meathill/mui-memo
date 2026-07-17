import Link from "next/link";
import { ContentPage } from "@/components/marketing/content-page";
import SupportDoc from "@/content/support.md";
import { APP_STORE_URL, createMarketingMetadata } from "@/lib/site";

export const metadata = createMarketingMetadata({
	title: "支持",
	description:
		"叨叨记的下载与求助入口：App Store、网页版、联系邮箱、常见问题、订阅与退款、数据删除流程。",
	path: "/support",
	keywords: ["叨叨记 支持", "App Store", "帮助", "反馈", "退款"],
});

export default function SupportPage() {
	return (
		<ContentPage
			eyebrow="Support"
			title="叨叨记 帮你跑通最后一段。"
			lead="先下载正式版；遇到问题再发邮件。个人开发，没客服系统，bug、订阅 / 数据请求都走邮件。"
		>
			<section>
				<h2>下载和使用</h2>
				<ul>
					<li>
						iOS 正式版：
						<a href={APP_STORE_URL} target="_blank" rel="noreferrer">
							App Store 下载叨叨记
						</a>
					</li>
					<li>
						网页版：
						<Link href="/register">注册后直接试用</Link>，和 iOS App
						共用同一份账号和清单
					</li>
				</ul>
			</section>
			<SupportDoc />
		</ContentPage>
	);
}
