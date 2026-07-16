import { neon } from "@neondatabase/serverless";
import type { DominanceCard } from "@/lib/constants";
import { ADMIN_MEMBER_NAMES, DOMINANCE_CARDS, SEED_LEAGUE_PLAYERS } from "@/lib/constants";
import { isValidSeasonNumber, listSeasonOptions, seasonLabel } from "@/lib/seasons";
import { deriveGuestParticipants } from "@/lib/league-players";
import { DEFAULT_MATCH_MAP, normalizeMatchMap, type MatchMap } from "@/lib/match-map";
import { DEFAULT_MATCH_OFFICIAL, normalizeMatchOfficial } from "@/lib/match-official";
import { DEFAULT_MATCH_VENUE, normalizeMatchVenue, type MatchVenue } from "@/lib/match-venue";
import type { ActivityLog, DashboardData, MatchRecord, MemberRecord, VagabondCoalition } from "@/lib/types";

const PIN_PATTERN = /^\d{4}$/;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  return neon(databaseUrl);
}

let schemaReady: Promise<void> | null = null;

function generateUniquePin(existingPins: Set<string>): string {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (!existingPins.has(pin)) {
      return pin;
    }
  }
  throw new Error("Não foi possível gerar um PIN único.");
}

function parseOptionalMemberPins(): Record<string, string> | null {
  const rawPins = process.env.MEMBER_PINS;
  if (!rawPins?.trim()) return null;

  const parsed = JSON.parse(rawPins) as Record<string, string>;
  for (const player of SEED_LEAGUE_PLAYERS) {
    const pin = parsed[player];
    if (!pin || !PIN_PATTERN.test(pin)) {
      throw new Error(`PIN inválido para ${player} em MEMBER_PINS (bootstrap).`);
    }
  }

  const pins = Object.values(parsed);
  if (new Set(pins).size !== pins.length) {
    throw new Error("MEMBER_PINS contém PINs duplicados.");
  }

  return parsed;
}

