import { TodayView } from '@/components/memo/today-view';
import { getServerSession } from '@/lib/auth';

export default async function TodayPage() {
  const session = await getServerSession();
  const name = session?.user?.name ?? session?.user?.email ?? '朋友';
  return <TodayView userName={name} />;
}
