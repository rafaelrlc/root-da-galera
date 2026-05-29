import type { DominanceCard } from "@/lib/constants";
import { DOMINANCE_CARDS } from "@/lib/constants";
import type { MatchRecord, VagabondCoalition } from "@/lib/types";

export function formatCoalitionWinner(players: string[]) {
  return `COALIZÃO (${players.join(", ")})`;
}

export function isCoalitionVictory(match: Pick<MatchRecord, "coalitionWinners">) {
  return (match.coalitionWinners?.length ?? 0) > 0;
}

export function hasVagabondCoalition(match: Pick<MatchRecord, "vagabondCoalition">) {
  return match.vagabondCoalition != null;
}

export function getVictoryRecipients(match: Pick<MatchRecord, "coalitionWinners" | "winner">) {
  if (match.coalitionWinners?.length) {
    return match.coalitionWinners;
  }

  return [match.winner];
}

export function getMatchOpponents(match: Pick<MatchRecord, "participants" | "coalitionWinners" | "winner">) {
  const winners = new Set(getVictoryRecipients(match));
  return match.participants.filter((player) => !winners.has(player));
}

export function getPlayersWithoutScores(
  match: Pick<MatchRecord, "participants" | "participantDominances">
) {
  const exempt = new Set<string>();

  for (const player of match.participants) {
    if (match.participantDominances?.[player]) {
      exempt.add(player);
    }
  }

  return exempt;
}

export function getSortedScores(
  match: Pick<MatchRecord, "participants" | "participantScores" | "participantDominances">
) {
  const withoutScores = getPlayersWithoutScores(match);
  const entries = match.participants
    .map((player) => {
      if (withoutScores.has(player)) return null;
      const score = match.participantScores?.[player];
      return score === undefined ? null : { player, score };
    })
    .filter((entry): entry is { player: string; score: number } => entry !== null);

  return entries.sort((a, b) => b.score - a.score || a.player.localeCompare(b.player));
}

export function getAvailableDominanceCards(
  assignments: Record<string, DominanceCard>,
  player: string
): DominanceCard[] {
  return DOMINANCE_CARDS.filter((card) => {
    const owner = Object.entries(assignments).find(([, assigned]) => assigned === card)?.[0];
    return !owner || owner === player;
  });
}

export function getWinnerDominanceCard(
  match: Pick<
    MatchRecord,
    "participantDominances" | "dominanceCard" | "coalitionWinners" | "vagabondCoalition" | "winner"
  >
) {
  if (match.vagabondCoalition) {
    const card = match.participantDominances?.[match.vagabondCoalition.vagabond];
    if (card) return card;
  }

  if (match.coalitionWinners?.length) {
    const vagabond = match.coalitionWinners.find(
      (player) => match.participantDominances?.[player]
    );
    if (vagabond) return match.participantDominances![vagabond];
    return match.dominanceCard;
  }

  const singleWinner = match.winner.startsWith("COALIZÃO") ? null : match.winner;
  if (singleWinner && match.participantDominances?.[singleWinner]) {
    return match.participantDominances[singleWinner];
  }

  return match.dominanceCard;
}

export function formatParticipantDominances(match: Pick<MatchRecord, "participantDominances">) {
  if (!match.participantDominances || Object.keys(match.participantDominances).length === 0) {
    return null;
  }

  return Object.entries(match.participantDominances)
    .map(([player, card]) => `${player}: ${card}`)
    .join(" · ");
}

export function formatVagabondCoalitionNote(coalition: VagabondCoalition) {
  return `Coalizão ativa: ${coalition.vagabond} (Vagabond) + ${coalition.partner} (${coalition.faction})`;
}

export function findVagabondPlayer(
  participants: string[],
  participantFactions: Record<string, string | null>
) {
  return participants.find((player) => participantFactions[player] === "Vagabond") ?? null;
}

export function getFactionsInPlay(
  match: Pick<MatchRecord, "participants" | "participantFactions">
) {
  const factions = match.participants
    .map((player) => match.participantFactions[player])
    .filter((faction): faction is string => Boolean(faction));

  return [...new Set(factions)];
}

export function getWinningFactions(
  match: Pick<MatchRecord, "winningFaction" | "coalitionWinners" | "vagabondCoalition">
) {
  if (isCoalitionVictory(match) && match.vagabondCoalition) {
    return [match.vagabondCoalition.faction, "Vagabond"];
  }

  return [match.winningFaction];
}

export function sortFactionsForDisplay(factions: string[], winningFactions: string[]) {
  const winners = new Set(winningFactions);

  return [...factions].sort((factionA, factionB) => {
    const aWins = winners.has(factionA);
    const bWins = winners.has(factionB);
    if (aWins && !bWins) return -1;
    if (!aWins && bWins) return 1;
    return factionA.localeCompare(factionB);
  });
}
