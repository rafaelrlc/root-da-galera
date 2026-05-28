import { PinGate } from "@/components/pin-gate";
import { RootDashboard } from "@/components/root-dashboard";
import { getDashboardData } from "@/lib/db";
import { getGuestSession, getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentUser = await getSessionUser();

  if (currentUser) {
    const data = await getDashboardData(currentUser, false);
    return <RootDashboard initialData={data} />;
  }

  const isGuest = await getGuestSession();

  if (isGuest) {
    const data = await getDashboardData("Visitante", true);
    return <RootDashboard initialData={data} />;
  }

  return <PinGate />;
}
