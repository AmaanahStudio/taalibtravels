/**
 * Instellingen voor de varianten die de scripts met sharp maken.
 *
 * De breedteladder zelf staat in `src/lib/foto-breedtes.ts` — die wordt ook door
 * de browser (het uploadformulier) en de Worker gelezen, en kan daarom geen
 * `.mjs` zijn. Hier wordt hij alleen doorgegeven, zodat de scripts één
 * importpad houden. Node laadt het `.ts`-bestand zelf via type stripping
 * (vandaar `engines: node >= 22.18`).
 */

export {
  ALL_WIDTHS,
  DEVICE_SIZES,
  IMAGE_SIZES,
  WEBP_QUALITY,
} from "../src/lib/foto-breedtes.ts";

/** Map waarin de gegenereerde varianten belanden, relatief aan `public/`. */
export const OUTPUT_DIR = "images/generated";
