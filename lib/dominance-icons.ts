import type { DominanceCard } from "@/lib/constants";

/** Placeholder até as imagens das cartas de dominância serem adicionadas. */
export const DOMINANCE_CARD_PLACEHOLDERS: Record<
  DominanceCard,
  { label: string; emoji: string; accent: string }
> = {
  Coelho: { label: "Coelho", emoji: "🐰", accent: "from-amber-100 to-amber-300" },
  Raposa: { label: "Raposa", emoji: "🦊", accent: "from-orange-100 to-orange-300" },
  Rato: { label: "Rato", emoji: "🐀", accent: "from-stone-100 to-stone-300" },
  Pássaro: { label: "Pássaro", emoji: "🐦", accent: "from-sky-100 to-sky-300" }
};
