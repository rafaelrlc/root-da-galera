import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { DOMINANCE_CARDS, FACTIONS, PLAYERS, type DominanceCard } from "@/lib/constants";
import { createMatch } from "@/lib/db";
import { findVagabondPlayer, formatCoalitionWinner } from "@/lib/match-utils";
import { isValidSeasonNumber } from "@/lib/seasons";
import type { VagabondCoalition } from "@/lib/types";

function validatePayload(payload: {
  winner?: string;
  participants?: string[];
  participantFactions?: Record<string, string>;
  participantScores?: Record<string, number> | null;
  participantDominances?: Record<string, DominanceCard> | null;
  winningFaction?: string;
  dominanceCard?: string | null;
  vagabondCoalition?: VagabondCoalition | null;
  coalitionWinners?: string[] | null;
  coalitionWon?: boolean;
  playedAt?: string;
  seasonNumber?: number;
}) {
  if (!Array.isArray(payload.participants) || payload.participants.length < 3 || payload.participants.length > 6) {
    return "A partida precisa ter entre 3 e 6 participantes.";
  }

  if (new Set(payload.participants).size !== payload.participants.length) {
    return "Os participantes não podem se repetir.";
  }

  if (!payload.participants.every((player) => PLAYERS.includes(player as (typeof PLAYERS)[number]))) {
    return "Há participantes inválidos.";
  }

  if (!payload.participantFactions || typeof payload.participantFactions !== "object") {
    return "Facções dos participantes inválidas.";
  }

  for (const participant of payload.participants) {
    const faction = payload.participantFactions[participant];
    if (!faction || !FACTIONS.includes(faction as (typeof FACTIONS)[number])) {
      return `Facção inválida para ${participant}.`;
    }
  }

  const participantDominances = payload.participantDominances ?? {};
  const usedCards = Object.values(participantDominances);
  if (usedCards.length !== new Set(usedCards).size) {
    return "Cada carta de dominância só pode estar com um jogador.";
  }

  for (const [player, card] of Object.entries(participantDominances)) {
    if (!payload.participants.includes(player)) {
      return "Dominância atribuída a jogador que não participou.";
    }
    if (!DOMINANCE_CARDS.includes(card)) {
      return `Carta de dominância inválida para ${player}.`;
    }
  }

  const participantScores = payload.participantScores ?? {};
  for (const [player, score] of Object.entries(participantScores)) {
    if (!payload.participants.includes(player)) {
      return "Pontuação para jogador que não participou.";
    }
    if (participantDominances[player]) {
      return `${player} não pode ter pontos e dominância ao mesmo tempo.`;
    }
    if (!Number.isInteger(score) || score < 0) {
      return `Pontuação inválida para ${player}.`;
    }
  }

  const vagabondPlayer = findVagabondPlayer(payload.participants, payload.participantFactions);
  const vagabondDominance = vagabondPlayer ? participantDominances[vagabondPlayer] : undefined;
  const vagabondCoalition = payload.vagabondCoalition ?? null;
  const coalitionWinners = payload.coalitionWinners ?? [];
  const coalitionWon = Boolean(payload.coalitionWon);

  if (vagabondDominance) {
    if (!vagabondCoalition?.partner || !vagabondCoalition.faction) {
      return "O Vagabond com dominância precisa formar coalizão (parceiro e facção).";
    }
    if (vagabondCoalition.vagabond !== vagabondPlayer) {
      return "Coalizão do Vagabond inválida.";
    }
    if (!payload.participants.includes(vagabondCoalition.partner)) {
      return "O parceiro da coalizão precisa estar na partida.";
    }
    if (vagabondCoalition.partner === vagabondPlayer) {
      return "O parceiro da coalizão não pode ser o próprio Vagabond.";
    }
    if (payload.participantFactions[vagabondCoalition.partner] !== vagabondCoalition.faction) {
      return "A facção da coalizão precisa ser a do parceiro.";
    }
    if (vagabondCoalition.faction === "Vagabond") {
      return "A facção da coalizão não pode ser o Vagabond.";
    }
  } else if (vagabondCoalition) {
    return "Coalizão só existe quando o Vagabond ativa uma dominância.";
  }

  if (coalitionWon) {
    if (!vagabondCoalition || !vagabondDominance) {
      return "Vitória da coalizão exige Vagabond com dominância e parceiro.";
    }
    if (coalitionWinners.length !== 2) {
      return "Vitória da coalizão inválida.";
    }
    if (
      coalitionWinners[0] !== vagabondCoalition.vagabond ||
      coalitionWinners[1] !== vagabondCoalition.partner
    ) {
      return "Vitória da coalizão inconsistente.";
    }
  } else if (coalitionWinners.length > 0) {
    return "Vitória conjunta só quando a coalizão vence por dominância.";
  }

  if (coalitionWon) {
    if (!payload.winner?.startsWith("COALIZÃO")) {
      return "Rótulo de vitória da coalizão inválido.";
    }
  } else {
    if (!payload.winner || !PLAYERS.includes(payload.winner as (typeof PLAYERS)[number])) {
      return "Vencedor inválido.";
    }
    if (!payload.participants.includes(payload.winner)) {
      return "O vencedor precisa estar entre os participantes.";
    }
  }

  if (!payload.winningFaction || !FACTIONS.includes(payload.winningFaction as (typeof FACTIONS)[number])) {
    return "Facção inválida.";
  }

  if (coalitionWon) {
    if (payload.winningFaction !== vagabondCoalition!.faction) {
      return "Facção vencedora deve ser a da coalizão.";
    }
  } else if (payload.participantFactions[payload.winner!] !== payload.winningFaction) {
    return "A facção do vencedor precisa bater com a facção escolhida.";
  }

  const winnerDominance = coalitionWon
    ? vagabondDominance
    : participantDominances[payload.winner!.startsWith("COALIZÃO") ? "" : payload.winner!];

  if (coalitionWon) {
    if (!winnerDominance || payload.dominanceCard !== winnerDominance) {
      return "Carta de dominância da coalizão inválida.";
    }
  } else if (winnerDominance) {
    if (payload.dominanceCard && payload.dominanceCard !== winnerDominance) {
      return "Carta de dominância do vencedor inconsistente.";
    }
  } else {
    if (payload.dominanceCard) {
      return "Dominância só vale quando o vencedor ativou uma carta.";
    }

    const winnerKey = payload.winner!;
    const winnerScore = participantScores[winnerKey];
    const hasAnyScore = Object.keys(participantScores).length > 0;

    if (hasAnyScore) {
      if (winnerScore === undefined) {
        return "O vencedor precisa ter pontuação quando não vence por dominância.";
      }

      for (const player of payload.participants) {
        if (player === winnerKey || participantDominances[player]) continue;
        const score = participantScores[player];
        if (score !== undefined && score > winnerScore) {
          return `Ninguém pode ter mais pontos que o vencedor (${winnerKey}: ${winnerScore}).`;
        }
      }
    }
  }

  if (!payload.playedAt) {
    return "Data inválida.";
  }

  if (!isValidSeasonNumber(payload.seasonNumber ?? NaN)) {
    return "Season inválida.";
  }

  return null;
}

export async function POST(request: NextRequest) {
  let actorName: string;
  try {
    actorName = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const error = validatePayload(payload);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const vagabondCoalition = payload.vagabondCoalition ?? null;
  const coalitionWinners = payload.coalitionWinners?.length ? payload.coalitionWinners : null;
  const winner = coalitionWinners?.length
    ? formatCoalitionWinner(coalitionWinners)
    : payload.winner;

  const participantDominances = payload.participantDominances ?? {};
  const vagabondDominance = vagabondCoalition
    ? participantDominances[vagabondCoalition.vagabond]
    : undefined;
  const winnerDominance = coalitionWinners?.length
    ? vagabondDominance
    : participantDominances[payload.winner];

  await createMatch({
    winner,
    participants: payload.participants,
    participantFactions: payload.participantFactions,
    participantScores: payload.participantScores ?? null,
    participantDominances: Object.keys(participantDominances).length ? participantDominances : null,
    vagabondCoalition,
    winningFaction: payload.winningFaction,
    wonByDominance: Boolean(winnerDominance),
    dominanceCard: winnerDominance ?? null,
    coalitionWinners,
    playedAt: payload.playedAt,
    seasonNumber: payload.seasonNumber,
    actorName
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
