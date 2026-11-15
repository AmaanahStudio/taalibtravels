/**
 * Lezen en schrijven van reizen in D1.
 *
 * Gedeeld door de Worker (beheer-API) en de Next-pagina's (via
 * `getCloudflareContext().env.DB`). Daarom, net als `leads.ts` en `api.ts`: geen
 * `@/*`-alias — esbuild bundelt de Worker zonder de aliassen uit tsconfig.json.
 *
 * De invoer is hier al door `valideerReis` gekeurd. Wat dit bestand zelf
 * controleert, is wat alleen de database kan weten: of de gekozen foto's bestaan.
 */

import { MEDIA_PAD, type ReisRecord } from "./api";
import type { InclusieInvoer, ReisFouten, ReisInvoer } from "./reizen";
import type { ImageAsset, Trip, TripAudience, TripStatus } from "./types";

/**
 * Het deel van D1 dat hier gebruikt wordt, structureel beschreven.
 *
 * Het globale `D1Database` komt uit `worker-configuration.d.ts`, en dat bestand
 * hoort bewust niet bij het Next-programma (geen workerd-globals naast de DOM).
 * Het echte `env.DB` past op deze vorm, dus beide programma's kunnen deze
 * functies aanroepen zonder een extra dependency.
 */
export interface D1Database {
  prepare(query: string): D1Statement;
}

interface D1Statement {
  bind(...waarden: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface LeesOpties {
  /** Ook reizen met status `draft`; alleen voor het beheer. */
  metConcepten?: boolean;
}

/**
 * Een schrijfactie die om inhoudelijke redenen niet doorgaat. De Worker zet
 * `status` en `fouten` om in een antwoord; elke andere fout is onverwacht.
 */
export class ReisSchrijfFout extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    melding: string,
    readonly fouten?: ReisFouten,
  ) {
    super(melding);
    this.name = "ReisSchrijfFout";
  }
}

/** Vorm van een rij uit `reizen`, met de kolomnamen van de database. */
interface ReisRij {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  departure_date: string;
  return_date: string;
  price_amount: number;
  price_installments: number;
  price_note: string | null;
  inclusions: string;
  cover_image: string;
  gallery: string | null;
  audience: TripAudience;
  status: TripStatus;
  spots_total: number | null;
  spots_left: number | null;
  updated_at: string;
}

interface AfbeeldingRij {
  id: string;
  r2_sleutel: string;
  alt: string;
  width: number;
  height: number;
}

/** Alles behalve `slug`, die na aanmaken vastligt. */
const SCHRIJF_KOLOMMEN = [
  "title",
  "subtitle",
  "summary",
  "description",
  "departure_date",
  "return_date",
  "price_amount",
  "price_installments",
  "price_note",
  "inclusions",
  "cover_image",
  "gallery",
  "audience",
  "status",
  "spots_total",
  "spots_left",
  "updated_at",
] as const;

const REIS_KOLOMMEN = ["slug", ...SCHRIJF_KOLOMMEN].join(", ");

const AFBEELDING_KOLOMMEN = "id, r2_sleutel, alt, width, height";

/* -------------------------------------------------------------------------- */
/* Lezen                                                                      */
/* -------------------------------------------------------------------------- */

/** Alle reizen als records, zoals het beheer ze bewerkt — concepten inbegrepen. */
export async function leesReisRecords(db: D1Database): Promise<ReisRecord[]> {
  return (await leesRijen(db, true)).map(naarRecord);
}

/** Eén reis als record, ongeacht de status; `null` als de slug niet bestaat. */
export async function leesReisRecord(db: D1Database, slug: string): Promise<ReisRecord | null> {
  const rij = await leesRij(db, slug);
  return rij ? naarRecord(rij) : null;
}

/** Reizen voor de pagina's, op vertrekdatum, met de foto's uitgepakt. */
export async function leesReizen(db: D1Database, opts: LeesOpties = {}): Promise<Trip[]> {
  const rijen = await leesRijen(db, opts.metConcepten === true);
  if (rijen.length === 0) return [];

  // Alleen de gedeelde galerij ophalen als een reis hem echt gebruikt.
  const [fotos, gedeeld] = await Promise.all([
    leesAfbeeldingen(db, rijen.flatMap(afbeeldingIds)),
    rijen.some((rij) => rij.gallery === null) ? leesGalerij(db) : Promise.resolve([]),
  ]);
  return rijen.map((rij) => naarTrip(rij, fotos, gedeeld));
}

