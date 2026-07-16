import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getMemberByPin, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const pin = String(payload?.pin ?? "");
  const member = await getMemberByPin(pin);

  if (!member) {
    return NextResponse.json({ error: "PIN inválido." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, member, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return NextResponse.json({ ok: true, member });
}
