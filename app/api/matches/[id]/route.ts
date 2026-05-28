import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { deleteMatch } from "@/lib/db";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let actorName: string;
  try {
    actorName = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await deleteMatch(id, actorName);
  return NextResponse.json({ ok: true });
}
