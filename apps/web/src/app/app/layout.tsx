import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/memo/bottom-nav';
import { getServerSession } from '@/lib/auth';
import { NO_INDEX_METADATA } from '@/lib/site';

// session 依赖 cookies —— 整个 (app) 分组都必须运行时渲染
export const dynamic = 'force-dynamic';
export const metadata = NO_INDEX_METADATA;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
