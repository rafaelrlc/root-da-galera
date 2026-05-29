"use client";

import { DOMINANCE_CARDS, type DominanceCard } from "@/lib/constants";
import { DOMINANCE_CARD_PLACEHOLDERS } from "@/lib/dominance-icons";

type Props = {
  value: DominanceCard | null;
  availableCards: DominanceCard[];
  onChange: (card: DominanceCard | null) => void;
};

export function PlayerDominanceSelect({ value, availableCards, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {DOMINANCE_CARDS.map((card) => {
        const isAvailable = availableCards.includes(card);
        const selected = value === card;
        const placeholder = DOMINANCE_CARD_PLACEHOLDERS[card];

        if (!isAvailable && !selected) return null;

        return (
          <button
            key={card}
            type="button"
            title={placeholder.label}
            disabled={!isAvailable && !selected}
            onClick={() => onChange(selected ? null : card)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 text-base transition ${
              selected
                ? "border-moss bg-moss/15"
                : isAvailable
                ? "border-bark/10 bg-white/80 hover:border-moss/50"
                : "cursor-not-allowed opacity-30"
            }`}
          >
            {placeholder.emoji}
          </button>
        );
      })}
    </div>
  );
}
