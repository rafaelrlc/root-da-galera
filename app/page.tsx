import { PinGate } from "@/components/pin-gate";
import { RootDashboard } from "@/components/root-dashboard";
import { getDashboardData } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentUser = await getSessionUser();

  if (!currentUser) {
    return <PinGate />;
  }

  const data = await getDashboardData(currentUser);
  return <RootDashboard initialData={data} />;
}
