export type DraftFactionId = string;

export type DraftExpansionId = "base" | "riverfolk" | "underworld" | "marauder" | "hirelings";

export type VagabondRole = "Tinker" | "Arbiter" | "Thief" | "Scoundrel" | "Ranger" | "Vagrant";

export const VAGABOND_ROLES: VagabondRole[] = [
  "Tinker",
  "Arbiter",
  "Thief",
  "Scoundrel",
  "Ranger",
  "Vagrant"
];

export const DRAFT_EXPANSIONS: Record<
  DraftExpansionId,
  { label: string; factions: DraftFactionId[]; required?: boolean }
> = {
  base: {
    label: "Jogo base",
    factions: ["Marquise de Cat", "Eyrie Dynasties", "Woodland Alliance", "Vagabond"],
    required: true
  },
  riverfolk: {
    label: "Riverfolk",
    factions: ["Riverfolk Company"]
  },
  underworld: {
    label: "Underworld",
    factions: ["Corvid Conspiracy", "Lizard Cult", "Underground Duchy"]
  },
  marauder: {
    label: "Marauder",
    factions: ["Lord of the Hundreds", "Keepers in Iron"]
  },
  hirelings: {
    label: "Hirelings & More",
    factions: ["Lilypad Diaspora", "Knaves of the Deepwood", "Twilight Council"]
  }
};

export const MILITANT_FACTIONS: DraftFactionId[] = [
  "Marquise de Cat",
  "Lord of the Hundreds",
  "Keepers in Iron",
  "Underground Duchy",
  "Lilypad Diaspora",
  "Eyrie Dynasties"
];

export const INSURGENT_FACTIONS: DraftFactionId[] = [
  "Vagabond",
  "Riverfolk Company",
  "Knaves of the Deepwood",
  "Twilight Council",
  "Woodland Alliance",
  "Corvid Conspiracy",
  "Lizard Cult"
];

export const FACTION_REACH: Record<DraftFactionId, number> = {
  "Marquise de Cat": 10,
  "Lord of the Hundreds": 9,
  "Keepers in Iron": 8,
  "Underground Duchy": 8,
  "Lilypad Diaspora": 7,
  "Eyrie Dynasties": 7,
  Vagabond: 5,
  "Riverfolk Company": 5,
  "Knaves of the Deepwood": 4,
  "Twilight Council": 4,
  "Woodland Alliance": 3,
  "Corvid Conspiracy": 3,
  "Lizard Cult": 2
};

export const MIN_REACH_BY_PLAYERS: Record<number, number> = {
  3: 18,
  4: 21,
  5: 25,
  6: 28
};

export type DraftPoolEntry = {
  id: string;
  faction: DraftFactionId;
  locked: boolean;
  vagabondOptions: [VagabondRole, VagabondRole] | null;
};

export type DraftPick = {
  faction: DraftFactionId;
  vagabondRole: VagabondRole | null;
};

