import { LandingPageView } from '@/components/landing/landing-page';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const session = await getServerSession();
  return <LandingPageView authed={Boolean(session)} />;
}
