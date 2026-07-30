/**
 * Thema-instellingen, gedeeld door de server (root layout) en de client
 * (ThemeToggle).
 *
 * Belangrijk: dit bestand heeft bewust géén "use client". Een constante die uit
 * een client-module komt, is aan serverzijde een verwijzing naar de client en
 * geen echte waarde — die zou dus onbruikbaar zijn in het init-script hieronder.
 */

export type Theme = "dark" | "light";

/** Sleutel waaronder de themakeuze in localStorage bewaard wordt. */
export const THEME_STORAGE_KEY = "taalibtravels-theme";

/** Donker is het uitgangspunt; licht is de bewuste keuze van de bezoeker. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * Wordt synchroon uitgevoerd terwijl de browser de HTML parseert, dus vóór de
 * eerste paint. Zonder dit ziet iemand die licht koos eerst een donkere flits.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})()`;
