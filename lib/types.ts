export type MatchRecord = {
  id: string;
  winner: string;
  participants: string[];
  participantFactions: Record<string, string | null>;
  winningFaction: string;
  playedAt: string;
  seasonLabel: string;
  seasonNumber: number;
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
  };
};