async function seedMembersIfEmpty() {
  const sql = getSql();
  const countResult = (await sql`
    SELECT COUNT(*)::int AS count
    FROM members;
  `) as Array<{ count: number }>;

  if ((countResult[0]?.count ?? 0) > 0) return;

  const envPins = parseOptionalMemberPins();
  const usedPins = new Set<string>();
  const adminSet = new Set<string>(ADMIN_MEMBER_NAMES);

  for (const name of SEED_LEAGUE_PLAYERS) {
    const pin = envPins?.[name] ?? generateUniquePin(usedPins);
    usedPins.add(pin);
    await sql`
      INSERT INTO members (id, name, pin, is_admin)
      VALUES (
        ${crypto.randomUUID()},
        ${name},
        ${pin},
        ${adminSet.has(name)}
      )
      ON CONFLICT (name) DO NOTHING;
    `;
  }
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = runEnsureSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function runEnsureSchema() {
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
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      pin TEXT NOT NULL UNIQUE,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT members_pin_format CHECK (pin ~ '^[0-9]{4}$')
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
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS participant_scores JSON;
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS won_by_dominance BOOLEAN NOT NULL DEFAULT FALSE;
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS dominance_card TEXT;
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS coalition_winners JSON;
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS participant_dominances JSON;
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS vagabond_coalition JSON;
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS venue TEXT NOT NULL DEFAULT 'online';
  `;

  await sql`
    UPDATE matches
    SET venue = ${DEFAULT_MATCH_VENUE}
    WHERE venue IS NULL
      OR TRIM(venue) = ''
      OR venue NOT IN ('online', 'presencial');
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS board_map TEXT NOT NULL DEFAULT 'floresta';
  `;

  await sql`
    UPDATE matches
    SET board_map = ${DEFAULT_MATCH_MAP}
    WHERE board_map IS NULL
      OR TRIM(board_map) = ''
      OR board_map NOT IN ('floresta', 'inverno', 'lago', 'montanha');
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS guest_participants JSON NOT NULL DEFAULT '[]';
  `;

  await sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT TRUE;
  `;

  await sql`
    UPDATE matches
    SET is_official = ${DEFAULT_MATCH_OFFICIAL}
    WHERE is_official IS NULL;
  `;

  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('current_season', '1')
    ON CONFLICT (key) DO NOTHING;
  `;

  await seedMembersIfEmpty();
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
  return isValidSeasonNumber(parsedValue) ? parsedValue : 1;
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
    SELECT
      id,
      winner,
      participants,
      participant_factions,
      participant_scores,
      participant_dominances,
      vagabond_coalition,
      winning_faction,
      won_by_dominance,
      dominance_card,
      coalition_winners,
      played_at,
      season_label,
      season_number,
      venue,
      board_map,
      is_official,
      guest_participants,
      created_at
    FROM matches
    ORDER BY played_at DESC, created_at DESC;
  `) as Array<{
    id: string;
    winner: string;
    participants: string | string[];
    participant_factions: string | Record<string, string | null> | null;
    participant_scores: string | Record<string, number> | null;
    participant_dominances: string | Record<string, DominanceCard> | null;
    vagabond_coalition: string | VagabondCoalition | null;
    winning_faction: string;
    won_by_dominance: boolean;
    dominance_card: string | null;
    coalition_winners: string | string[] | null;
    played_at: string;
    season_label: string;
    season_number: number;
    venue: string | null;
    board_map: string | null;
    is_official: boolean | null;
    guest_participants: string | string[] | null;
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
      acc[player] = parsedFactions[player] ?? null;
      return acc;
    }, {});

    const parsedScores =
      row.participant_scores == null
        ? null
        : typeof row.participant_scores === "object"
        ? (row.participant_scores as Record<string, number>)
        : (JSON.parse(row.participant_scores) as Record<string, number>);

    const coalitionWinners =
      row.coalition_winners == null
        ? null
        : Array.isArray(row.coalition_winners)
        ? row.coalition_winners
        : (JSON.parse(row.coalition_winners) as string[]);

    const parsedDominances =
      row.participant_dominances == null
        ? null
        : typeof row.participant_dominances === "object"
        ? (row.participant_dominances as Record<string, DominanceCard>)
        : (JSON.parse(row.participant_dominances) as Record<string, DominanceCard>);

    const dominanceCard =
      row.dominance_card && DOMINANCE_CARDS.includes(row.dominance_card as DominanceCard)
        ? (row.dominance_card as DominanceCard)
        : null;

    let participantDominances = parsedDominances;
    if (!participantDominances && dominanceCard) {
      if (coalitionWinners?.length) {
        const vagabond = coalitionWinners.find((player) => participantFactions[player] === "Vagabond");
        if (vagabond) participantDominances = { [vagabond]: dominanceCard };
      } else if (!row.winner.startsWith("COALIZÃO")) {
        participantDominances = { [row.winner]: dominanceCard };
      }
    }

    const parsedVagabondCoalition =
      row.vagabond_coalition == null
        ? null
        : typeof row.vagabond_coalition === "object"
        ? (row.vagabond_coalition as VagabondCoalition)
        : (JSON.parse(row.vagabond_coalition) as VagabondCoalition);

    let vagabondCoalition = parsedVagabondCoalition;
    if (!vagabondCoalition && coalitionWinners?.length === 2) {
      const vagabond = coalitionWinners.find((player) => participantFactions[player] === "Vagabond");
      const partner = coalitionWinners.find((player) => player !== vagabond);
      if (vagabond && partner) {
        vagabondCoalition = {
          vagabond,
          partner,
          faction: row.winning_faction
        };
      }
    }

    return {
      id: row.id,
      winner: row.winner,
      participants,
      participantFactions,
      participantScores: parsedScores,
      participantDominances,
      vagabondCoalition,
      winningFaction: row.winning_faction,
      wonByDominance: Boolean(row.won_by_dominance),
      dominanceCard,
      coalitionWinners: coalitionWinners?.length ? coalitionWinners : null,
      playedAt: row.played_at,
      seasonLabel: row.season_label,
      seasonNumber: row.season_number,
      venue: normalizeMatchVenue(row.venue),
      boardMap: normalizeMatchMap(row.board_map),
      isOfficial: normalizeMatchOfficial(row.is_official),
      guestParticipants:
        row.guest_participants == null
          ? deriveGuestParticipants(participants, SEED_LEAGUE_PLAYERS)
          : Array.isArray(row.guest_participants)
          ? row.guest_participants
          : (JSON.parse(row.guest_participants) as string[]),
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
    action: "CREATE_MATCH" | "DELETE_MATCH" | "CREATE_MEMBER";
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

async function createLog(
  action: "CREATE_MATCH" | "DELETE_MATCH" | "CREATE_MEMBER",
  actorName: string,
  message: string
) {
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
  participantScores?: Record<string, number> | null;
  participantDominances?: Record<string, DominanceCard> | null;
  winningFaction: string;
  wonByDominance?: boolean;
  dominanceCard?: DominanceCard | null;
  vagabondCoalition?: VagabondCoalition | null;
  coalitionWinners?: string[] | null;
  playedAt: string;
  seasonNumber: number;
  venue: MatchVenue;
  boardMap: MatchMap;
  isOfficial: boolean;
  guestParticipants: string[];
  actorName: string;
}) {
  await ensureSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  const matchSeasonLabel = seasonLabel(input.seasonNumber);

  const participantScores =
    input.participantScores && Object.keys(input.participantScores).length > 0
      ? JSON.stringify(input.participantScores)
      : null;

  const participantDominances =
    input.participantDominances && Object.keys(input.participantDominances).length > 0
      ? JSON.stringify(input.participantDominances)
      : null;

  const vagabondCoalition = input.vagabondCoalition ? JSON.stringify(input.vagabondCoalition) : null;

  await sql`
    INSERT INTO matches (
      id,
      winner,
      participants,
      participant_factions,
      participant_scores,
      participant_dominances,
      vagabond_coalition,
      winning_faction,
      won_by_dominance,
      dominance_card,
      coalition_winners,
      played_at,
      season_label,
      season_number,
      venue,
      board_map,
      is_official,
      guest_participants
    ) VALUES (
      ${id},
      ${input.winner},
      ${JSON.stringify(input.participants)},
      ${JSON.stringify(input.participantFactions)},
      ${participantScores},
      ${participantDominances},
      ${vagabondCoalition},
      ${input.winningFaction},
      ${Boolean(input.wonByDominance)},
      ${input.dominanceCard ?? null},
      ${input.coalitionWinners?.length ? JSON.stringify(input.coalitionWinners) : null},
      ${input.playedAt},
      ${matchSeasonLabel},
      ${input.seasonNumber},
      ${input.venue},
      ${input.boardMap},
      ${Boolean(input.isOfficial)},
      ${JSON.stringify(input.guestParticipants)}
    );
  `;

  const winners = new Set(input.coalitionWinners ?? [input.winner]);
  const opponents = input.participants.filter((player) => !winners.has(player)).join(", ");
  const dominanceSuffix = input.wonByDominance && input.dominanceCard ? ` via dominância (${input.dominanceCard})` : "";
  const officialLabel = input.isOfficial ? "oficial" : "casual";
  await createLog(
    "CREATE_MATCH",
    input.actorName,
    `${input.winner} venceu com ${input.winningFaction}${dominanceSuffix} contra ${opponents} em ${input.playedAt} (${matchSeasonLabel}, ${input.venue === "online" ? "online" : "presencial"}, ${officialLabel})`
  );
}