export type DraftSession = {
  playerCount: number;
  turnOrder: string[];
  draftOrder: string[];
  pool: DraftPoolEntry[];
  picks: Record<string, DraftPick>;
  currentPickIndex: number;
  militantPicked: boolean;
  lockedFaction: DraftFactionId | null;
  discardedFaction: DraftFactionId | null;
  phase: "setup" | "order" | "drafting" | "complete";
  pendingVagabond: { player: string; entryId: string; options: [VagabondRole, VagabondRole] } | null;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickTwoVagabondRoles(): [VagabondRole, VagabondRole] {
  const shuffled = shuffle(VAGABOND_ROLES);
  return [shuffled[0], shuffled[1]];
}

export function isMilitant(faction: DraftFactionId): boolean {
  return MILITANT_FACTIONS.includes(faction);
}

export function isInsurgent(faction: DraftFactionId): boolean {
  return INSURGENT_FACTIONS.includes(faction);
}

export function getFactionReach(faction: DraftFactionId): number {
  return FACTION_REACH[faction] ?? 0;
}

export function getMinReach(playerCount: number): number {
  return MIN_REACH_BY_PLAYERS[playerCount] ?? 0;
}

export function getAvailableFactions(enabledExpansions: DraftExpansionId[]): DraftFactionId[] {
  const factions = new Set<DraftFactionId>();
  for (const expansion of enabledExpansions) {
    for (const faction of DRAFT_EXPANSIONS[expansion].factions) {
      factions.add(faction);
    }
  }
  return [...factions];
}

export function splitFactionsByRole(factions: DraftFactionId[]) {
  const militants = factions.filter(isMilitant);
  const insurgents = factions.filter(isInsurgent);
  return { militants, insurgents };
}

function maxReachFromPool(factions: DraftFactionId[], pickCount: number): number {
  return [...factions]
    .map(getFactionReach)
    .sort((left, right) => right - left)
    .slice(0, pickCount)
    .reduce((total, reach) => total + reach, 0);
}

function createPoolEntry(faction: DraftFactionId, locked = false): DraftPoolEntry {
  return {
    id: crypto.randomUUID(),
    faction,
    locked,
    vagabondOptions: faction === "Vagabond" ? pickTwoVagabondRoles() : null
  };
}

export function generateDraftPool(
  playerCount: number,
  enabledExpansions: DraftExpansionId[],
  maxAttempts = 30
): { pool: DraftPoolEntry[]; lockedFaction: DraftFactionId | null } {
  const poolSize = playerCount + 1;
  const available = getAvailableFactions(enabledExpansions);
  const { militants, insurgents } = splitFactionsByRole(available);
  const minReach = getMinReach(playerCount);

  if (militants.length === 0) {
    throw new Error("É necessário pelo menos uma facção militante disponível.");
  }

  if (poolSize > available.length) {
    throw new Error("Expansões selecionadas não têm facções suficientes para este número de jogadores.");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pool: DraftPoolEntry[] = [];
    const firstMilitant = randomPick(militants);
    pool.push(createPoolEntry(firstMilitant));

    const remainingMilitants = militants.filter((faction) => faction !== firstMilitant);
    const candidates = shuffle([...remainingMilitants, ...insurgents]).slice(0, poolSize - 1);
    for (const faction of candidates) {
      pool.push(createPoolEntry(faction));
    }

    const lastEntry = pool[pool.length - 1];
    let lockedFaction: DraftFactionId | null = null;
    if (isInsurgent(lastEntry.faction)) {
      lastEntry.locked = true;
      lockedFaction = lastEntry.faction;
    }

    const poolFactions = pool.map((entry) => entry.faction);
    if (maxReachFromPool(poolFactions, playerCount) >= minReach) {
      return { pool, lockedFaction };
    }
  }

  const pool: DraftPoolEntry[] = [];
  const sortedMilitants = [...militants].sort(
    (left, right) => getFactionReach(right) - getFactionReach(left)
  );
  const sortedInsurgents = [...insurgents].sort(
    (left, right) => getFactionReach(right) - getFactionReach(left)
  );

  pool.push(createPoolEntry(sortedMilitants[0]));
  const filler = shuffle([
    ...sortedMilitants.slice(1),
    ...sortedInsurgents
  ]).slice(0, poolSize - 1);

  for (const faction of filler) {
    pool.push(createPoolEntry(faction));
  }

  const lastEntry = pool[pool.length - 1];
  let lockedFaction: DraftFactionId | null = null;
  if (isInsurgent(lastEntry.faction)) {
    lastEntry.locked = true;
    lockedFaction = lastEntry.faction;
  }

  return { pool, lockedFaction };
}

export function createTurnOrder(players: string[]): string[] {
  return shuffle([...players]);
}

export function createDraftOrder(turnOrder: string[]): string[] {
  return [...turnOrder].reverse();
}

export function calculatePickedReach(picks: Record<string, DraftPick>): number {
  return Object.values(picks).reduce((total, pick) => total + getFactionReach(pick.faction), 0);
}

export function getCurrentPicker(session: DraftSession): string | null {
  if (session.phase !== "drafting") return null;
  return session.draftOrder[session.currentPickIndex] ?? null;
}

export function getRemainingPool(session: DraftSession): DraftPoolEntry[] {
  const pickedFactions = new Set(Object.values(session.picks).map((pick) => pick.faction));
  return session.pool.filter((entry) => !pickedFactions.has(entry.faction));
}

export function canPickFaction(session: DraftSession, entry: DraftPoolEntry): boolean {
  const picker = getCurrentPicker(session);
  if (!picker || session.pendingVagabond) return false;

  const remaining = getRemainingPool(session);
  if (!remaining.some((poolEntry) => poolEntry.id === entry.id)) return false;

  if (entry.locked && !session.militantPicked) return false;

  const isLastPicker = session.currentPickIndex === session.draftOrder.length - 1;
  if (isLastPicker && remaining.length !== 2) return false;

  return true;
}

export function startDraftSession(
  players: string[],
  enabledExpansions: DraftExpansionId[]
): DraftSession {
  const turnOrder = createTurnOrder(players);
  const draftOrder = createDraftOrder(turnOrder);
  const { pool, lockedFaction } = generateDraftPool(players.length, enabledExpansions);

  return {
    playerCount: players.length,
    turnOrder,
    draftOrder,
    pool,
    picks: {},
    currentPickIndex: 0,
    militantPicked: false,
    lockedFaction,
    discardedFaction: null,
    phase: "order",
    pendingVagabond: null
  };
}

export function beginDrafting(session: DraftSession): DraftSession {
  return { ...session, phase: "drafting" };
}

export function selectFaction(session: DraftSession, entryId: string): DraftSession {
  const picker = getCurrentPicker(session);
  if (!picker) return session;

  const entry = session.pool.find((poolEntry) => poolEntry.id === entryId);
  if (!entry || !canPickFaction(session, entry)) return session;

  if (entry.faction === "Vagabond" && entry.vagabondOptions) {
    return {
      ...session,
      pendingVagabond: {
        player: picker,
        entryId: entry.id,
        options: entry.vagabondOptions
      }
    };
  }

  return finalizePick(session, picker, entry.faction, null);
}

export function selectVagabondRole(session: DraftSession, role: VagabondRole): DraftSession {
  if (!session.pendingVagabond) return session;
  return finalizePick(session, session.pendingVagabond.player, "Vagabond", role);
}

function finalizePick(
  session: DraftSession,
  player: string,
  faction: DraftFactionId,
  vagabondRole: VagabondRole | null
): DraftSession {
  const militantPicked = session.militantPicked || isMilitant(faction);
  const picks = {
    ...session.picks,
    [player]: { faction, vagabondRole }
  };

  const nextPickIndex = session.currentPickIndex + 1;
  const isComplete = nextPickIndex >= session.draftOrder.length;

  if (!isComplete) {
    const updatedPool = session.pool.map((entry) =>
      entry.locked && militantPicked ? { ...entry, locked: false } : entry
    );

    return {
      ...session,
      pool: updatedPool,
      picks,
      currentPickIndex: nextPickIndex,
      militantPicked,
      lockedFaction: militantPicked ? null : session.lockedFaction,
      pendingVagabond: null
    };
  }

  const remaining = session.pool
    .map((entry) => entry.faction)
    .filter((poolFaction) => !Object.values(picks).some((pick) => pick.faction === poolFaction));

  return {
    ...session,
    picks,
    currentPickIndex: nextPickIndex,
    militantPicked,
    lockedFaction: null,
    discardedFaction: remaining[0] ?? null,
    pendingVagabond: null,
    phase: "complete"
  };
}

export function resetDraftSession(): DraftSession {
  return {
    playerCount: 0,
    turnOrder: [],
    draftOrder: [],
    pool: [],
    picks: {},
    currentPickIndex: 0,
    militantPicked: false,
    lockedFaction: null,
    discardedFaction: null,
    phase: "setup",
    pendingVagabond: null
  };
}
