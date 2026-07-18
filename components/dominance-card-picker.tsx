"use client";

import Image from "next/image";
import { DOMINANCE_CARDS, type DominanceCard } from "@/lib/constants";
import { DOMINANCE_CARD_LABELS, DOMINANCE_ICONS } from "@/lib/dominance-icons";

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
          const icon = DOMINANCE_ICONS[card];
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
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/90">
                <Image
                  src={icon}
                  alt={DOMINANCE_CARD_LABELS[card]}
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                />
              </div>
              <span className="text-xs font-bold text-bark">{DOMINANCE_CARD_LABELS[card]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
