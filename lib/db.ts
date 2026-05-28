import { neon } from "@neondatabase/serverless";
import type { ActivityLog, DashboardData, MatchRecord } from "@/lib/types";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  return neon(databaseUrl);
}

export async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      winner TEXT NOT NULL,
      participants JSON NOT NULL,
      participant_factions JSON,
      winning_faction TEXT NOT NULL,
      played_at DATE NOT NULL,
      season_label TEXT NOT NULL,
      season_number INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_name TEXT NOT NULL DEFAULT 'Sistema',
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS participant_factions JSON;
  `;

  await sql`
    ALTER TABLE activity_logs
    ADD COLUMN IF NOT EXISTS actor_name TEXT NOT NULL DEFAULT 'Sistema';
  `;

  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('current_season', '1')
    ON CONFLICT (key) DO NOTHING;
  `;
}

export async function getCurrentSeasonNumber() {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT value
    FROM app_settings
    WHERE key = 'current_season'
    LIMIT 1;
  `) as Array<{ value: string }>;

  const parsedValue = Number(result[0]?.value ?? "1");
  return Number.isInteger(parsedValue) && parsedValue >= 1 && parsedValue <= 12 ? parsedValue : 1;
}

export async function updateCurrentSeasonNumber(seasonNumber: number) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('current_season', ${String(seasonNumber)})
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value;
  `;
}

export async function listMatches(): Promise<MatchRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT id, winner, participants, participant_factions, winning_faction, played_at, season_label, season_number, created_at
    FROM matches
    ORDER BY played_at DESC, created_at DESC;
  `) as Array<{
    id: string;
    winner: string;
    participants: string | string[];
    participant_factions: string | Record<string, string | null> | null;
    winning_faction: string;
    played_at: string;
    season_label: string;
    season_number: number;
    created_at: string;
  }>;

  return result.map((row) => {
    const participants: string[] = Array.isArray(row.participants) ? row.participants : JSON.parse(row.participants);
    const parsedFactions: Record<string, string | null> =
      row.participant_factions == null
        ? {}
        : typeof row.participant_factions === "object"
        ? (row.participant_factions as Record<string, string | null>)
        : JSON.parse(row.participant_factions);

    const participantFactions = participants.reduce<Record<string, string | null>>((acc, player) => {
      acc[player] = parsedFactions[player] ?? (player === row.winner ? row.winning_faction : null);
      return acc;
    }, {});

    return {
      id: row.id,
      winner: row.winner,
      participants,
      participantFactions,
      winningFaction: row.winning_faction,
      playedAt: row.played_at,
      seasonLabel: row.season_label,
      seasonNumber: row.season_number,
      createdAt: row.created_at
    };
  });
}

export async function listLogs(): Promise<ActivityLog[]> {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT id, action, actor_name, message, created_at
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 100;
  `) as Array<{
    id: string;
    action: "CREATE_MATCH" | "DELETE_MATCH";
    actor_name: string;
    message: string;
    created_at: string;
  }>;

  return result.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: row.actor_name,
    message: row.message,
    createdAt: row.created_at
  }));
}

async function createLog(action: "CREATE_MATCH" | "DELETE_MATCH", actorName: string, message: string) {
  await ensureSchema();
  const sql = getSql();

  await sql`
    INSERT INTO activity_logs (id, action, actor_name, message)
    VALUES (${crypto.randomUUID()}, ${action}, ${actorName}, ${message});
  `;
}

export async function createMatch(input: {
  winner: string;
  participants: string[];
  participantFactions: Record<string, string>;
  winningFaction: string;
  playedAt: string;
  seasonNumber: number;
  actorName: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  const seasonLabel = `Season ${input.seasonNumber}`;

  await sql`
    INSERT INTO matches (
      id, winner, participants, participant_factions, winning_faction, played_at, season_label, season_number
    ) VALUES (
      ${id},
      ${input.winner},
      ${JSON.stringify(input.participants)},
      ${JSON.stringify(input.participantFactions)},
      ${input.winningFaction},
      ${input.playedAt},
      ${seasonLabel},
      ${input.seasonNumber}
    );
  `;

  const opponents = input.participants.filter((player) => player !== input.winner).join(", ");
  await createLog(
    "CREATE_MATCH",
    input.actorName,
    `${input.winner} venceu com ${input.winningFaction} contra ${opponents} em ${input.playedAt} (${seasonLabel})`
  );
}

export async function deleteMatch(id: string, actorName: string) {
  await ensureSchema();
  const sql = getSql();
  const matchResult = (await sql`
    SELECT winner, participants, participant_factions, winning_faction, played_at, season_label
    FROM matches
    WHERE id = ${id}
    LIMIT 1;
  `) as Array<{
    winner: string;
    participants: string | string[];
    participant_factions: string | Record<string, string | null> | null;
    winning_faction: string;
    played_at: string;
    season_label: string;
  }>;

  const match = matchResult[0];

  await sql`
    DELETE FROM matches
    WHERE id = ${id};
  `;

  if (match) {
    const participants = Array.isArray(match.participants) ? match.participants : JSON.parse(match.participants);
    const opponents = participants.filter((player: string) => player !== match.winner).join(", ");
    await createLog(
      "DELETE_MATCH",
      actorName,
      `Registro apagado: ${match.winner} com ${match.winning_faction} contra ${opponents} em ${match.played_at} (${match.season_label})`
    );
  }
}

export async function getDashboardData(currentUser: string): Promise<DashboardData> {
  const currentSeasonNumber = await getCurrentSeasonNumber();
  const matches = await listMatches();
  const logs = await listLogs();
  const allSeasons = Array.from({ length: 12 }, (_, index) => {
    const seasonNumber = index + 1;
    const label = `Season ${seasonNumber}`;
    return { label, value: label };
  });

  return {
    matches,
    logs,
    seasons: [{ label: "All time", value: "all" }, ...allSeasons],
    meta: {
      currentSeasonNumber,
      currentSeasonLabel: `Season ${currentSeasonNumber}`,
      currentUser
    }
  };
}
