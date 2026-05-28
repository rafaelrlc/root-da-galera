import clsx from "clsx";
import Image from "next/image";
import { FACTION_STYLES } from "@/lib/constants";
import { FACTION_ICONS } from "@/lib/faction-icons";

export function FactionBadge({
  faction,
  iconOnly = false,
  selected = false,
  size = "md"
}: {
  faction: string;
  iconOnly?: boolean;
  selected?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const style = FACTION_STYLES[faction as keyof typeof FACTION_STYLES];
  const icon = FACTION_ICONS[faction];
  const iconSize = size === "sm" ? 34 : size === "lg" ? 58 : 42;

  if (!style || !icon) {
    return <span className="leaf-chip">{faction}</span>;
  }

  if (iconOnly) {
    return (
      <span
        title={faction}
        className={clsx(
          "inline-flex items-center justify-center rounded-[22px] border-2 bg-white/80 p-2 transition",
          selected ? "border-moss bg-moss/10 shadow-md" : "border-bark/10"
        )}
      >
        <Image src={icon} alt={faction} width={iconSize} height={iconSize} className="h-auto w-auto object-contain" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border-2 border-bark/10 bg-white/75 px-3 py-1 text-sm font-bold text-bark">
      <span className="inline-flex items-center justify-center rounded-full bg-white/90 p-1">
        <Image src={icon} alt={faction} width={24} height={24} className="h-6 w-6 object-contain" />
      </span>
      {faction}
    </span>
  );
}