/** Eén reis voor de detailpagina; een concept alleen met `metConcepten`. */
export async function leesReis(
  db: D1Database,
  slug: string,
  opts: LeesOpties = {},
): Promise<Trip | null> {
  const rij = await leesRij(db, slug);
  if (!rij || (rij.status === "draft" && opts.metConcepten !== true)) return null;

  const [fotos, gedeeld] = await Promise.all([
    leesAfbeeldingen(db, afbeeldingIds(rij)),
    rij.gallery === null ? leesGalerij(db) : Promise.resolve([]),
  ]);
  return naarTrip(rij, fotos, gedeeld);
}

/** De gedeelde homepagegalerij, in volgorde van positie. */
export async function leesGalerij(db: D1Database): Promise<ImageAsset[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.r2_sleutel, a.alt, a.width, a.height
         FROM galerij g JOIN afbeeldingen a ON a.id = g.afbeelding_id
        ORDER BY g.positie`,
    )
    .all<AfbeeldingRij>();
  return results.map(naarAsset);
}

/* -------------------------------------------------------------------------- */
/* Schrijven                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Schrijft een gevalideerde reis weg en zet `updated_at` op `nu`.
 *
 * - `aanmaken`: faalt met 409 als de slug al bestaat.
 * - `bijwerken`: faalt met 404 als de slug niet bestaat. De slug zelf wijzigt
 *   nooit: hij is de URL, en een gedeelde link mag niet breken.
 *
 * Bestaan of niet bestaan volgt uit de wijzigingsteller van één statement, niet
 * uit een losse SELECT vooraf: dan kunnen twee gelijktijdige verzoeken elkaar
 * niet ongemerkt overschrijven.
 */
export async function schrijfReis(
  db: D1Database,
  reis: ReisInvoer,
  nu: string,
  modus: "aanmaken" | "bijwerken",
): Promise<void> {
  await controleerAfbeeldingen(db, reis);

  // Zelfde volgorde als SCHRIJF_KOLOMMEN.
  const waarden = [
    reis.title,
    reis.subtitle,
    reis.summary,
    JSON.stringify(reis.description),
    reis.departureDate,
    reis.returnDate,
    reis.price.amount,
    reis.price.installmentsAvailable ? 1 : 0,
    reis.price.note ?? null,
    JSON.stringify(reis.inclusions),
    reis.coverImage,
    reis.gallery ? JSON.stringify(reis.gallery) : null,
    reis.audience,
    reis.status,
    reis.spotsTotal ?? null,
    reis.spotsLeft ?? null,
    nu,
  ];

  const statement =
    modus === "aanmaken"
      ? db
          .prepare(
            `INSERT INTO reizen (slug, ${SCHRIJF_KOLOMMEN.join(", ")})
             VALUES (?, ${SCHRIJF_KOLOMMEN.map(() => "?").join(", ")})
             ON CONFLICT (slug) DO NOTHING`,
          )
          .bind(reis.slug, ...waarden)
      : db
          .prepare(
            `UPDATE reizen SET ${SCHRIJF_KOLOMMEN.map((k) => `${k} = ?`).join(", ")}
              WHERE slug = ?`,
          )
          .bind(...waarden, reis.slug);

  const uitkomst = await statement.run();

  if (uitkomst.meta.changes === 0) {
    if (modus === "aanmaken") {
      throw new ReisSchrijfFout(409, "Er bestaat al een reis met deze slug.", {
        slug: "Deze slug is al in gebruik.",
      });
    }
    throw new ReisSchrijfFout(404, "Deze reis bestaat niet.");
  }
}

/** `true` als er een reis verwijderd is, `false` als de slug niet bestond. */
export async function verwijderReis(db: D1Database, slug: string): Promise<boolean> {
  const uitkomst = await db.prepare("DELETE FROM reizen WHERE slug = ?").bind(slug).run();
  return uitkomst.meta.changes > 0;
}

/* -------------------------------------------------------------------------- */
/* Hulpjes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Bestaan de omslagfoto en de galerijfoto's? Expliciet nagekeken in plaats van
 * de foreign key te laten falen: dan krijgt het formulier een melding onder het
 * juiste veld, niet een D1-foutmelding (waarvan de tekst bovendien kan wijzigen).
 */
async function controleerAfbeeldingen(db: D1Database, reis: ReisInvoer): Promise<void> {
  const bestaand = await leesAfbeeldingen(db, [reis.coverImage, ...(reis.gallery ?? [])]);
  const fouten: ReisFouten = {};

  if (!bestaand.has(reis.coverImage)) {
    fouten.coverImage = "Deze foto bestaat niet (meer) in de bibliotheek.";
  }
  if (reis.gallery?.some((id) => !bestaand.has(id))) {
    fouten.gallery = "Een of meer foto's bestaan niet (meer) in de bibliotheek.";
  }

  if (Object.keys(fouten).length > 0) {
    throw new ReisSchrijfFout(400, "Controleer de gemarkeerde velden.", fouten);
  }
}

async function leesRijen(db: D1Database, metConcepten: boolean): Promise<ReisRij[]> {
  const filter = metConcepten ? "" : "WHERE status <> 'draft'";
  const { results } = await db
    .prepare(`SELECT ${REIS_KOLOMMEN} FROM reizen ${filter} ORDER BY departure_date, slug`)
    .all<ReisRij>();
  return results;
}

async function leesRij(db: D1Database, slug: string): Promise<ReisRij | null> {
  return db.prepare(`SELECT ${REIS_KOLOMMEN} FROM reizen WHERE slug = ?`).bind(slug).first<ReisRij>();
}

/**
 * Foto's op id, in één query. De id's gaan als één JSON-array mee in plaats van
 * een `IN (?, ?, …)` per id: D1 staat maar 100 gebonden parameters per query toe,
 * en een overzicht met veel reizen zou die grens halen.
 */
async function leesAfbeeldingen(db: D1Database, ids: string[]): Promise<Map<string, AfbeeldingRij>> {
  const uniek = [...new Set(ids)];
  if (uniek.length === 0) return new Map();
  const { results } = await db
    .prepare(
      `SELECT ${AFBEELDING_KOLOMMEN} FROM afbeeldingen
        WHERE id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(uniek))
    .all<AfbeeldingRij>();
  return new Map(results.map((rij) => [rij.id, rij]));
}

