import { PLAYERS } from "@/lib/constants";
import { getVictoryRecipients } from "@/lib/match-utils";
import type { MatchRecord } from "@/lib/types";

export function isLeaguePlayer(name: string): boolean {
  return PLAYERS.includes(name as (typeof PLAYERS)[number]);
}

export function deriveGuestParticipants(participants: string[]): string[] {
  return participants.filter((player) => !isLeaguePlayer(player));
}

export function getGuestParticipants(
  match: Pick<MatchRecord, "participants" | "guestParticipants">
): string[] {
  if (match.guestParticipants?.length) {
    return match.guestParticipants;
  }
  return deriveGuestParticipants(match.participants);
}

export function isGuestParticipant(
  match: Pick<MatchRecord, "participants" | "guestParticipants">,
  name: string
): boolean {
  return getGuestParticipants(match).includes(name);
}

export function validateGuestName(name: string, existingParticipants: string[] = []): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) {
    return "O nome precisa ter pelo menos 2 caracteres.";
  }
  if (trimmed.length > 24) {
    return "O nome pode ter no máximo 24 caracteres.";
  }
  if (isLeaguePlayer(trimmed)) {
    return "Esse nome já pertence a um jogador da liga.";
  }
  if (existingParticipants.includes(trimmed)) {
    return "Esse participante já está na partida.";
  }
  return null;
}

export function getLeagueVictoryRecipients(
  match: Pick<MatchRecord, "coalitionWinners" | "winner" | "participants" | "guestParticipants">
): string[] {
  const guests = new Set(getGuestParticipants(match));
  return getVictoryRecipients(match).filter((player) => !guests.has(player));
}

export function getLeagueParticipants(
  match: Pick<MatchRecord, "participants" | "guestParticipants">
): string[] {
  const guests = new Set(getGuestParticipants(match));
  return match.participants.filter((player) => !guests.has(player));
}