export async function deleteMatch(id: string, actorName: string) {
  await ensureSchema();
  const sql = getSql();
  const matchResult = (await sql`
    SELECT winner, participants, participant_factions, winning_faction, coalition_winners, dominance_card, won_by_dominance, played_at, season_label
    FROM matches
    WHERE id = ${id}
    LIMIT 1;
  `) as Array<{
    winner: string;
    participants: string | string[];
    participant_factions: string | Record<string, string | null> | null;
    winning_faction: string;
    coalition_winners: string | string[] | null;
    dominance_card: string | null;
    won_by_dominance: boolean;
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
    const coalitionWinners =
      match.coalition_winners == null
        ? null
        : Array.isArray(match.coalition_winners)
        ? match.coalition_winners
        : (JSON.parse(match.coalition_winners) as string[]);
    const winners = new Set(coalitionWinners?.length ? coalitionWinners : [match.winner]);
    const opponents = participants.filter((player: string) => !winners.has(player)).join(", ");
    const dominanceSuffix = match.won_by_dominance && match.dominance_card ? ` via dominância (${match.dominance_card})` : "";
    await createLog(
      "DELETE_MATCH",
      actorName,
      `Registro apagado: ${match.winner} com ${match.winning_faction}${dominanceSuffix} contra ${opponents} em ${match.played_at} (${match.season_label})`
    );
  }
}

