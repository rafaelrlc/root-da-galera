export type MatchOfficialFilter = "all" | "official" | "casual";

/** Partidas antigas ou sem valor válido contam como oficiais. */
export const DEFAULT_MATCH_OFFICIAL = true;

export function formatMatchOfficial(isOfficial: boolean): string {
  return isOfficial ? "Oficial" : "Casual";
}

export function normalizeMatchOfficial(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return DEFAULT_MATCH_OFFICIAL;
}

export function matchesOfficialFilter(
  match: { isOfficial: boolean },
  filter: MatchOfficialFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "official") return match.isOfficial;
  return !match.isOfficial;
}
