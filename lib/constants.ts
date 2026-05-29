export const PLAYERS = [
  "Rafinha",
  "Reels",
  "Papito",
  "Filipão",
  "Kleber",
  "Isaac",
  "Varanda",
  "Guedes"
] as const;

export const FACTIONS = [
  "Marquise de Cat",
  "Eyrie Dynasties",
  "Woodland Alliance",
  "Vagabond",
  "Riverfolk Company",
  "Lizard Cult",
  "Underground Duchy",
  "Corvid Conspiracy",
  "Keepers in Iron",
  "Lord of the Hundreds"
] as const;

export const FACTION_STYLES: Record<(typeof FACTIONS)[number], { bg: string; accent: string; short: string }> = {
  "Marquise de Cat": { bg: "from-orange-300 to-orange-500", accent: "bg-orange-500", short: "MC" },
  "Eyrie Dynasties": { bg: "from-sky-300 to-blue-500", accent: "bg-blue-500", short: "ED" },
  "Woodland Alliance": { bg: "from-green-300 to-emerald-500", accent: "bg-emerald-500", short: "WA" },
  Vagabond: { bg: "from-stone-200 to-stone-500", accent: "bg-stone-500", short: "VB" },
  "Riverfolk Company": { bg: "from-rose-300 to-rose-500", accent: "bg-rose-500", short: "RC" },
  "Lizard Cult": { bg: "from-yellow-200 to-yellow-400", accent: "bg-yellow-400", short: "LC" },
  "Underground Duchy": { bg: "from-fuchsia-200 to-purple-500", accent: "bg-purple-500", short: "UD" },
  "Corvid Conspiracy": { bg: "from-zinc-400 to-zinc-700", accent: "bg-zinc-700", short: "CC" },
  "Keepers in Iron": { bg: "from-neutral-200 to-neutral-500", accent: "bg-neutral-500", short: "KI" },
  "Lord of the Hundreds": { bg: "from-cyan-200 to-cyan-500", accent: "bg-cyan-500", short: "LH" }
};

export const FACTION_FILTERS = ["all", ...FACTIONS] as const;

export const DOMINANCE_CARDS = ["Coelho", "Raposa", "Rato", "Pássaro"] as const;
export type DominanceCard = (typeof DOMINANCE_CARDS)[number];
