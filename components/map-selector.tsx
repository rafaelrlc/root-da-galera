"use client";

import {
  formatMatchMap,
  MATCH_MAPS,
  MATCH_MAP_META,
  type MatchMap
} from "@/lib/match-map";

export function MapBadge({ map }: { map: MatchMap }) {
  const meta = MATCH_MAP_META[map];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border-2 border-bark/10 bg-white/75 px-3 py-1 text-sm font-bold text-bark"
      title={meta.title}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-moss/10 text-lg leading-none">
        {meta.icon}
      </span>
      {formatMatchMap(map)}
    </span>
  );
}

export function MapSelector({
  value,
  onChange,
  compact = false
}: {
  value: MatchMap;
  onChange: (map: MatchMap) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap justify-end gap-2"}
      role="group"
      aria-label="Mapa da partida"
    >
      {MATCH_MAPS.map((map) => {
        const meta = MATCH_MAP_META[map];
        const selected = value === map;
        return (
          <button
            key={map}
            type="button"
            title={meta.title}
            onClick={() => onChange(map)}
            className={
              selected
                ? compact
                  ? "inline-flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-xl border-2 border-moss bg-moss/15 px-2 py-1.5 text-[10px] font-bold text-moss shadow-sm transition"
                  : "inline-flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl border-2 border-moss bg-moss/15 px-3 py-2 text-xs font-bold text-moss shadow-sm transition"
                : compact
                  ? "inline-flex min-w-[3.25rem] flex-col items-center gap-0.5 rounded-xl border-2 border-bark/10 bg-white/80 px-2 py-1.5 text-[10px] font-bold text-bark/60 transition hover:border-bark/25 hover:bg-white"
                  : "inline-flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl border-2 border-bark/10 bg-white/80 px-3 py-2 text-xs font-bold text-bark/60 transition hover:border-bark/25 hover:bg-white"
            }
          >
            <span className={compact ? "text-lg leading-none" : "text-2xl leading-none"} aria-hidden>
              {meta.icon}
            </span>
            <span className="leading-tight">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
