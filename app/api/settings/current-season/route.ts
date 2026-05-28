import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { updateCurrentSeasonNumber } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const currentSeasonNumber = Number(payload?.currentSeasonNumber);

  if (!Number.isInteger(currentSeasonNumber) || currentSeasonNumber < 1 || currentSeasonNumber > 12) {
    return NextResponse.json({ error: "Season inválida." }, { status: 400 });
  }

  await updateCurrentSeasonNumber(currentSeasonNumber);
  return NextResponse.json({ ok: true });
}
