import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { BottomNav } from "@/components/memo/bottom-nav";

// session 依赖 cookies —— 整个 (app) 分组都必须运行时渲染
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
