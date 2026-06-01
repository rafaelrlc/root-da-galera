"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, Download, LoaderCircle, LogOut, Swords, Trophy, Trash2, Trees, User } from "lucide-react";
import { PlayerDominanceSelect } from "@/components/player-dominance-select";
import { FACTIONS, FACTION_FILTERS, PLAYERS, type DominanceCard } from "@/lib/constants";
import { exportMatchesToExcel } from "@/lib/export";
import {
  findVagabondPlayer,
  formatCoalitionWinner,
  formatParticipantDominances,
  formatVagabondCoalitionNote,
  getAvailableDominanceCards,
  getFactionsInPlay,
  getMatchOpponents,
  getSortedScores,
  getVictoryRecipients,
  getWinnerDominanceCard,
  getWinningFactions,
  hasVagabondCoalition,
  isCoalitionVictory,
  sortFactionsForDisplay
} from "@/lib/match-utils";
import {
  DEFAULT_MATCH_MAP,
  formatMatchMap,
  MATCH_MAPS,
  matchesMapFilter,
  type MatchMap,
  type MatchMapFilter
} from "@/lib/match-map";
import {
  DEFAULT_MATCH_VENUE,
  formatMatchVenue,
  MATCH_VENUES,
  matchesVenueFilter,
  type MatchVenue,
  type MatchVenueFilter
} from "@/lib/match-venue";
import { MAX_SEASON_NUMBER, MIN_SEASON_NUMBER } from "@/lib/seasons";
import type { ActivityLog, DashboardData, MatchRecord } from "@/lib/types";
import { FactionBadge } from "@/components/faction-badge";
import { MapBadge, MapSelector } from "@/components/map-selector";
import { StatsPanel } from "@/components/stats-panel";

type Props = {
  initialData: DashboardData;
};

type FormState = {
  winner: string;
  participants: string[];
  participantFactions: Record<string, string>;
  participantScores: Record<string, string>;
  participantDominances: Record<string, DominanceCard>;
  winningFaction: string;
  playedAt: string;
  seasonNumber: number;
  venue: MatchVenue;
  boardMap: MatchMap;
  coalitionPartner: string;
  coalitionWon: boolean;
};

function createEmptyForm(seasonNumber: number): FormState {
  return {
    winner: "",
    participants: [],
    participantFactions: {},
    participantScores: {},
    participantDominances: {},
    winningFaction: FACTIONS[0],
    playedAt: new Date().toISOString().slice(0, 10),
    seasonNumber,
    venue: DEFAULT_MATCH_VENUE,
    boardMap: DEFAULT_MATCH_MAP,
    coalitionPartner: "",
    coalitionWon: false
  };
}

function getCoalitionFaction(form: FormState) {
  if (!form.coalitionPartner) return null;
  const faction = form.participantFactions[form.coalitionPartner];
  return faction && faction !== "Vagabond" ? faction : null;
}

function buildVagabondCoalition(form: FormState) {
  const vagabond = findVagabondPlayer(form.participants, form.participantFactions);
  const faction = getCoalitionFaction(form);
  if (!vagabond || !form.participantDominances[vagabond] || !form.coalitionPartner || !faction) {
    return null;
  }

  return {
    vagabond,
    partner: form.coalitionPartner,
    faction
  };
}

function buildMatchPayload(form: FormState) {
  const participantDominances = { ...form.participantDominances };
  const vagabondCoalition = buildVagabondCoalition(form);

  const participantScores: Record<string, number> = {};
  for (const player of form.participants) {
    if (participantDominances[player]) continue;
    const raw = form.participantScores[player]?.trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) {
      participantScores[player] = parsed;
    }
  }

  const dominancesPayload =
    Object.keys(participantDominances).length > 0 ? participantDominances : null;

  if (form.coalitionWon && vagabondCoalition) {
    return {
      winner: formatCoalitionWinner([vagabondCoalition.vagabond, vagabondCoalition.partner]),
      participants: form.participants,
      participantFactions: form.participantFactions,
      participantScores: Object.keys(participantScores).length ? participantScores : null,
      participantDominances: dominancesPayload,
      vagabondCoalition,
      winningFaction: vagabondCoalition.faction,
      coalitionWinners: [vagabondCoalition.vagabond, vagabondCoalition.partner],
      coalitionWon: true,
      dominanceCard: participantDominances[vagabondCoalition.vagabond],
      playedAt: form.playedAt,
      seasonNumber: form.seasonNumber,
      venue: form.venue,
      boardMap: form.boardMap
    };
  }

  const winnerDominance = form.participantDominances[form.winner];

  return {
    winner: form.winner,
    participants: form.participants,
    participantFactions: form.participantFactions,
    participantScores: Object.keys(participantScores).length ? participantScores : null,
    participantDominances: dominancesPayload,
    vagabondCoalition,
    winningFaction: form.winningFaction,
    coalitionWinners: null,
    coalitionWon: false,
    dominanceCard: winnerDominance ?? null,
    playedAt: form.playedAt,
    seasonNumber: form.seasonNumber,
    venue: form.venue,
    boardMap: form.boardMap
  };
}

function validateFormScores(form: FormState) {
  if (form.coalitionWon) return null;

  const winnerDominance = form.participantDominances[form.winner];
  if (winnerDominance) return null;

  const scores: Record<string, number> = {};
  for (const player of form.participants) {
    if (form.participantDominances[player]) continue;
    const raw = form.participantScores[player]?.trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) scores[player] = parsed;
  }

  if (Object.keys(scores).length === 0) return null;

  const winnerScore = scores[form.winner];
  if (winnerScore === undefined) {
    return "O vencedor precisa ter pontuação quando não vence por dominância.";
  }

  for (const [player, score] of Object.entries(scores)) {
    if (player !== form.winner && score > winnerScore) {
      return `Ninguém pode ter mais pontos que o vencedor (${form.winner}: ${winnerScore}).`;
    }
  }

  return null;
}

