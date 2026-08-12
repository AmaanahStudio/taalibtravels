import overOns from "./over-ons.json";
import umrah from "./umrah.json";

/**
 * Register van de losse tekstpagina's — één JSON-bestand per pagina hiernaast.
 *
 * Zelfde opzet en zelfde reden als `src/data/trips/index.ts`: `content.ts`
 * belandt via de navbar ook in de browserbundel, dus de map uitlezen met `fs`
 * kan niet. Een pagina toevoegen betekent hier één import en één regel erbij,
 * plus een route onder `src/app/`.
 */
export const PAGE_FILES = [umrah, overOns];
