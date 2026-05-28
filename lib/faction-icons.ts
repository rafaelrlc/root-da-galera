import marquise from "@/lib/imgs/User attachment.png";
import corvid from "@/lib/imgs/corvid.png";
import duchy from "@/lib/imgs/dutchy.png";
import eyrie from "@/lib/imgs/eryie.png";
import keepers from "@/lib/imgs/keepersiniron.png";
import lizard from "@/lib/imgs/lizardcult.png";
import hundreds from "@/lib/imgs/lordofhundreds.png";
import riverfolk from "@/lib/imgs/riverfolk.png";
import vagabond from "@/lib/imgs/vagabond.png";
import woodland from "@/lib/imgs/woodland.png";
import type { StaticImageData } from "next/image";

export const FACTION_ICONS: Record<string, StaticImageData> = {
  "Marquise de Cat": marquise,
  "Eyrie Dynasties": eyrie,
  "Woodland Alliance": woodland,
  Vagabond: vagabond,
  "Riverfolk Company": riverfolk,
  "Lizard Cult": lizard,
  "Underground Duchy": duchy,
  "Corvid Conspiracy": corvid,
  "Keepers in Iron": keepers,
  "Lord of the Hundreds": hundreds
};
