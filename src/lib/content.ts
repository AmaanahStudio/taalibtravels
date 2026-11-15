import faqJson from "@/data/faq.json";
import giveawayJson from "@/data/giveaway.json";
import navigationJson from "@/data/navigation.json";
import privacyJson from "@/data/privacy.json";
import siteJson from "@/data/site.json";
import type {
  FaqItem,
  GiveawayContent,
  NavLink,
  PrivacyContent,
  SiteConfig,
} from "@/lib/types";

/**
 * De vaste content van de site: bedrijfsgegevens, navigatie, FAQ, giveaway en
 * privacy. Dat staat als JSON in `src/data` en wordt bij het bouwen meegebundeld.
 *
 * Reizen en foto's staan hier bewust níét meer: die komen per verzoek uit D1,
 * via `src/lib/trips.ts`. Dit bestand belandt via de navbar (en `utils.ts`) in de
 * browserbundel; met de D1-lezers erin zou die bundel servercode meeslepen.
 * Houd dit bestand dus synchroon en zonder imports buiten `src/data`.
 *
 * Content aanpassen? Bewerk de JSON-bestanden — hier hoeft niets te wijzigen.
 */

export const SITE = siteJson as SiteConfig;
export const NAV_LINKS = navigationJson as NavLink[];
export const FAQ = faqJson as FaqItem[];
export const GIVEAWAY = giveawayJson as GiveawayContent;
export const PRIVACY = privacyJson as PrivacyContent;

/**
 * Turnstile's publieke testsleutel: die laat élke inzending door, ook die van
 * bots. Handig lokaal, rampzalig in productie — vandaar dat de giveaway-pagina
 * zichtbaar waarschuwt zolang deze waarde in `giveaway.json` staat.
 */
export const TURNSTILE_TESTSLEUTEL = "1x00000000000000000000AA";
