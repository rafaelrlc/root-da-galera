import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GUEST_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(GUEST_COOKIE);
  return NextResponse.json({ ok: true });
}
