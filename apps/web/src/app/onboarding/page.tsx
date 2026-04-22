import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { OnboardingView } from "@/components/memo/onboarding-view";

export default async function OnboardingPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return <OnboardingView />;
}
