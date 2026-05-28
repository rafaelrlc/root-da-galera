import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await requireSessionUser();
    const data = await getDashboardData(currentUser);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