export async function listMemberNames(): Promise<string[]> {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT name
    FROM members
    ORDER BY name ASC;
  `) as Array<{ name: string }>;
  return result.map((row) => row.name);
}

export async function listMembers(): Promise<MemberRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT id, name, pin, is_admin, created_at
    FROM members
    ORDER BY name ASC;
  `) as Array<{
    id: string;
    name: string;
    pin: string;
    is_admin: boolean;
    created_at: string;
  }>;

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    pin: row.pin,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at
  }));
}

export async function findMemberByPin(pin: string): Promise<string | null> {
  if (!PIN_PATTERN.test(pin)) return null;
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT name
    FROM members
    WHERE pin = ${pin}
    LIMIT 1;
  `) as Array<{ name: string }>;
  return result[0]?.name ?? null;
}

export async function findMemberByName(name: string): Promise<{ name: string; isAdmin: boolean } | null> {
  await ensureSchema();
  const sql = getSql();
  const result = (await sql`
    SELECT name, is_admin
    FROM members
    WHERE name = ${name}
    LIMIT 1;
  `) as Array<{ name: string; is_admin: boolean }>;

  const row = result[0];
  if (!row) return null;
  return { name: row.name, isAdmin: Boolean(row.is_admin) };
}

export async function createMember(input: {
  name: string;
  actorName: string;
}): Promise<MemberRecord> {
  await ensureSchema();
  const sql = getSql();

  const trimmed = input.name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 24) {
    throw new Error("O nome precisa ter entre 2 e 24 caracteres.");
  }

  const existing = await findMemberByName(trimmed);
  if (existing) {
    throw new Error("Já existe um membro com esse nome.");
  }

  const existingPins = (await sql`
    SELECT pin FROM members;
  `) as Array<{ pin: string }>;
  const pin = generateUniquePin(new Set(existingPins.map((row) => row.pin)));
  const id = crypto.randomUUID();

  await sql`
    INSERT INTO members (id, name, pin, is_admin)
    VALUES (${id}, ${trimmed}, ${pin}, FALSE);
  `;

  await createLog("CREATE_MEMBER", input.actorName, `Membro permanente adicionado: ${trimmed}`);

  return {
    id,
    name: trimmed,
    pin,
    isAdmin: false,
    createdAt: new Date().toISOString()
  };
}

export async function getDashboardData(currentUser: string, isGuest = false): Promise<DashboardData> {
  const currentSeasonNumber = await getCurrentSeasonNumber();
  const matches = await listMatches();
  const logs = await listLogs();
  const players = await listMemberNames();
  const member = isGuest ? null : await findMemberByName(currentUser);

  return {
    matches,
    logs,
    players,
    seasons: [{ label: "All time", value: "all" }, ...listSeasonOptions()],
    meta: {
      currentSeasonNumber,
      currentSeasonLabel: seasonLabel(currentSeasonNumber),
      isGuest,
      currentUser,
      isAdmin: Boolean(member?.isAdmin)
    }
  };
}
