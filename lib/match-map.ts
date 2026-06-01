export const MATCH_MAPS = ["floresta", "inverno", "lago", "montanha"] as const;

export type MatchMap = (typeof MATCH_MAPS)[number];

export type MatchMapFilter = "all" | MatchMap;

export const DEFAULT_MATCH_MAP: MatchMap = "floresta";

export const MATCH_MAP_META: Record<
  MatchMap,
  { label: string; icon: string; title: string }
> = {
  floresta: { label: "Floresta", icon: "🌲", title: "Mapa base" },
  inverno: { label: "Inverno", icon: "❄️", title: "Mapa de inverno" },
  lago: { label: "Lago", icon: "🌊", title: "Mapa do lago" },
  montanha: { label: "Montanha", icon: "⛰️", title: "Mapa da montanha" }
};

export function formatMatchMap(map: MatchMap): string {
  return MATCH_MAP_META[map].label;
}

export function isValidMatchMap(value: unknown): value is MatchMap {
  return typeof value === "string" && (MATCH_MAPS as readonly string[]).includes(value);
}

/** Partidas antigas ou sem mapa válido contam como floresta. */
export function normalizeMatchMap(value: unknown): MatchMap {
  return isValidMatchMap(value) ? value : DEFAULT_MATCH_MAP;
}

export function matchesMapFilter(match: { boardMap: MatchMap }, filter: MatchMapFilter): boolean {
  return filter === "all" || match.boardMap === filter;
}
