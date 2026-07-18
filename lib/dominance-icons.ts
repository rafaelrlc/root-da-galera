import bird from "@/lib/imgs/bird.png";
import fox from "@/lib/imgs/fox.png";
import mouse from "@/lib/imgs/mouse.png";
import rabbit from "@/lib/imgs/rabbit.png";
import type { DominanceCard } from "@/lib/constants";
import type { StaticImageData } from "next/image";

export const DOMINANCE_ICONS: Record<DominanceCard, StaticImageData> = {
  Coelho: rabbit,
  Raposa: fox,
  Rato: mouse,
  Pássaro: bird
};

export const DOMINANCE_CARD_LABELS: Record<DominanceCard, string> = {
  Coelho: "Coelho",
  Raposa: "Raposa",
  Rato: "Rato",
  Pássaro: "Pássaro"
};
