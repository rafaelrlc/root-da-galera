export const MATCH_VENUES = ["online", "presencial"] as const;

export type MatchVenue = (typeof MATCH_VENUES)[number];

export type MatchVenueFilter = "all" | MatchVenue;

export const DEFAULT_MATCH_VENUE: MatchVenue = "online";

export function formatMatchVenue(venue: MatchVenue): string {
  return venue === "online" ? "Online" : "Presencial";
}

export function isValidMatchVenue(value: unknown): value is MatchVenue {
  return typeof value === "string" && (MATCH_VENUES as readonly string[]).includes(value);
}

/** Partidas antigas ou sem modalidade válida contam como online. */
export function normalizeMatchVenue(value: unknown): MatchVenue {
  return isValidMatchVenue(value) ? value : DEFAULT_MATCH_VENUE;
}

export function matchesVenueFilter(match: { venue: MatchVenue }, filter: MatchVenueFilter): boolean {
  return filter === "all" || match.venue === filter;
}
