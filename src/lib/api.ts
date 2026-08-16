/**
 * Het contract tussen de statische pagina's en de Worker: welke paden er zijn en
 * hoe de antwoorden eruitzien. Zowel `worker/index.ts` als de client components
 * importeren dit, zodat een pad maar op één plek staat.
 *
 * Net als `leads.ts` gebruikt dit bestand een relatief pad in plaats van de
 * `@/*`-alias: esbuild bundelt de Worker zonder de aliassen uit tsconfig.json.
 */

import type { LeadFouten } from "./leads";

/**
 * Alles onder /api/ gaat naar de Worker; de rest van de site blijft statisch.
 * Dat onderscheid staat ook in wrangler.jsonc onder `run_worker_first`, dus
 * verplaats een route niet buiten dit voorvoegsel zonder die regel mee te nemen.
 */
export const API = {
  inschrijven: "/api/deelnemers",
  login: "/api/admin/login",
  logout: "/api/admin/logout",
  deelnemers: "/api/admin/deelnemers",
  export: "/api/admin/deelnemers.csv",
} as const;

/** Pad om één inschrijving te verwijderen. */
export function deelnemerPad(id: number): string {
  return `${API.deelnemers}/${id}`;
}

/** Eén rij zoals het admin-overzicht hem binnenkrijgt. */
export interface Deelnemer {
  id: number;
  voornaam: string;
  achternaam: string;
  email: string;
  /** `null` wanneer er geen nummer is achtergelaten. */
  telefoon: string | null;
  bron: string;
  /** ISO-8601 in UTC. */
  aangemaaktOp: string;
}

/**
 * Antwoord op een inschrijving. `fouten` staat er alleen bij een afgekeurde
 * invoer, zodat het formulier de melding onder het juiste veld kan zetten.
 */
export type InschrijfAntwoord =
  | { ok: true }
  | { ok: false; melding: string; fouten?: LeadFouten };

export interface DeelnemersAntwoord {
  deelnemers: Deelnemer[];
  totaal: number;
}
