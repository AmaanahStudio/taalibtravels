/**
 * Het contract tussen de pagina's en de Worker: welke paden er zijn en
 * hoe de antwoorden eruitzien. Zowel `worker/index.ts` als de client components
 * importeren dit, zodat een pad maar op één plek staat.
 *
 * Net als `leads.ts` gebruikt dit bestand een relatief pad in plaats van de
 * `@/*`-alias: esbuild bundelt de Worker zonder de aliassen uit tsconfig.json.
 */

import type { LeadFouten } from "./leads";
import type { ReisFouten, ReisInvoer } from "./reizen";

/**
 * Alles onder /api/ handelt `worker/index.ts` zelf af; de rest gaat door naar
 * OpenNext. Dat onderscheid zit in de vroege `startsWith("/api/")`-controle daar,
 * dus verplaats een route niet buiten dit voorvoegsel zonder die mee te nemen.
 */
export const API = {
  inschrijven: "/api/deelnemers",
  login: "/api/admin/login",
  logout: "/api/admin/logout",
  deelnemers: "/api/admin/deelnemers",
  export: "/api/admin/deelnemers.csv",
  reizen: "/api/admin/reizen",
  afbeeldingen: "/api/admin/afbeeldingen",
  galerij: "/api/admin/galerij",
} as const;

/** Voorvoegsel waaronder de Worker foto's uit R2 serveert: `/media/<sleutel>`. */
export const MEDIA_PAD = "/media/";

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

/** Pad om één reis te lezen, bewerken of verwijderen. */
export function reisPad(slug: string): string {
  return `${API.reizen}/${encodeURIComponent(slug)}`;
}

/** Pad om één foto te verwijderen of van alt-tekst te wijzigen. */
export function afbeeldingPad(id: string): string {
  return `${API.afbeeldingen}/${encodeURIComponent(id)}`;
}

/** Eén reis zoals het portaal hem leest en schrijft; `updatedAt` is ISO-8601 in UTC. */
export type ReisRecord = ReisInvoer & { updatedAt: string };

/**
 * Antwoord op het aanmaken of wijzigen van een reis. `fouten` staat er alleen bij
 * afgekeurde invoer, zodat het formulier de melding onder het juiste veld zet.
 */
export type ReisAntwoord =
  | { ok: true; reis: ReisRecord }
  | { ok: false; melding: string; fouten?: ReisFouten };

export interface ReizenAntwoord {
  reizen: ReisRecord[];
}

/** Eén foto in de bibliotheek. `sleutel` is de R2-sleutel: de foto staat op `MEDIA_PAD + sleutel`. */
export interface AfbeeldingRecord {
  id: string;
  sleutel: string;
  alt: string;
  width: number;
  height: number;
}

/** Een foto in het overzicht, met de plekken (reizen en homepagegalerij) waar ze staat. */
export interface AfbeeldingMetGebruik extends AfbeeldingRecord {
  /** Aantal plekken: altijd `gebruikOp.length`. */
  gebruik: number;
  /** Leesbaar, bv. "Omslag van Umrah Budget (November 2026)" of "Homepagegalerij". */
  gebruikOp: string[];
}

export interface AfbeeldingenAntwoord {
  afbeeldingen: AfbeeldingMetGebruik[];
}

/** Antwoord op het uploaden of wijzigen van één foto. */
export type AfbeeldingAntwoord =
  | { ok: true; afbeelding: AfbeeldingRecord }
  | { ok: false; melding: string };

/** De gedeelde homepagegalerij: afbeelding-id's in volgorde. */
export interface GalerijAntwoord {
  galerij: string[];
}

/*
 * Grenzen van een upload. Formulier en Worker lezen ze hier allebei, zodat de
 * browser niets verstuurt wat de Worker toch weigert.
 */
export const UPLOAD = {
  /** Per WebP-variant. Samen blijft een upload zo ruim binnen de requestlimiet. */
  maxVariantBytes: 1024 * 1024,
  /**
   * De deel-JPEG van 1200px. Een foto van de site weegt 40–280 KB; ruime marge voor
   * een foto met veel fijne ruis.
   */
  maxOgBytes: 600 * 1024,
  maxAlt: 200,
  /** Breedte en hoogte van de bron, in pixels. */
  maxAfmeting: 10000,
} as const;

/** Naam van het formulierveld met de deel-JPEG. */
export const OG_VELD = "og";

/** Naam van het formulierveld met de variant van `breedte` pixels, bv. `v640`. */
export function variantVeld(breedte: number): string {
  return `v${breedte}`;
}
