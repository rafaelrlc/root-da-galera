import type { DominanceCard } from "@/lib/constants";
import type { MatchMap } from "@/lib/match-map";
import type { MatchVenue } from "@/lib/match-venue";

export type VagabondCoalition = {
  vagabond: string;
  partner: string;
  faction: string;
};

export type MatchRecord = {
  id: string;
  winner: string;
  participants: string[];
  participantFactions: Record<string, string | null>;
  participantScores: Record<string, number> | null;
  participantDominances: Record<string, DominanceCard> | null;
  winningFaction: string;
  wonByDominance: boolean;
  dominanceCard: DominanceCard | null;
  vagabondCoalition: VagabondCoalition | null;
  coalitionWinners: string[] | null;
  playedAt: string;
  seasonLabel: string;
  seasonNumber: number;
  venue: MatchVenue;
  boardMap: MatchMap;
  guestParticipants: string[];
  createdAt: string;
};

export type SeasonOption = {
  label: string;
  value: string;
};

export type ActivityLog = {
  id: string;
  action: "CREATE_MATCH" | "DELETE_MATCH";
  actorName: string;
  message: string;
  createdAt: string;
};

export type DashboardData = {
  matches: MatchRecord[];
  logs: ActivityLog[];
  seasons: SeasonOption[];
  meta: {
    currentSeasonNumber: number;
    currentSeasonLabel: string;
    currentUser: string;
    isGuest: boolean;
  };
};
