"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid
} from "recharts";
import type { DashboardData } from "@/lib/types";
import { FACTIONS, PLAYERS } from "@/lib/constants";
import { getVictoryRecipients } from "@/lib/match-utils";

const PLAYER_COLORS: Record<string, string> = {
  Rafinha:  "#4e6a35",
  Reels:    "#c0872f",
  Papito:   "#7d3c52",
  Filipão:  "#2a7a9b",
  Kleber:   "#8b5e3c",
  Isaac:    "#5b8a5e",
  Varanda:  "#9b59b6",
  Guedes:   "#e07b39",
};

const FACTION_COLORS: Record<string, string> = {
  "Marquise de Cat":    "#e07b39",
  "Eyrie Dynasties":    "#2a7a9b",
  "Woodland Alliance":  "#4e6a35",
  "Vagabond":           "#888",
  "Riverfolk Company":  "#c05c7e",
  "Lizard Cult":        "#c9a227",
  "Underground Duchy":  "#8b5cf6",
  "Corvid Conspiracy":  "#555",
  "Keepers in Iron":    "#8b5e3c",
  "Lord of the Hundreds": "#14b8a6",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border-2 border-bark/10 bg-white/65 p-5">
      <h3 className="storybook-title mb-4 text-lg">{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[14px] border border-bark/10 bg-white/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      {label && <p className="mb-1 font-bold text-bark">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-semibold">
          {entry.name}: {typeof entry.value === "number" && entry.value % 1 !== 0 ? `${entry.value.toFixed(1)}%` : entry.value}
        </p>
      ))}
    </div>
  );
}

export function StatsPanel({ data }: { data: DashboardData }) {
  const [seasonFilter, setSeasonFilter] = useState("all");

  const matches = useMemo(
    () => data.matches.filter((m) => seasonFilter === "all" || m.seasonLabel === seasonFilter),
    [data.matches, seasonFilter]
  );

  // ── 1. Vitórias por jogador ───────────────────────────────────────────────
  const winsByPlayer = useMemo(() => {
    const map = new Map<string, number>(PLAYERS.map((p) => [p, 0]));
    matches.forEach((m) => {
      getVictoryRecipients(m).forEach((player) => {
        map.set(player, (map.get(player) ?? 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([name, wins]) => ({ name, wins }))
      .filter((e) => e.wins > 0)
      .sort((a, b) => b.wins - a.wins);
  }, [matches]);

  // ── 2. Vitórias por facção ────────────────────────────────────────────────
  const winsByFaction = useMemo(() => {
    const map = new Map<string, number>(FACTIONS.map((f) => [f, 0]));
    matches.forEach((m) => map.set(m.winningFaction, (map.get(m.winningFaction) ?? 0) + 1));
    return [...map.entries()]
      .map(([faction, wins]) => ({ faction, wins }))
      .filter((e) => e.wins > 0)
      .sort((a, b) => b.wins - a.wins);
  }, [matches]);

  // ── 3. Winrate por jogador ────────────────────────────────────────────────
  const winrateByPlayer = useMemo(() => {
    const played = new Map<string, number>(PLAYERS.map((p) => [p, 0]));
    const wins   = new Map<string, number>(PLAYERS.map((p) => [p, 0]));
    matches.forEach((m) => {
      m.participants.forEach((p) => played.set(p, (played.get(p) ?? 0) + 1));
      getVictoryRecipients(m).forEach((player) => {
        wins.set(player, (wins.get(player) ?? 0) + 1);
      });
    });
    return PLAYERS
      .map((p) => ({
        name: p,
        winrate: played.get(p)! > 0 ? Math.round((wins.get(p)! / played.get(p)!) * 100) : 0,
        played: played.get(p)!
      }))
      .filter((e) => e.played > 0)
      .sort((a, b) => b.winrate - a.winrate);
  }, [matches]);

  // ── 4. Evolução acumulada de vitórias por mês ─────────────────────────────
  const evolutionData = useMemo(() => {
    const sorted = [...matches].sort(
      (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
    );

    const cumulative = new Map<string, number>(PLAYERS.map((p) => [p, 0]));
    const byMonth: Record<string, Record<string, number>> = {};

    sorted.forEach((m) => {
      const date = new Date(m.playedAt);
      const month = `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
      getVictoryRecipients(m).forEach((player) => {
        cumulative.set(player, (cumulative.get(player) ?? 0) + 1);
      });
      byMonth[month] = Object.fromEntries(cumulative);
    });

    return Object.entries(byMonth).map(([month, vals]) => ({ month, ...vals }));
  }, [matches]);

  // Players who have at least one win in filtered matches
  const activePlayers = useMemo(
    () => PLAYERS.filter((p) => matches.some((m) => getVictoryRecipients(m).includes(p) || m.participants.includes(p))),
    [matches]
  );

  if (matches.length === 0) {
    return (
      <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
        <div>
          <h2 className="storybook-title text-2xl">Estatísticas</h2>
          <p className="mt-1 text-sm text-bark/70">Gráficos e análises das partidas registradas.</p>
        </div>
        <div className="rounded-[24px] border-2 border-dashed border-bark/15 bg-white/45 p-10 text-center text-sm text-bark/60">
          Nenhuma partida registrada ainda para gerar estatísticas.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="storybook-title text-2xl">Estatísticas</h2>
          <p className="mt-1 text-sm text-bark/70">Gráficos e análises das partidas registradas.</p>
        </div>
        <label className="space-y-1 text-sm font-semibold">
          <span>Season</span>
          <select
            className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss sm:min-w-44"
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
          >
            {data.seasons.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">

        {/* Vitórias por jogador */}
        <ChartCard title="Vitórias por jogador">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={winsByPlayer}
                dataKey="wins"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {winsByPlayer.map((entry) => (
                  <Cell key={entry.name} fill={PLAYER_COLORS[entry.name] ?? "#888"} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs font-semibold text-bark">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Vitórias por facção */}
        <ChartCard title="Vitórias por facção">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winsByFaction} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="faction"
                width={130}
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="wins" name="Vitórias" radius={[0, 6, 6, 0]}>
                {winsByFaction.map((entry) => (
                  <Cell key={entry.faction} fill={FACTION_COLORS[entry.faction] ?? "#4e6a35"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Winrate por jogador */}
        <ChartCard title="Winrate por jogador">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winrateByPlayer} margin={{ left: 0, right: 16, top: 4 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="winrate" name="Winrate" radius={[6, 6, 0, 0]}>
                {winrateByPlayer.map((entry) => (
                  <Cell key={entry.name} fill={PLAYER_COLORS[entry.name] ?? "#4e6a35"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Evolução de vitórias */}
        <ChartCard title="Evolução de vitórias">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolutionData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5ddd0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              {activePlayers.map((player) => (
                <Line
                  key={player}
                  type="monotone"
                  dataKey={player}
                  stroke={PLAYER_COLORS[player] ?? "#888"}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {activePlayers.map((player) => (
              <span key={player} className="flex items-center gap-1.5 text-xs font-semibold text-bark">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PLAYER_COLORS[player] ?? "#888" }} />
                {player}
              </span>
            ))}
          </div>
        </ChartCard>

      </div>
    </div>
  );
}
