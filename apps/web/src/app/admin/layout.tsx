import { NO_INDEX_METADATA } from "@/lib/site";

// Access 在边缘挡（见 API route 注释）；这里只做搜索引擎层面的 noindex。
// 刻意不在 /app 分组下：admin 不需要 Better-Auth session，也不进 BottomNav。
export const dynamic = "force-dynamic";
export const metadata = NO_INDEX_METADATA;

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
