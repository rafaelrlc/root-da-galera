import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { updateCurrentSeasonNumber } from "@/lib/db";
import { isValidSeasonNumber } from "@/lib/seasons";

export async function POST(request: NextRequest) {
  try {
    await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const currentSeasonNumber = Number(payload?.currentSeasonNumber);

  if (!isValidSeasonNumber(currentSeasonNumber)) {
    return NextResponse.json({ error: "Season inválida." }, { status: 400 });
  }

  await updateCurrentSeasonNumber(currentSeasonNumber);
  return NextResponse.json({ ok: true });
}
