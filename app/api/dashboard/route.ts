import { NextResponse } from "next/server";
import { getGuestSession, requireSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await requireSessionUser();
    const data = await getDashboardData(currentUser, false);
    return NextResponse.json(data);
  } catch {
    const isGuest = await getGuestSession();
    if (!isGuest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = await getDashboardData("Visitante", true);
    return NextResponse.json(data);
  }
}