export function RootDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const isGuest = data.meta.isGuest;
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [factionFilter, setFactionFilter] = useState<(typeof FACTION_FILTERS)[number]>("all");
  const [venueFilter, setVenueFilter] = useState<MatchVenueFilter>("all");
  const [mapFilter, setMapFilter] = useState<MatchMapFilter>("all");
  const [activeTab, setActiveTab] = useState<"register" | "leaderboard" | "history" | "logs" | "stats">(
    initialData.meta.isGuest ? "leaderboard" : "register"
  );
  const [desktopTab, setDesktopTab] = useState<"overview" | "leaderboard" | "records" | "seasons" | "stats">(
    initialData.meta.isGuest ? "leaderboard" : "overview"
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const [pending, startTransition] = useTransition();
  const [settingsPending, startSettingsTransition] = useTransition();
  const [currentSeasonNumber, setCurrentSeasonNumber] = useState(initialData.meta.currentSeasonNumber);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(initialData.meta.currentSeasonNumber));

  const filteredMatches = useMemo(() => {
    return data.matches.filter((match) => {
      const seasonMatches = seasonFilter === "all" || match.seasonLabel === seasonFilter;
      const factionMatches = factionFilter === "all" || match.winningFaction === factionFilter;
      const venueMatches = matchesVenueFilter(match, venueFilter);
      const mapMatches = matchesMapFilter(match, mapFilter);
      return seasonMatches && factionMatches && venueMatches && mapMatches;
    });
  }, [data.matches, seasonFilter, factionFilter, venueFilter, mapFilter]);

  const leaderboard = useMemo(() => {
    const totals = new Map<string, number>();
    const byFaction = new Map<string, Map<string, number>>();
    const totalPlayed = new Map<string, number>();
    const playedByFaction = new Map<string, Map<string, number>>();

    PLAYERS.forEach((player) => {
      totals.set(player, 0);
      byFaction.set(player, new Map());
      totalPlayed.set(player, 0);
      playedByFaction.set(player, new Map());
    });

    const seasonMatches = data.matches.filter(
      (match) =>
        (seasonFilter === "all" || match.seasonLabel === seasonFilter) &&
        matchesVenueFilter(match, venueFilter) &&
        matchesMapFilter(match, mapFilter)
    );

    filteredMatches.forEach((match) => {
      getVictoryRecipients(match).forEach((player) => {
        totals.set(player, (totals.get(player) ?? 0) + 1);
        const playerFactionMap = byFaction.get(player) ?? new Map<string, number>();
        playerFactionMap.set(match.winningFaction, (playerFactionMap.get(match.winningFaction) ?? 0) + 1);
        byFaction.set(player, playerFactionMap);
      });
    });

    seasonMatches.forEach((match) => {
      match.participants.forEach((player) => {
        totalPlayed.set(player, (totalPlayed.get(player) ?? 0) + 1);
        const faction = match.participantFactions[player];
        if (faction) {
          const factionMap = playedByFaction.get(player) ?? new Map<string, number>();
          factionMap.set(faction, (factionMap.get(faction) ?? 0) + 1);
          playedByFaction.set(player, factionMap);
        }
      });
    });

    return [...totals.entries()]
      .map(([player, wins]) => {
        const factionEntries = [...(byFaction.get(player)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
        let winrate: number | null = null;
        let matchesPlayed: number;
        if (factionFilter === "all") {
          matchesPlayed = totalPlayed.get(player) ?? 0;
          winrate = matchesPlayed > 0 ? wins / matchesPlayed : null;
        } else {
          matchesPlayed = playedByFaction.get(player)?.get(factionFilter) ?? 0;
          const winsWithFaction = byFaction.get(player)?.get(factionFilter) ?? 0;
          winrate = matchesPlayed > 0 ? winsWithFaction / matchesPlayed : null;
        }
        return {
          player,
          wins,
          factionWins: factionEntries,
          winrate,
          matchesPlayed
        };
      })
      .sort((a, b) => b.wins - a.wins || a.player.localeCompare(b.player));
  }, [filteredMatches, data.matches, seasonFilter, factionFilter, venueFilter, mapFilter]);

  const classLeaders = useMemo(() => {
    const seasonMatches = data.matches.filter(
      (match) =>
        (seasonFilter === "all" || match.seasonLabel === seasonFilter) &&
        matchesVenueFilter(match, venueFilter) &&
        matchesMapFilter(match, mapFilter)
    );

    return FACTIONS.map((faction) => {
      const stats = PLAYERS.map((player) => {
        const wins = seasonMatches.filter(
          (match) => getVictoryRecipients(match).includes(player) && match.winningFaction === faction
        ).length;
        const matchesPlayed = seasonMatches.filter(
          (match) => match.participants.includes(player) && match.participantFactions[player] === faction
        ).length;
        const winrate = matchesPlayed > 0 ? wins / matchesPlayed : null;

        return { player, wins, matchesPlayed, winrate };
      }).filter((entry) => entry.matchesPlayed > 0);

      if (stats.length === 0) {
        return { faction, leaders: [] as string[], wins: 0, matchesPlayed: 0, winrate: null, isTie: false };
      }

      const maxWins = Math.max(...stats.map((entry) => entry.wins));
      if (maxWins === 0) {
        return { faction, leaders: [] as string[], wins: 0, matchesPlayed: 0, winrate: null, isTie: false };
      }
      const topByWins = stats.filter((entry) => entry.wins === maxWins);
      const maxWinrate = Math.max(...topByWins.map((entry) => entry.winrate ?? 0));
      const leaders = topByWins
        .filter((entry) => (entry.winrate ?? 0) === maxWinrate)
        .map((entry) => entry.player)
        .sort((a, b) => a.localeCompare(b));

      const topStat = stats.find((entry) => entry.player === leaders[0])!;

      return {
        faction,
        leaders,
        wins: topStat.wins,
        matchesPlayed: topStat.matchesPlayed,
        winrate: topStat.winrate,
        isTie: leaders.length > 1
      };
    });
  }, [data.matches, seasonFilter, venueFilter, mapFilter]);

  function toggleParticipant(player: string) {
    setForm((current) => {
      const hasPlayer = current.participants.includes(player);
      const nextParticipants = hasPlayer
        ? current.participants.filter((name) => name !== player)
        : [...current.participants, player];

      if (nextParticipants.length > 6) {
        return current;
      }

      const winner = nextParticipants.includes(current.winner) ? current.winner : (nextParticipants[0] ?? "");

      const nextParticipantFactions = { ...current.participantFactions };
      const nextParticipantScores = { ...current.participantScores };
      const nextParticipantDominances = { ...current.participantDominances };
      if (!hasPlayer && !nextParticipantFactions[player]) {
        const usedFactions = new Set(Object.values(nextParticipantFactions));
        nextParticipantFactions[player] = FACTIONS.find((f) => !usedFactions.has(f)) ?? FACTIONS[0];
        nextParticipantScores[player] = nextParticipantScores[player] ?? "";
      } else if (hasPlayer) {
        delete nextParticipantScores[player];
        delete nextParticipantDominances[player];
      }

      const coalitionPartner = nextParticipants.includes(current.coalitionPartner)
        ? current.coalitionPartner
        : "";

      return {
        ...current,
        participants: nextParticipants,
        winner,
        participantFactions: nextParticipantFactions,
        participantScores: nextParticipantScores,
        participantDominances: nextParticipantDominances,
        coalitionPartner,
        winningFaction: nextParticipantFactions[winner] ?? current.winningFaction
      };
    });
  }

  function handlePlayerFactionChange(player: string, faction: string) {
    setForm((current) => {
      const takenByOthers = current.participants
        .filter((p) => p !== player)
        .map((p) => current.participantFactions[p]);
      if (faction !== "Vagabond" && takenByOthers.includes(faction)) return current;

      const coalitionPartner =
        current.coalitionPartner === player && faction === "Vagabond"
          ? ""
          : current.coalitionPartner;

      return {
        ...current,
        participantFactions: { ...current.participantFactions, [player]: faction },
        coalitionPartner,
        winningFaction: player === current.winner ? faction : current.winningFaction
      };
    });
  }

  async function refreshData() {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    const nextData = (await response.json()) as DashboardData;
    setData(nextData);
    setCurrentSeasonNumber(nextData.meta.currentSeasonNumber);
    setForm((current) => ({ ...current, seasonNumber: nextData.meta.currentSeasonNumber }));
  }

  async function submitMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const vagabond = findVagabondPlayer(form.participants, form.participantFactions);
    const vagabondDominance = vagabond ? form.participantDominances[vagabond] : undefined;

    if (vagabondDominance && !form.coalitionPartner) {
      alert("O Vagabond com dominância precisa escolher o parceiro da coalizão.");
      return;
    }

    if (form.coalitionWon && !buildVagabondCoalition(form)) {
      alert("Marque vitória da coalizão só com Vagabond, dominância e parceiro configurados.");
      return;
    }

    const scoreError = validateFormScores(form);
    if (scoreError) {
      alert(scoreError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMatchPayload(form))
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        alert(body?.error ?? "Não foi possível registrar a partida.");
        return;
      }

      await refreshData();
      setForm(createEmptyForm(currentSeasonNumber));
      setToast("Partida registrada com sucesso!");
      setActiveTab("history");
    });
  }

  async function removeMatch(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/matches/${id}`, { method: "DELETE" });
      if (!response.ok) {
        alert("Não foi possível apagar esse registro.");
        return;
      }
      await refreshData();
    });
  }

  async function saveSeasonAnchor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSettingsTransition(async () => {
      const response = await fetch("/api/settings/current-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSeasonNumber })
      });

      if (!response.ok) {
        alert("Não foi possível salvar a season atual.");
        return;
      }

      await refreshData();
      setForm((current) => ({ ...current, seasonNumber: currentSeasonNumber }));
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <section className="forest-card relative z-20 overflow-visible !rounded-[36px]">
          <div className="relative overflow-visible rounded-[34px] bg-[linear-gradient(135deg,#7d9f57_0%,#4e6a35_100%)] px-4 py-2 text-cream sm:px-6 sm:py-3">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_25%),radial-gradient(circle_at_80%_30%,white_0,transparent_18%),radial-gradient(circle_at_60%_80%,white_0,transparent_20%)]" />
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="w-fit rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em]">
                  Root League
                </span>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Abrir menu do usuário"
                    onClick={() => setUserMenuOpen((current) => !current)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <User className="h-4 w-4" />
                  </button>
                  {userMenuOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-2 min-w-48 rounded-[18px] border border-white/15 bg-[#2b4020]/95 p-3 text-white shadow-story backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/65">Logado como</p>
                      <p className="mt-1 text-sm font-bold">{data.meta.currentUser}</p>
                      <button
                        type="button"
                        onClick={logout}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] transition hover:bg-white/20"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mt-2">
                <div>
                  <h1 className="storybook-title text-xl sm:text-2xl !text-white">Root da Galera</h1>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-white sm:min-w-44">
                  <StatCard label="Partidas" value={String(data.matches.length)} icon={<Swords className="h-4 w-4" />} />
                  <StatCard label="Season atual" value={data.meta.currentSeasonLabel} icon={<Trees className="h-4 w-4" />} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="hidden gap-5 xl:block">
          <div className="forest-card p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {!isGuest && <TabButton active={desktopTab === "overview"} onClick={() => setDesktopTab("overview")}>Partidas & Ranking</TabButton>}
              {isGuest && <TabButton active={desktopTab === "leaderboard"} onClick={() => setDesktopTab("leaderboard")}>Leaderboard</TabButton>}
              <TabButton active={desktopTab === "records"} onClick={() => setDesktopTab("records")}>Histórico & Logs</TabButton>
              <TabButton active={desktopTab === "stats"} onClick={() => setDesktopTab("stats")}>Estatísticas</TabButton>
              {!isGuest && <TabButton active={desktopTab === "seasons"} onClick={() => setDesktopTab("seasons")}>Seasons</TabButton>}
            </div>

            {desktopTab === "overview" && !isGuest ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="h-[72vh] overflow-hidden rounded-[28px] border-2 border-bark/10 bg-white/45 p-5">
                  <RegisterPanel
                    form={form}
                    pending={pending}
                    onSubmit={submitMatch}
                    onWinnerChange={(winner) => setForm((current) => ({ ...current, winner, winningFaction: current.participantFactions[winner] ?? current.winningFaction }))}
                    onDateChange={(playedAt) => setForm((current) => ({ ...current, playedAt }))}
                    onPlayerFactionChange={handlePlayerFactionChange}
                    onToggleParticipant={toggleParticipant}
                    onSeasonNumberChange={(seasonNumber) => setForm((current) => ({ ...current, seasonNumber }))}
                    onVenueChange={(venue) => setForm((current) => ({ ...current, venue }))}
                    onBoardMapChange={(boardMap) => setForm((current) => ({ ...current, boardMap }))}
                    onScoreChange={(player, value) =>
                      setForm((current) => {
                        const nextDominances = { ...current.participantDominances };
                        delete nextDominances[player];
                        return {
                          ...current,
                          participantScores: { ...current.participantScores, [player]: value },
                          participantDominances: nextDominances
                        };
                      })
                    }
                    onDominanceChange={(player, card) =>
                      setForm((current) => {
                        const nextDominances = { ...current.participantDominances };
                        if (card) {
                          nextDominances[player] = card;
                        } else {
                          delete nextDominances[player];
                        }
                        const nextScores = { ...current.participantScores };
                        if (card) delete nextScores[player];
                        const vagabond = findVagabondPlayer(current.participants, current.participantFactions);
                        const clearingVagabondDominance = player === vagabond && !card;
                        return {
                          ...current,
                          participantDominances: nextDominances,
                          participantScores: nextScores,
                          coalitionPartner: clearingVagabondDominance ? "" : current.coalitionPartner,
                          coalitionWon: clearingVagabondDominance ? false : current.coalitionWon
                        };
                      })
                    }
                    onCoalitionPartnerChange={(coalitionPartner) =>
                      setForm((current) => {
                        const next = { ...current, coalitionPartner };
                        const faction = getCoalitionFaction(next);
                        return {
                          ...next,
                          winningFaction:
                            current.coalitionWon && faction ? faction : current.winningFaction
                        };
                      })
                    }
                    onCoalitionWonChange={(coalitionWon) =>
                      setForm((current) => {
                        const faction = getCoalitionFaction(current);
                        return {
                          ...current,
                          coalitionWon,
                          winningFaction:
                            coalitionWon && faction
                              ? faction
                              : current.participantFactions[current.winner] ?? current.winningFaction
                        };
                      })
                    }
                  />
                </div>
                <div className="h-[72vh] overflow-hidden rounded-[28px] border-2 border-bark/10 bg-white/45 p-5">
                  <LeaderboardPanel
                    data={data}
                    seasonFilter={seasonFilter}
                    factionFilter={factionFilter}
                    venueFilter={venueFilter}
                    leaderboard={leaderboard}
                    classLeaders={classLeaders}
                    onSeasonFilterChange={setSeasonFilter}
                    onFactionFilterChange={(value) => setFactionFilter(value as (typeof FACTION_FILTERS)[number])}
                    onVenueFilterChange={setVenueFilter}
                  />
                </div>
              </div>
            ) : null}

            {desktopTab === "leaderboard" && isGuest ? (
              <div className="h-[72vh] overflow-hidden rounded-[28px] border-2 border-bark/10 bg-white/45 p-5">
                <LeaderboardPanel
                  data={data}
                  seasonFilter={seasonFilter}
                  factionFilter={factionFilter}
                  venueFilter={venueFilter}
                  leaderboard={leaderboard}
                  classLeaders={classLeaders}
                  onSeasonFilterChange={setSeasonFilter}
                  onFactionFilterChange={(value) => setFactionFilter(value as (typeof FACTION_FILTERS)[number])}
                  onVenueFilterChange={setVenueFilter}
                />
              </div>
            ) : null}

            {desktopTab === "records" ? (
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="h-[72vh] overflow-hidden rounded-[28px] border-2 border-bark/10 bg-white/45 p-5">
                  <HistoryPanel
                    data={data}
                    seasonFilter={seasonFilter}
                    pending={pending}
                    isGuest={isGuest}
                    onSeasonFilterChange={setSeasonFilter}
                    onDelete={removeMatch}
                  />
                </div>
                <div className="h-[72vh] overflow-hidden rounded-[28px] border-2 border-bark/10 bg-white/45 p-5">
                  <LogsPanel logs={data.logs} />
                </div>
              </div>
            ) : null}

            {desktopTab === "stats" ? (
              <div className="h-[72vh] overflow-hidden rounded-[28px] border-2 border-bark/10 bg-white/45 p-5">
                <StatsPanel data={data} />
              </div>
            ) : null}

            {desktopTab === "seasons" && !isGuest ? (
              <div className="max-w-md">
                <SeasonPanel
                  currentSeasonLabel={data.meta.currentSeasonLabel}
                  currentSeasonNumber={currentSeasonNumber}
                  settingsPending={settingsPending}
                  onSeasonNumberChange={setCurrentSeasonNumber}
                  onSubmit={saveSeasonAnchor}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-5 xl:hidden">
          <div className="forest-card p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {!isGuest && <TabButton active={activeTab === "register"} onClick={() => setActiveTab("register")}>Nova partida</TabButton>}
              <TabButton active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")}>Leaderboard</TabButton>
              <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>Histórico</TabButton>
              <TabButton active={activeTab === "stats"} onClick={() => setActiveTab("stats")}>Estatísticas</TabButton>
              <TabButton active={activeTab === "logs"} onClick={() => setActiveTab("logs")}>Logs</TabButton>
            </div>

            {activeTab === "register" && !isGuest ? (
              <RegisterPanel
                form={form}
                pending={pending}
                onSubmit={submitMatch}
                onWinnerChange={(winner) => setForm((current) => ({ ...current, winner, winningFaction: current.participantFactions[winner] ?? current.winningFaction }))}
                onDateChange={(playedAt) => setForm((current) => ({ ...current, playedAt }))}
                onPlayerFactionChange={handlePlayerFactionChange}
                onToggleParticipant={toggleParticipant}
                onSeasonNumberChange={(seasonNumber) => setForm((current) => ({ ...current, seasonNumber }))}
                onVenueChange={(venue) => setForm((current) => ({ ...current, venue }))}
                onBoardMapChange={(boardMap) => setForm((current) => ({ ...current, boardMap }))}
                onScoreChange={(player, value) =>
                  setForm((current) => {
                    const nextDominances = { ...current.participantDominances };
                    delete nextDominances[player];
                    return {
                      ...current,
                      participantScores: { ...current.participantScores, [player]: value },
                      participantDominances: nextDominances
                    };
                  })
                }
                onDominanceChange={(player, card) =>
                  setForm((current) => {
                    const nextDominances = { ...current.participantDominances };
                    if (card) {
                      nextDominances[player] = card;
                    } else {
                      delete nextDominances[player];
                    }
                    const nextScores = { ...current.participantScores };
                    if (card) delete nextScores[player];
                    const vagabond = findVagabondPlayer(current.participants, current.participantFactions);
                    const clearingVagabondDominance = player === vagabond && !card;
                    return {
                      ...current,
                      participantDominances: nextDominances,
                      participantScores: nextScores,
                      coalitionPartner: clearingVagabondDominance ? "" : current.coalitionPartner,
                      coalitionWon: clearingVagabondDominance ? false : current.coalitionWon
                    };
                  })
                }
                onCoalitionPartnerChange={(coalitionPartner) =>
                  setForm((current) => {
                    const next = { ...current, coalitionPartner };
                    const faction = getCoalitionFaction(next);
                    return {
                      ...next,
                      winningFaction:
                        current.coalitionWon && faction ? faction : current.winningFaction
                    };
                  })
                }
                onCoalitionWonChange={(coalitionWon) =>
                  setForm((current) => {
                    const faction = getCoalitionFaction(current);
                    return {
                      ...current,
                      coalitionWon,
                      winningFaction:
                        coalitionWon && faction
                          ? faction
                          : current.participantFactions[current.winner] ?? current.winningFaction
                    };
                  })
                }
              />
            ) : null}

            {activeTab === "leaderboard" ? (
              <LeaderboardPanel
                data={data}
                seasonFilter={seasonFilter}
                factionFilter={factionFilter}
                venueFilter={venueFilter}
                leaderboard={leaderboard}
                classLeaders={classLeaders}
                onSeasonFilterChange={setSeasonFilter}
                onFactionFilterChange={(value) => setFactionFilter(value as (typeof FACTION_FILTERS)[number])}
                onVenueFilterChange={setVenueFilter}
              />
            ) : null}

            {activeTab === "history" ? (
              <HistoryPanel
                data={data}
                seasonFilter={seasonFilter}
                pending={pending}
                isGuest={isGuest}
                onSeasonFilterChange={setSeasonFilter}
                onDelete={removeMatch}
              />
            ) : null}

            {activeTab === "stats" ? (
              <StatsPanel data={data} />
            ) : null}

            {activeTab === "logs" ? (
              <LogsPanel logs={data.logs} />
            ) : null}
          </div>

          <aside className="space-y-5">
            {activeTab === "logs" && !isGuest ? (
              <SeasonPanel
                currentSeasonLabel={data.meta.currentSeasonLabel}
                currentSeasonNumber={currentSeasonNumber}
                settingsPending={settingsPending}
                onSeasonNumberChange={setCurrentSeasonNumber}
                onSubmit={saveSeasonAnchor}
              />
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function RegisterPanel({
  form,
  pending,
  onSubmit,
  onWinnerChange,
  onDateChange,
  onSeasonNumberChange,
  onVenueChange,
  onBoardMapChange,
  onScoreChange,
  onDominanceChange,
  onCoalitionPartnerChange,
  onCoalitionWonChange,
  onPlayerFactionChange,
  onToggleParticipant
}: {
  form: FormState;
  pending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onWinnerChange: (winner: string) => void;
  onDateChange: (playedAt: string) => void;
  onSeasonNumberChange: (seasonNumber: number) => void;
  onVenueChange: (venue: MatchVenue) => void;
  onBoardMapChange: (boardMap: MatchMap) => void;
  onScoreChange: (player: string, value: string) => void;
  onDominanceChange: (player: string, card: DominanceCard | null) => void;
  onCoalitionPartnerChange: (partner: string) => void;
  onCoalitionWonChange: (coalitionWon: boolean) => void;
  onPlayerFactionChange: (player: string, faction: string) => void;
  onToggleParticipant: (player: string) => void;
}) {
  const vagabondPlayer = findVagabondPlayer(form.participants, form.participantFactions);
  const vagabondDominance = vagabondPlayer ? form.participantDominances[vagabondPlayer] : undefined;
  const sortedForScores = [...form.participants].sort((playerA, playerB) => {
    const rawA = form.participantScores[playerA]?.trim();
    const rawB = form.participantScores[playerB]?.trim();
    const scoreA = rawA ? Number(rawA) : NaN;
    const scoreB = rawB ? Number(rawB) : NaN;
    const validA = rawA !== undefined && rawA !== "" && !Number.isNaN(scoreA);
    const validB = rawB !== undefined && rawB !== "" && !Number.isNaN(scoreB);
    if (validA && validB) return scoreB - scoreA || playerA.localeCompare(playerB);
    if (validA) return -1;
    if (validB) return 1;
    return playerA.localeCompare(playerB);
  });

  return (
    <form className="flex h-full flex-col gap-5 overflow-y-auto pr-1" onSubmit={onSubmit}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="storybook-title text-2xl">Registrar vitória</h2>
          <p className="mt-1 text-sm text-bark/70">Escolham de 3 a 6 participantes, o vencedor e a facção de cada um.</p>
        </div>
        <div className="shrink-0 space-y-1.5 sm:text-right">
          <span className="block text-sm font-semibold text-bark">Mapa</span>
          <MapSelector value={form.boardMap} onChange={onBoardMapChange} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-2 text-sm font-semibold">
          <span>Data da partida</span>
          <input
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            type="date"
            value={form.playedAt}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>

        <label className="space-y-2 text-sm font-semibold">
          <span>Season</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={form.seasonNumber}
            onChange={(event) => onSeasonNumberChange(Number(event.target.value))}
          >
            {Array.from({ length: MAX_SEASON_NUMBER - MIN_SEASON_NUMBER + 1 }, (_, index) => {
              const seasonNumber = MIN_SEASON_NUMBER + index;
              return (
                <option key={seasonNumber} value={seasonNumber}>
                  {`Season ${seasonNumber}`}
                </option>
              );
            })}
          </select>
        </label>

        <label className="space-y-2 text-sm font-semibold sm:col-span-2 lg:col-span-1">
          <span>Vencedor</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss disabled:opacity-50"
            value={form.winner}
            disabled={form.participants.length === 0 || form.coalitionWon}
            onChange={(event) => onWinnerChange(event.target.value)}
          >
            {form.participants.length === 0 && (
              <option value="">Selecione participantes</option>
            )}
            {form.participants.map((player) => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="max-w-xs space-y-2 text-sm font-semibold">
        <span>Modalidade</span>
        <div className="inline-flex w-full rounded-2xl border-2 border-bark/10 bg-white/80 p-1">
          {MATCH_VENUES.map((venue) => (
            <button
              key={venue}
              type="button"
              onClick={() => onVenueChange(venue)}
              className={
                form.venue === venue
                  ? "min-w-0 flex-1 whitespace-nowrap rounded-xl bg-moss px-4 py-2.5 text-sm font-bold text-cream shadow-sm transition"
                  : "min-w-0 flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold text-bark/70 transition hover:bg-bark/5"
              }
            >
              {formatMatchVenue(venue)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Participantes</span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${form.participants.length >= 3 ? "bg-amberleaf/30 text-bark" : "bg-berry/15 text-berry"}`}>
            {form.participants.length}/6 jogadores {form.participants.length < 3 ? `(mín. 3)` : ""}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLAYERS.map((player) => {
            const selected = form.participants.includes(player);
            return (
              <button
                key={player}
                type="button"
                onClick={() => onToggleParticipant(player)}
                className={`rounded-2xl border-2 px-3 py-3 text-sm font-bold transition ${
                  selected ? "border-moss bg-moss text-cream" : "border-bark/10 bg-white/70 text-bark hover:border-moss/40"
                }`}
              >
                {player}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-bark/60">Para manter a mesa válida, o app deixa marcar entre 3 e 6 jogadores.</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-semibold">Facções</span>
        <div className="space-y-2">
          {form.participants.map((player) => {
            const takenByOthers = new Set(
              form.participants
                .filter((p) => p !== player)
                .map((p) => form.participantFactions[p])
                .filter(Boolean)
            );
            return (
              <div key={player} className="rounded-2xl border-2 border-bark/10 bg-white/50 px-3 py-2">
                <span className={`mb-2 block text-sm font-bold ${player === form.winner ? "text-berry" : "text-bark"}`}>
                  {player}
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {FACTIONS.map((faction) => {
                    const blocked = faction !== "Vagabond" && takenByOthers.has(faction);
                    return (
                      <button
                        key={faction}
                        type="button"
                        title={blocked ? `${faction} já escolhida` : faction}
                        disabled={blocked}
                        onClick={() => onPlayerFactionChange(player, faction)}
                        className={`flex items-center justify-center transition ${blocked ? "opacity-25 cursor-not-allowed" : ""}`}
                      >
                        <FactionBadge faction={faction} iconOnly size="sm" selected={form.participantFactions[player] === faction} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {form.participants.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Pontos e dominâncias</span>
            <span className="text-xs text-bark/55">Cartas disponíveis ficam com quem ativar</span>
          </div>
          <div className="space-y-2">
            {sortedForScores.map((player) => {
              const playerDominance = form.participantDominances[player] ?? null;
              const showScore = !playerDominance;
              const isVagabondWithDominance =
                player === vagabondPlayer && Boolean(playerDominance);

              return (
                <div
                  key={player}
                  className={`flex flex-col gap-2 rounded-2xl border-2 px-3 py-2 ${
                    isVagabondWithDominance
                      ? "border-amberleaf/50 bg-amberleaf/10"
                      : "border-bark/10 bg-white/50"
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-bark">{player}</span>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {showScore ? (
                        <>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            placeholder="pts"
                            value={form.participantScores[player] ?? ""}
                            onChange={(event) => onScoreChange(player, event.target.value)}
                            className="w-20 rounded-xl border-2 border-bark/10 bg-white/80 px-3 py-2 text-center text-sm font-bold outline-none transition focus:border-moss"
                          />
                          <span className="text-xs font-semibold text-bark/40">ou</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-moss/15 px-2 py-1 text-xs font-bold text-moss">
                          Dominância: {playerDominance}
                        </span>
                      )}
                      <PlayerDominanceSelect
                        value={playerDominance}
                        availableCards={getAvailableDominanceCards(form.participantDominances, player)}
                        onChange={(card) => onDominanceChange(player, card)}
                      />
                    </div>
                  </div>

                  {isVagabondWithDominance ? (
                    <div className="flex flex-col gap-2 border-t border-amberleaf/30 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-bark">
                        <span className="shrink-0">Parceiro</span>
                        <select
                          className="min-w-0 flex-1 rounded-xl border-2 border-bark/10 bg-white/80 px-3 py-2 text-sm font-bold outline-none transition focus:border-moss"
                          value={form.coalitionPartner}
                          onChange={(event) => onCoalitionPartnerChange(event.target.value)}
                        >
                          <option value="">Escolher jogador</option>
                          {form.participants
                            .filter((p) => p !== vagabondPlayer)
                            .map((p) => (
                              <option key={p} value={p}>
                                {p}
                                {form.participantFactions[p]
                                  ? ` · ${form.participantFactions[p]}`
                                  : ""}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-bark">
                        <input
                          type="checkbox"
                          checked={form.coalitionWon}
                          onChange={(event) => onCoalitionWonChange(event.target.checked)}
                          className="h-4 w-4 accent-moss"
                        />
                        Coalizão venceu
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!form.coalitionWon && !form.participantDominances[form.winner] ? (
            <p className="text-xs text-bark/55">
              Vitória por pontos: ninguém pode ter mais pontos que o vencedor. Parceiro da coalizão pode chegar a 30.
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || form.participants.length < 3}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-berry px-4 py-3 font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
        Registrar partida
      </button>
    </form>
  );
}

function LeaderboardPanel({
  data,
  seasonFilter,
  factionFilter,
  venueFilter,
  leaderboard,
  classLeaders,
  onSeasonFilterChange,
  onFactionFilterChange,
  onVenueFilterChange
}: {
  data: DashboardData;
  seasonFilter: string;
  factionFilter: string;
  venueFilter: MatchVenueFilter;
  leaderboard: Array<{ player: string; wins: number; factionWins: [string, number][]; winrate: number | null; matchesPlayed: number }>;
  classLeaders: Array<{
    faction: string;
    leaders: string[];
    wins: number;
    matchesPlayed: number;
    winrate: number | null;
    isTie: boolean;
  }>;
  onSeasonFilterChange: (value: string) => void;
  onFactionFilterChange: (value: string) => void;
  onVenueFilterChange: (value: MatchVenueFilter) => void;
}) {
  const [leadersExpanded, setLeadersExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"wins" | "winrate">("wins");

  const sortedLeaderboard = sortBy === "winrate"
    ? [...leaderboard].sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1) || b.wins - a.wins)
    : leaderboard;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="storybook-title text-2xl">Leaderboard</h2>
          <p className="mt-1 text-sm text-bark/70">Veja o ranking geral e os melhores por facção.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-sm font-semibold w-full">
            <span>Season</span>
            <select
              className="w-full max-w-xs rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
              value={seasonFilter}
              onChange={(event) => onSeasonFilterChange(event.target.value)}
            >
              {data.seasons.map((season) => (
                <option key={season.value} value={season.value}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold w-full">
            <span>Modalidade</span>
            <select
              className="w-full max-w-xs rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
              value={venueFilter}
              onChange={(event) => onVenueFilterChange(event.target.value as MatchVenueFilter)}
            >
              <option value="all">Todas</option>
              <option value="online">Online</option>
              <option value="presencial">Presencial</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold w-full">
            <span>Facção</span>
            <select
              className="w-full max-w-xs rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
              value={factionFilter}
              onChange={(event) => onFactionFilterChange(event.target.value)}
            >
              <option value="all">Todas</option>
              {FACTIONS.map((faction) => (
                <option key={faction} value={faction}>
                  {faction}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold w-full">
            <span>Ordenar por</span>
            <select
              className="w-full max-w-xs rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "wins" | "winrate")}
            >
              <option value="wins">Vitórias</option>
              <option value="winrate">Winrate</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-3">
        {sortedLeaderboard.map((entry, index) => (
          <div key={entry.player} className="rounded-[24px] border-2 border-bark/10 bg-white/65 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-bark/50">#{index + 1}</p>
                <h3 className="mt-1 text-xl font-bold text-bark">{entry.player}</h3>
              </div>
              <div className="bg-amberleaf/45 px-4 py-3 text-center rounded-2xl">
                <p className="text-2xl font-extrabold">{entry.wins}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bark/60">vitórias</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {entry.factionWins.length > 0 ? (
                  entry.factionWins.slice(0, 3).map(([faction]) => (
                    <span key={`${entry.player}-${faction}`} className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2 py-1 text-sm font-bold text-bark">
                      <FactionBadge faction={faction} iconOnly size="sm" />
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-bark/55">Ainda sem vitórias...</span>
                )}
              </div>
              <div className="bg-white/70 border border-bark/10 px-4 py-2 text-center rounded-2xl shrink-0">
                <p className="text-lg font-extrabold">
                  {entry.winrate !== null ? `${Math.round(entry.winrate * 100)}%` : "—"}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bark/60">winrate</p>
                <p className="text-[10px] text-bark/45 mt-0.5">{entry.matchesPlayed} partida{entry.matchesPlayed !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setLeadersExpanded((current) => !current)}
          className="flex items-center justify-between rounded-[22px] border-2 border-bark/10 bg-white/65 px-4 py-3 text-left"
        >
          <h3 className="storybook-title text-xl">Líderes por facção</h3>
          <ChevronDown className={`h-5 w-5 text-bark transition ${leadersExpanded ? "rotate-180" : ""}`} />
        </button>
        {leadersExpanded
          ? classLeaders.map((entry) => (
              <div key={entry.faction} className="flex items-center justify-between gap-3 rounded-[24px] border-2 border-bark/10 bg-white/65 p-4">
                <div className="flex items-center gap-3">
                  <FactionBadge faction={entry.faction} iconOnly size="lg" />
                  <div className="text-sm font-semibold text-bark">
                    {entry.leaders.length > 0 ? (
                      <>
                        <span className="font-bold">
                          {formatFactionLeaders(entry.leaders, entry.isTie)}
                        </span>
                        {" · "}
                        {entry.wins} vitória{entry.wins !== 1 ? "s" : ""}
                        {!entry.isTie
                          ? ` em ${entry.matchesPlayed} partida${entry.matchesPlayed !== 1 ? "s" : ""}`
                          : null}
                      </>
                    ) : (
                      <span className="text-bark/50">Ninguém ainda</span>
                    )}
                  </div>
                </div>
                {entry.winrate !== null && (
                  <div className="bg-white/70 border border-bark/10 px-3 py-2 text-center rounded-2xl shrink-0">
                    <p className="text-base font-extrabold">{Math.round(entry.winrate * 100)}%</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-bark/55">winrate</p>
                  </div>
                )}
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function HistoryPanel({
  data,
  seasonFilter,
  pending,
  isGuest,
  onSeasonFilterChange,
  onDelete
}: {
  data: DashboardData;
  seasonFilter: string;
  pending: boolean;
  isGuest: boolean;
  onSeasonFilterChange: (value: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [playerFilter, setPlayerFilter] = useState("all");
  const [coalitionFilter, setCoalitionFilter] = useState<"all" | "coalition" | "coalition_win" | "no_coalition">("all");
  const [venueFilter, setVenueFilter] = useState<MatchVenueFilter>("all");
  const [mapFilter, setMapFilter] = useState<MatchMapFilter>("all");

  const historyMatches = useMemo(() => {
    return data.matches.filter((match) => {
      if (seasonFilter !== "all" && match.seasonLabel !== seasonFilter) return false;
      if (!matchesVenueFilter(match, venueFilter)) return false;
      if (!matchesMapFilter(match, mapFilter)) return false;

      if (playerFilter !== "all" && !getVictoryRecipients(match).includes(playerFilter)) {
        return false;
      }

      if (coalitionFilter === "coalition" && !hasVagabondCoalition(match)) return false;
      if (coalitionFilter === "coalition_win" && !isCoalitionVictory(match)) return false;
      if (coalitionFilter === "no_coalition" && (hasVagabondCoalition(match) || isCoalitionVictory(match))) {
        return false;
      }

      return true;
    });
  }, [data.matches, seasonFilter, playerFilter, coalitionFilter, venueFilter, mapFilter]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="storybook-title text-2xl">Histórico de partidas</h2>
          <p className="mt-1 text-sm text-bark/70">Tudo fica aberto para o grupo adicionar ou apagar registros.</p>
        </div>
        <button
          type="button"
          onClick={() => exportMatchesToExcel(data.matches)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-moss/30 bg-moss/10 px-4 py-2.5 text-sm font-bold text-moss transition hover:bg-moss/20"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="space-y-1 text-sm font-semibold">
          <span>Season</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={seasonFilter}
            onChange={(event) => onSeasonFilterChange(event.target.value)}
          >
            {data.seasons.map((season) => (
              <option key={season.value} value={season.value}>
                {season.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span>Modalidade</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={venueFilter}
            onChange={(event) => setVenueFilter(event.target.value as MatchVenueFilter)}
          >
            <option value="all">Todas</option>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span>Mapa</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={mapFilter}
            onChange={(event) => setMapFilter(event.target.value as MatchMapFilter)}
          >
            <option value="all">Todos</option>
            {MATCH_MAPS.map((map) => (
              <option key={map} value={map}>
                {formatMatchMap(map)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          <span>Vencedor</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={playerFilter}
            onChange={(event) => setPlayerFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            {PLAYERS.map((player) => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold sm:col-span-2 lg:col-span-1">
          <span>Coalizão</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={coalitionFilter}
            onChange={(event) => setCoalitionFilter(event.target.value as typeof coalitionFilter)}
          >
            <option value="all">Todas</option>
            <option value="coalition">Com coalizão</option>
            <option value="coalition_win">Vitória da coalizão</option>
            <option value="no_coalition">Sem coalizão</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        {historyMatches.length > 0 ? (
          historyMatches.map((match) => <HistoryCard key={match.id} match={match} onDelete={onDelete} pending={pending} isGuest={isGuest} />)
        ) : (
          <div className="rounded-[24px] border-2 border-dashed border-bark/15 bg-white/45 p-8 text-center text-sm text-bark/60">
            Nenhuma partida registrada nesse filtro ainda.
          </div>
        )}
      </div>
    </div>
  );
}

function LogsPanel({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="flex h-[60vh] flex-col gap-4 overflow-hidden xl:h-full">
      <div>
        <h2 className="storybook-title text-2xl">Logs</h2>
        <p className="mt-1 text-sm text-bark/70">Toda criação e exclusão de registro aparece aqui.</p>
      </div>
      <LogsTerminal logs={logs} />
    </div>
  );
}

function SeasonPanel({
  currentSeasonLabel,
  currentSeasonNumber,
  settingsPending,
  onSeasonNumberChange,
  onSubmit
}: {
  currentSeasonLabel: string;
  currentSeasonNumber: number;
  settingsPending: boolean;
  onSeasonNumberChange: (value: number) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="forest-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="storybook-title text-2xl">Seasons</h2>
          <p className="mt-1 text-sm text-bark/70">
            Escolham qual season está valendo agora. Use <strong>Season 0</strong> só para cadastrar partidas antigas (antes do app). Na aba de registro você também pode escolher a season de cada partida.
          </p>
        </div>
        <span className="rounded-full bg-moss px-6 py-2 text-sm font-bold uppercase tracking-[0.18em] text-cream whitespace-nowrap">
          {currentSeasonLabel}
        </span>
      </div>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <label className="space-y-2 text-sm font-semibold">
          <span>Season atual</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
            value={currentSeasonNumber}
            onChange={(event) => onSeasonNumberChange(Number(event.target.value))}
          >
            {Array.from({ length: MAX_SEASON_NUMBER - MIN_SEASON_NUMBER + 1 }, (_, index) => {
              const seasonNumber = MIN_SEASON_NUMBER + index;
              return (
                <option key={seasonNumber} value={seasonNumber}>
                  {`Season ${seasonNumber}`}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="submit"
          disabled={settingsPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-bark px-4 py-3 font-bold text-cream transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {settingsPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
          Salvar season atual
        </button>
      </form>
    </section>
  );
}

function formatFactionLeaders(leaders: string[], isTie: boolean) {
  const names = leaders.join(", ");
  return isTie ? `${names} (empate)` : names;
}

function formatDisplayDate(value: string) {
  if (!value) return "Sem data";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("pt-BR");
}

function formatDisplayDateTime(value: string) {
  if (!value) return "Sem horário";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("pt-BR");
}

function LogsTerminal({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border-2 border-[#2b231c] bg-[#18130f] shadow-story">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#241c16] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#f87171]" />
        <span className="h-3 w-3 rounded-full bg-[#fbbf24]" />
        <span className="h-3 w-3 rounded-full bg-[#4ade80]" />
        <span className="ml-2 text-xs font-bold uppercase tracking-[0.25em] text-[#d9c7a5]">activity.log</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 font-mono text-sm text-[#d7f7c2]">
        {logs.length > 0 ? (
          logs.map((log) => (
            <div key={log.id} className="space-y-1">
              <div className="text-xs text-[#8eb47a]">
                [{formatDisplayDateTime(log.createdAt)}] {log.action === "CREATE_MATCH" ? "CREATE" : "DELETE"} by {log.actorName}
              </div>
              <div>
                <span className="mr-2 text-[#facc15]">$</span>
                <span>{log.message}</span>
              </div>
            </div>
          ))
        ) : (
          <div>
            <span className="mr-2 text-[#facc15]">$</span>
            <span>Nenhum log registrado ainda.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-white/25 bg-cream/90 px-2 py-1">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-bark/60">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 text-xs font-extrabold leading-tight text-bark sm:text-[14px]">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active ? "bg-bark text-cream" : "bg-white/70 text-bark hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function MatchFactionsDisplay({ match }: { match: MatchRecord }) {
  const winningFactions = getWinningFactions(match);
  const factions = sortFactionsForDisplay(getFactionsInPlay(match), winningFactions);
  const winners = new Set(winningFactions);

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-bark/50">Facções na mesa</span>
      <div className="flex flex-wrap gap-2">
        {factions.map((faction) => (
          <FactionBadge key={`${match.id}-${faction}`} faction={faction} winner={winners.has(faction)} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({
  match,
  onDelete,
  pending,
  isGuest
}: {
  match: MatchRecord;
  onDelete: (id: string) => Promise<void>;
  pending: boolean;
  isGuest: boolean;
}) {
  return (
    <div className="rounded-[24px] border-2 border-bark/10 bg-white/65 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-moss px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cream">
              {match.seasonLabel}
            </span>
            <span className="leaf-chip">{formatDisplayDate(match.playedAt)}</span>
            <span className="leaf-chip">{formatMatchVenue(match.venue)}</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-bark">{match.winner}</h3>
            <p className="mt-1 text-sm text-bark/70">
              venceu contra {getMatchOpponents(match).join(", ")}
            </p>
            {getWinnerDominanceCard(match) ? (
              <p className="mt-1 text-xs font-semibold text-bark/60">
                Dominância: {getWinnerDominanceCard(match)}
              </p>
            ) : null}
            {formatParticipantDominances(match) ? (
              <p className="mt-1 text-xs text-bark/55">{formatParticipantDominances(match)}</p>
            ) : null}
            {getSortedScores(match).length > 0 ? (
              <p className="mt-2 text-xs text-bark/65">
                Pontos:{" "}
                {getSortedScores(match)
                  .map((entry) => `${entry.player} ${entry.score}`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-bark/50">Mapa</span>
            <MapBadge map={match.boardMap} />
          </div>
          <MatchFactionsDisplay match={match} />
          {match.vagabondCoalition && !match.coalitionWinners?.length ? (
            <p className="text-xs text-bark/55">{formatVagabondCoalitionNote(match.vagabondCoalition)}</p>
          ) : null}
        </div>
        {!isGuest && <button
          type="button"
          onClick={() => onDelete(match.id)}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-berry/20 bg-berry/10 px-4 py-3 text-sm font-bold text-berry transition hover:bg-berry/15 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Apagar
        </button>}
      </div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-[22px] border border-white/30 bg-[linear-gradient(135deg,#7d9f57,#4e6a35)] px-5 py-3.5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-base">🏆</span>
        <span className="text-sm font-bold">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded-full p-1 opacity-70 transition hover:opacity-100 hover:bg-white/20"
          aria-label="Fechar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