function afbeeldingIds(rij: ReisRij): string[] {
  return [rij.cover_image, ...(rij.gallery ? (JSON.parse(rij.gallery) as string[]) : [])];
}

function naarRecord(rij: ReisRij): ReisRecord {
  return {
    slug: rij.slug,
    title: rij.title,
    subtitle: rij.subtitle,
    summary: rij.summary,
    description: JSON.parse(rij.description) as string[],
    departureDate: rij.departure_date,
    returnDate: rij.return_date,
    price: {
      amount: rij.price_amount,
      installmentsAvailable: rij.price_installments === 1,
      ...(rij.price_note !== null ? { note: rij.price_note } : {}),
    },
    inclusions: JSON.parse(rij.inclusions) as InclusieInvoer[],
    coverImage: rij.cover_image,
    gallery: rij.gallery ? (JSON.parse(rij.gallery) as string[]) : null,
    audience: rij.audience,
    status: rij.status,
    ...(rij.spots_total !== null ? { spotsTotal: rij.spots_total } : {}),
    ...(rij.spots_left !== null ? { spotsLeft: rij.spots_left } : {}),
    updatedAt: rij.updated_at,
  };
}

function naarTrip(rij: ReisRij, fotos: Map<string, AfbeeldingRij>, gedeeld: ImageAsset[]): Trip {
  const record = naarRecord(rij);

  /*
   * Een ontbrekende foto zou een stille lege plek op de pagina zijn. Dat kan
   * alleen als de verwijzing buiten het beheer om gebroken is — het verwijderen
   * van een foto in gebruik wordt geweigerd — dus hard falen, zoals
   * `resolveImage` dat bij de JSON-content deed.
   */
  const foto = (id: string): ImageAsset => {
    const rijFoto = fotos.get(id);
    if (!rijFoto) throw new Error(`Reis "${rij.slug}" verwijst naar onbekende foto "${id}".`);
    return naarAsset(rijFoto);
  };

  return {
    slug: record.slug,
    title: record.title,
    subtitle: record.subtitle,
    summary: record.summary,
    description: record.description,
    departureDate: record.departureDate,
    returnDate: record.returnDate,
    price: { ...record.price, currency: "EUR" },
    // De inclusies hebben per reis geen eigen id meer; de positie is uniek genoeg als sleutel.
    inclusions: record.inclusions.map((inclusie, i) => ({ id: String(i), ...inclusie })),
    coverImage: foto(record.coverImage),
    gallery: record.gallery ? record.gallery.map(foto) : gedeeld,
    audience: record.audience,
    status: record.status,
    ...(record.spotsTotal !== undefined ? { spotsTotal: record.spotsTotal } : {}),
    ...(record.spotsLeft !== undefined ? { spotsLeft: record.spotsLeft } : {}),
    updatedAt: record.updatedAt,
  };
}

/** Basisvorm zonder breedte; de image-loader plakt er `/<breedte>.webp` achter. */
function naarAsset(rij: AfbeeldingRij): ImageAsset {
  return { src: MEDIA_PAD + rij.r2_sleutel, alt: rij.alt, width: rij.width, height: rij.height };
}
