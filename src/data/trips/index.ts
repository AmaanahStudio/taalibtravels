import budgetNovember2026 from "./umrah-budget-november-2026.json";
import umrahSeptember2026 from "./umrah-september-2026.json";

/**
 * Register van alle reisbestanden — één reis per JSON-bestand hiernaast.
 *
 * Een reis toevoegen: bestand aanmaken, hier één import en één regel bijzetten.
 * De lijst staat bewust met de hand geschreven: `content.ts` wordt ook door een
 * client component ingeladen (de navbar), dus de map uitlezen met `fs` kan niet.
 *
 * De volgorde hier maakt niet uit; `content.ts` sorteert op `departureDate`.
 */
export const TRIP_FILES = [
  budgetNovember2026,
  umrahSeptember2026,
];
