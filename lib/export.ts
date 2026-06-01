import * as XLSX from "xlsx";
import { getMatchOpponents, getSortedScores, getVictoryRecipients } from "@/lib/match-utils";
import { formatMatchMap } from "@/lib/match-map";
import { formatMatchVenue } from "@/lib/match-venue";
import type { MatchRecord } from "@/lib/types";

function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("pt-BR");
}

export function exportMatchesToExcel(matches: MatchRecord[]) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Partidas ──────────────────────────────────────────────────────
  const header = [
    "#",
    "Data",
    "Season",
    "Modalidade",
    "Mapa",
    "Vencedor",
    "Facção vencedora",
    "Dominância",
    "Carta",
    "Pontuações",
    "Participantes",
    "Facções dos participantes"
  ];

  const rows = matches.map((match, index) => {
    const opponents = getMatchOpponents(match).join(", ");
    const scores = getSortedScores(match)
      .map((entry) => `${entry.player}: ${entry.score}`)
      .join(" | ");

    const factionList = match.participants
      .map((p) => `${p}: ${match.participantFactions[p] ?? "—"}`)
      .join(" | ");

    return [
      index + 1,
      formatDate(match.playedAt),
      match.seasonLabel,
      formatMatchVenue(match.venue),
      formatMatchMap(match.boardMap),
      match.winner,
      match.winningFaction,
      match.wonByDominance ? "Sim" : "Não",
      match.dominanceCard ?? "—",
      scores || "—",
      `${match.winner} vs ${opponents}`,
      factionList
    ];
  });

  const matchSheet = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Column widths
  matchSheet["!cols"] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 28 },
    { wch: 36 },
    { wch: 72 }
  ];

  // Bold header row
  for (let col = 0; col < header.length; col++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: col });
    if (matchSheet[cell]) {
      matchSheet[cell].s = { font: { bold: true } };
    }
  }

  XLSX.utils.book_append_sheet(wb, matchSheet, "Partidas");

  // ── Sheet 2: Resumo por jogador ────────────────────────────────────────────
  const playerMap = new Map<string, { wins: number; played: number; factions: Map<string, number> }>();

  for (const match of matches) {
    for (const player of match.participants) {
      if (!playerMap.has(player)) {
        playerMap.set(player, { wins: 0, played: 0, factions: new Map() });
      }
      const entry = playerMap.get(player)!;
      entry.played += 1;
      if (getVictoryRecipients(match).includes(player)) {
        entry.wins += 1;
        entry.factions.set(match.winningFaction, (entry.factions.get(match.winningFaction) ?? 0) + 1);
      }
    }
  }

  const summaryHeader = ["Jogador", "Vitórias", "Partidas", "Winrate", "Facção favorita"];
  const summaryRows = [...playerMap.entries()]
    .sort((a, b) => b[1].wins - a[1].wins)
    .map(([player, stats]) => {
      const winrate = stats.played > 0 ? `${Math.round((stats.wins / stats.played) * 100)}%` : "—";
      const favFaction = [...stats.factions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      return [player, stats.wins, stats.played, winrate, favFaction];
    });

  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);
  summarySheet["!cols"] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 22 }
  ];
  for (let col = 0; col < summaryHeader.length; col++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: col });
    if (summarySheet[cell]) {
      summarySheet[cell].s = { font: { bold: true } };
    }
  }

  XLSX.utils.book_append_sheet(wb, summarySheet, "Resumo");

  // ── Download ───────────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `root-da-galera-${date}.xlsx`);
}
