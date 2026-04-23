import { OnboardingView } from '@/components/memo/onboarding-view';
import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return <OnboardingView />;
}
