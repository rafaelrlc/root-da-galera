import { cookies } from "next/headers";
import { PLAYERS } from "@/lib/constants";
import { MEMBER_PINS } from "@/lib/server/member-pins";

export const SESSION_COOKIE = "root-league-member";

export function getMemberByPin(pin: string) {
  return (PLAYERS.find((player) => MEMBER_PINS[player] === pin) ?? null) as (typeof PLAYERS)[number] | null;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const member = cookieStore.get(SESSION_COOKIE)?.value;

  if (!member || !PLAYERS.includes(member as (typeof PLAYERS)[number])) {
    return null;
  }

  return member as (typeof PLAYERS)[number];
}

export async function requireSessionUser() {
  const member = await getSessionUser();

  if (!member) {
    throw new Error("UNAUTHORIZED");
  }

  return member;
}
