import clsx from "clsx";
import Image from "next/image";
import { FACTION_STYLES } from "@/lib/constants";
import { FACTION_ICONS } from "@/lib/faction-icons";

export function FactionBadge({
  faction,
  iconOnly = false,
  selected = false,
  winner = false,
  size = "md"
}: {
  faction: string;
  iconOnly?: boolean;
  selected?: boolean;
  winner?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const style = FACTION_STYLES[faction as keyof typeof FACTION_STYLES];
  const icon = FACTION_ICONS[faction];
  const iconSize = size === "sm" ? 34 : size === "lg" ? 58 : 42;

  if (!style || !icon) {
    return <span className="leaf-chip">{faction}</span>;
  }

  const winnerStyles = winner
    ? "border-amber-400 bg-amber-50/90 shadow-[0_0_0_2px_rgba(251,191,36,0.45)]"
    : "";
  const selectedStyles = selected && !winner ? "border-moss bg-moss/10 shadow-md" : "";
  const defaultBorder = !winner && !selected ? "border-bark/10" : "";

  if (iconOnly) {
    return (
      <span
        title={faction}
        className={clsx(
          "inline-flex items-center justify-center rounded-[22px] border-2 bg-white/80 p-2 transition",
          winnerStyles,
          selectedStyles,
          defaultBorder
        )}
      >
        <Image src={icon} alt={faction} width={iconSize} height={iconSize} className="h-auto w-auto object-contain" />
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border-2 bg-white/75 px-3 py-1 text-sm font-bold text-bark",
        winnerStyles,
        selectedStyles,
        defaultBorder
      )}
    >
      <span className="inline-flex items-center justify-center rounded-full bg-white/90 p-1">
        <Image src={icon} alt={faction} width={24} height={24} className="h-6 w-6 object-contain" />
      </span>
      {faction}
    </span>
  );
}
