import { redirect } from 'next/navigation';
import { OnboardingView } from '@/components/memo/onboarding-view';
import { getServerSession } from '@/lib/auth';
import { NO_INDEX_METADATA } from '@/lib/site';

export const metadata = {
  ...NO_INDEX_METADATA,
  title: '入门引导',
};

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return <OnboardingView />;
}
