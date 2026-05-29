"use client";

import { DOMINANCE_CARDS, type DominanceCard } from "@/lib/constants";
import { DOMINANCE_CARD_PLACEHOLDERS } from "@/lib/dominance-icons";

type Props = {
  value: DominanceCard | "";
  onChange: (card: DominanceCard) => void;
};

export function DominanceCardPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-bark/55">Carta de dominância</span>
      <div className="grid grid-cols-2 gap-2">
        {DOMINANCE_CARDS.map((card) => {
          const placeholder = DOMINANCE_CARD_PLACEHOLDERS[card];
          const selected = value === card;

          return (
            <button
              key={card}
              type="button"
              onClick={() => onChange(card)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 transition ${
                selected
                  ? "border-moss bg-moss/10 shadow-sm"
                  : "border-bark/10 bg-white/70 hover:border-moss/40"
              }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ${placeholder.accent}`}
                title="Placeholder — substitua pela imagem da carta"
              >
                {placeholder.emoji}
              </div>
              <span className="text-xs font-bold text-bark">{placeholder.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-bark/50">Imagens placeholder. Substitua em lib/dominance-icons.ts.</p>
    </div>
  );
}
