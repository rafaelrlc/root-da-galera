import { cookies } from "next/headers";
import { findMemberByName, findMemberByPin } from "@/lib/db";

export const SESSION_COOKIE = "root-league-member";
export const GUEST_COOKIE = "root-league-guest";

export async function getMemberByPin(pin: string) {
  return findMemberByPin(pin);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const member = cookieStore.get(SESSION_COOKIE)?.value;

  if (!member) return null;

  const found = await findMemberByName(member);
  return found?.name ?? null;
}

export async function getGuestSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE)?.value === "1";
}

export async function requireSessionUser() {
  const member = await getSessionUser();

  if (!member) {
    throw new Error("UNAUTHORIZED");
  }

  return member;
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const member = cookieStore.get(SESSION_COOKIE)?.value;

  if (!member) {
    throw new Error("UNAUTHORIZED");
  }

  const found = await findMemberByName(member);

  if (!found) {
    throw new Error("UNAUTHORIZED");
  }

  if (!found.isAdmin) {
    throw new Error("FORBIDDEN");
  }

  return found.name;
}
