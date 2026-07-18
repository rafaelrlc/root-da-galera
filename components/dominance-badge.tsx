import Image from "next/image";
import type { DominanceCard } from "@/lib/constants";
import { DOMINANCE_CARD_LABELS, DOMINANCE_ICONS } from "@/lib/dominance-icons";

export function DominanceBadge({
  card,
  size = "sm",
  showLabel = true
}: {
  card: DominanceCard;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const icon = DOMINANCE_ICONS[card];
  const label = DOMINANCE_CARD_LABELS[card];
  const px = size === "sm" ? 18 : 24;

  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-bark/70">
      <Image src={icon} alt={label} width={px} height={px} className="object-contain" />
      {showLabel ? label : null}
    </span>
  );
}
