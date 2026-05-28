import "server-only";

import { PLAYERS } from "@/lib/constants";

function getMemberPins() {
  const rawPins = process.env.MEMBER_PINS;

  if (!rawPins) {
    throw new Error("MEMBER_PINS não configurado.");
  }

  const parsedPins = JSON.parse(rawPins) as Record<string, string>;

  for (const player of PLAYERS) {
    const pin = parsedPins[player];

    if (!pin || !/^\d{4}$/.test(pin)) {
      throw new Error(`PIN inválido para ${player}.`);
    }
  }

  return parsedPins as Record<(typeof PLAYERS)[number], string>;
}

export const MEMBER_PINS = getMemberPins();
