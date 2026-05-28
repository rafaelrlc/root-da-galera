import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { FACTIONS, PLAYERS } from "@/lib/constants";
import { createMatch } from "@/lib/db";

function validatePayload(payload: {
  winner?: string;
  participants?: string[];
  participantFactions?: Record<string, string>;
  winningFaction?: string;
  playedAt?: string;
  seasonNumber?: number;
}) {
  if (!payload.winner || !PLAYERS.includes(payload.winner as (typeof PLAYERS)[number])) {
    return "Vencedor inválido.";
  }

  if (!Array.isArray(payload.participants) || payload.participants.length < 4 || payload.participants.length > 6) {
    return "A partida precisa ter entre 4 e 6 participantes.";
  }

  if (new Set(payload.participants).size !== payload.participants.length) {
    return "Os participantes não podem se repetir.";
  }

  if (!payload.participants.every((player) => PLAYERS.includes(player as (typeof PLAYERS)[number]))) {
    return "Há participantes inválidos.";
  }

  if (!payload.participants.includes(payload.winner)) {
    return "O vencedor precisa estar entre os participantes.";
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

  if (!payload.winningFaction || !FACTIONS.includes(payload.winningFaction as (typeof FACTIONS)[number])) {
    return "Facção inválida.";
  }

  if (payload.participantFactions[payload.winner] !== payload.winningFaction) {
    return "A facção do vencedor precisa bater com a facção escolhida.";
  }

  if (!payload.playedAt) {
    return "Data inválida.";
  }

  if (!Number.isInteger(payload.seasonNumber) || (payload.seasonNumber ?? 0) < 1 || (payload.seasonNumber ?? 0) > 12) {
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

  await createMatch({
    winner: payload.winner,
    participants: payload.participants,
    participantFactions: payload.participantFactions,
    winningFaction: payload.winningFaction,
    playedAt: payload.playedAt,
    seasonNumber: payload.seasonNumber,
    actorName
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
