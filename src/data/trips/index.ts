import budgetNovember2026 from "./umrah-budget-november-2026.json";
import comfortDecember2026 from "./umrah-comfort-december-2026.json";
import ramadan2027 from "./umrah-ramadan-2027.json";
import winterFebruari2027 from "./umrah-winter-februari-2027.json";

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
  comfortDecember2026,
  winterFebruari2027,
  ramadan2027,
];
