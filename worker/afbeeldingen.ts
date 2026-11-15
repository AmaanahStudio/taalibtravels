/**
 * Beheer van de fotobibliotheek en de homepagegalerij.
 *
 * `index.ts` roept dit pas aan ná de sessiecontrole: alles hieronder gaat ervan
 * uit dat de beheerder ingelogd is. Wat schrijft, controleert daarnaast zelf de
 * Origin.
 *
 * De bestanden staan in R2 onder `fotos/<id>/<breedte>.webp`, plus `fotos/<id>/og.jpg`
 * als JPEG-deelafbeelding voor linkvoorbeelden. D1 bewaart de
 * beschrijving en in `r2_sleutel` het voorvoegsel `fotos/<id>`. De id maakt de
 * Worker zelf aan; niets wat de browser stuurt, wordt ooit een R2-sleutel.
 */

import {
  API,
  OG_VELD,
  UPLOAD,
  variantVeld,
  type AfbeeldingAntwoord,
  type AfbeeldingMetGebruik,
  type AfbeeldingRecord,
  type AfbeeldingenAntwoord,
  type GalerijAntwoord,
} from "../src/lib/api";
import { json, leesJson, methodeNietToegestaan, vanEigenOriginStrikt } from "./http";
import { GALERIJ_AANTAL } from "../src/lib/reizen";
import { ALL_WIDTHS } from "../src/lib/foto-breedtes";

/** Bovengrens op het overzicht, zodat één verzoek nooit de hele tabel trekt. */
const OVERZICHT_LIMIET = 2000;

const OG_BESTAND = "og.jpg";

/** Ruimte voor de multipart-grenzen en de tekstvelden naast de bestanden. */
const MULTIPART_MARGE = 64 * 1024;
const MAX_UPLOAD_BYTES =
  ALL_WIDTHS.length * UPLOAD.maxVariantBytes + UPLOAD.maxOgBytes + MULTIPART_MARGE;

const TOEGESTANE_VELDEN = new Set([
  "alt",
  "width",
  "height",
  OG_VELD,
  ...ALL_WIDTHS.map(variantVeld),
]);

interface AfbeeldingRij {
  id: string;
  r2_sleutel: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Handelt de foto- en galerijroutes af. Geeft `null` terug voor een pad dat hier
 * niet hoort, zodat `index.ts` verder kan zoeken.
 */
export async function routeerAfbeeldingen(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  const { pathname } = url;
  const methode = request.method;

  const isLijst = pathname === API.afbeeldingen;
  const isEen = pathname.startsWith(`${API.afbeeldingen}/`);
  const isGalerij = pathname === API.galerij;
  if (!isLijst && !isEen && !isGalerij) return null;

  if (methode !== "GET" && !vanEigenOriginStrikt(request, url)) {
    return json({ ok: false, melding: "Ongeldig verzoek." }, 403);
  }

  if (isLijst) {
    if (methode === "GET") return lijst(env);
    if (methode === "POST") return upload(request, env);
    return methodeNietToegestaan("GET, POST");
  }

  if (isEen) {
    const id = leesId(pathname.slice(`${API.afbeeldingen}/`.length));
    if (!id) return json({ ok: false, melding: "Ongeldig id." }, 400);
    if (methode === "PATCH") return wijzigAlt(request, id, env);
    if (methode === "DELETE") return verwijder(id, env);
    return methodeNietToegestaan("PATCH, DELETE");
  }

  if (methode === "GET") return leesGalerij(env);
  if (methode === "PUT") return bewaarGalerij(request, env);
  return methodeNietToegestaan("GET, PUT");
}

/* -------------------------------------------------------------------------- */
/* Bibliotheek                                                                */
/* -------------------------------------------------------------------------- */

async function lijst(env: Env): Promise<Response> {
  /*
   * De galerij van een reis is JSON-tekst zonder foreign key, dus `json_each`
   * zoekt de id erin op. Een reis telt één keer, ook als de foto er zowel omslag
   * als galerijfoto is.
   */
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.r2_sleutel, a.alt, a.width, a.height,
            (SELECT COUNT(*) FROM reizen r
              WHERE r.cover_image = a.id
                 OR EXISTS (SELECT 1 FROM json_each(r.gallery) j WHERE j.value = a.id))
          + (SELECT COUNT(*) FROM galerij g WHERE g.afbeelding_id = a.id) AS gebruik
       FROM afbeeldingen a
      ORDER BY a.aangemaakt DESC, a.id
      LIMIT ?`,
  )
    .bind(OVERZICHT_LIMIET)
    .all<AfbeeldingRij & { gebruik: number }>();

  const antwoord: AfbeeldingenAntwoord = {
    afbeeldingen: results.map(
      (rij): AfbeeldingMetGebruik => ({ ...naarRecord(rij), gebruik: rij.gebruik }),
    ),
  };
  return json(antwoord);
}

async function upload(request: Request, env: Env): Promise<Response> {
  if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data")) {
    return json({ ok: false, melding: "Verstuur de foto als formulier." }, 400);
  }

  /*
   * Eerst op de opgegeven lengte afwijzen, vóór `formData()` alles in het geheugen
   * leest. Zonder lengte is niet vooraf te zien hoe groot het wordt; een browser
   * stuurt hem bij een FormData altijd mee.
   */
  const lengte = Number(request.headers.get("Content-Length"));
  if (!request.headers.has("Content-Length") || !Number.isSafeInteger(lengte)) {
    return json({ ok: false, melding: "De grootte van de upload ontbreekt." }, 411);
  }
  if (lengte > MAX_UPLOAD_BYTES) {
    return json({ ok: false, melding: "De upload is te groot." }, 413);
  }

  let formulier: FormData;
  try {
    formulier = await request.formData();
  } catch {
    return json({ ok: false, melding: "Ongeldig formulier." }, 400);
  }

  const invoer = await valideerUpload(formulier);
  if (!invoer.ok) return json({ ok: false, melding: invoer.melding }, 400);

  // Kort genoeg voor een URL, en met 64 willekeurige bits niet te raden.
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const sleutel = `fotos/${id}`;
  const objecten: [string, ArrayBuffer, string][] = [
    ...[...invoer.varianten].map(
      ([breedte, bytes]): [string, ArrayBuffer, string] => [
        `${sleutel}/${breedte}.webp`,
        bytes,
        "image/webp",
      ],
    ),
    [`${sleutel}/${OG_BESTAND}`, invoer.og, "image/jpeg"],
  ];

  /*
   * Eerst R2, dan D1: zo verwijst de database nooit naar bestanden die er niet
   * zijn. `allSettled` wacht tot élke put klaar is, ook na een mislukte — anders
   * kan een trage put pas ná het opruimen landen en alsnog blijven staan.
   */
  try {
    const uitkomsten = await Promise.allSettled(
      objecten.map(([naam, bytes, contentType]) =>
        env.MEDIA.put(naam, bytes, { httpMetadata: { contentType } }),
      ),
    );
    const mislukt = uitkomsten.find((u) => u.status === "rejected");
    if (mislukt) throw mislukt.reason;

    await env.DB.prepare(
      `INSERT INTO afbeeldingen (id, r2_sleutel, alt, width, height, aangemaakt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, sleutel, invoer.alt, invoer.width, invoer.height, new Date().toISOString())
      .run();
  } catch (fout) {
    // Een fout bij het opruimen mag de oorspronkelijke fout niet verbergen.
    try {
      await env.MEDIA.delete(objecten.map(([naam]) => naam));
    } catch (opruimFout) {
      console.error(`Opruimen van ${sleutel}/ na mislukte upload faalde:`, opruimFout);
    }
    throw fout;
  }

  const antwoord: AfbeeldingAntwoord = {
    ok: true,
    afbeelding: { id, sleutel, alt: invoer.alt, width: invoer.width, height: invoer.height },
  };
  return json(antwoord, 201);
}

type UploadInvoer =
  | {
      ok: true;
      alt: string;
      width: number;
      height: number;
      varianten: Map<number, ArrayBuffer>;
      og: ArrayBuffer;
    }
  | { ok: false; melding: string };

async function valideerUpload(formulier: FormData): Promise<UploadInvoer> {
  for (const naam of formulier.keys()) {
    if (!TOEGESTANE_VELDEN.has(naam)) return fout(`Onbekend veld: ${naam.slice(0, 40)}.`);
  }

  const alt = enkeleTekst(formulier, "alt")?.trim() ?? "";
  if (!alt) return fout("Vul een alt-tekst in.");
  if (alt.length > UPLOAD.maxAlt) {
    return fout(`De alt-tekst mag hoogstens ${UPLOAD.maxAlt} tekens zijn.`);
  }

  const width = afmeting(enkeleTekst(formulier, "width"));
  const height = afmeting(enkeleTekst(formulier, "height"));
  if (width === null || height === null) {
    return fout(`Breedte en hoogte moeten hele getallen van 1 tot ${UPLOAD.maxAfmeting} zijn.`);
  }

  /*
   * Elke breedte van de ladder moet er zijn, net als bij de build-varianten: de
   * loader vraagt ze allemaal op, en een ontbrekende is een kapotte `srcset`.
   */
  const varianten = new Map<number, ArrayBuffer>();
  for (const breedte of ALL_WIDTHS) {
    const delen = formulier.getAll(variantVeld(breedte));
    if (delen.length !== 1) return fout(`Er moet precies één variant van ${breedte}px zijn.`);

    const deel = delen[0];
    if (typeof deel === "string") return fout(`De variant van ${breedte}px is geen bestand.`);
    if (deel.type !== "image/webp") return fout(`De variant van ${breedte}px is geen WebP.`);
    if (deel.size > UPLOAD.maxVariantBytes) {
      return fout(`De variant van ${breedte}px is groter dan 1 MB.`);
    }

    // Het type hierboven komt van de browser en bewijst niets; de bytes wel.
    const bytes = await deel.arrayBuffer();
    if (!isWebp(bytes)) return fout(`De variant van ${breedte}px is geen geldige WebP.`);
    varianten.set(breedte, bytes);
  }

  const ogDelen = formulier.getAll(OG_VELD);
  if (ogDelen.length !== 1) return fout("Er moet precies één deelafbeelding (og) zijn.");
  const ogDeel = ogDelen[0];
  if (typeof ogDeel === "string") return fout("De deelafbeelding is geen bestand.");
  if (ogDeel.type !== "image/jpeg") return fout("De deelafbeelding is geen JPEG.");
  if (ogDeel.size > UPLOAD.maxOgBytes) {
    return fout(`De deelafbeelding is groter dan ${UPLOAD.maxOgBytes / 1024} KB.`);
  }
  const og = await ogDeel.arrayBuffer();
  if (!isJpeg(og)) return fout("De deelafbeelding is geen geldige JPEG.");

  return { ok: true, alt, width, height, varianten, og };
}

/** Een JPEG begint met FF D8 FF; de browser-opgegeven type bewijst niets, de bytes wel. */
function isJpeg(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  const kop = new Uint8Array(bytes, 0, 3);
  return kop[0] === 0xff && kop[1] === 0xd8 && kop[2] === 0xff;
}

/**
 * Een WebP is een RIFF-container: `RIFF`, de lengte van de rest als
 * little-endian uint32, en dan `WEBP`. De lengte moet kloppen met het bestand —
 * een afgekapt of aangeplakt bestand valt daarop af.
 */
function isWebp(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 16) return false;
  const kop = new DataView(bytes);
  const tekst = (start: number) =>
    String.fromCharCode(...new Uint8Array(bytes, start, 4));
  return (
    tekst(0) === "RIFF" &&
    tekst(8) === "WEBP" &&
    kop.getUint32(4, true) + 8 === bytes.byteLength
  );
}

async function wijzigAlt(request: Request, id: string, env: Env): Promise<Response> {
  const body = await leesJson(request);
  const alt = typeof body?.alt === "string" ? body.alt.trim() : "";
  if (!alt) return json({ ok: false, melding: "Vul een alt-tekst in." }, 400);
  if (alt.length > UPLOAD.maxAlt) {
    return json(
      { ok: false, melding: `De alt-tekst mag hoogstens ${UPLOAD.maxAlt} tekens zijn.` },
      400,
    );
  }

  const rij = await env.DB.prepare(
    `UPDATE afbeeldingen SET alt = ? WHERE id = ?
     RETURNING id, r2_sleutel, alt, width, height`,
  )
    .bind(alt, id)
    .first<AfbeeldingRij>();

  if (!rij) return json({ ok: false, melding: "Deze foto bestaat niet." }, 404);

  const antwoord: AfbeeldingAntwoord = { ok: true, afbeelding: naarRecord(rij) };
  return json(antwoord);
}

async function verwijder(id: string, env: Env): Promise<Response> {
  const [afbeelding, reizen, galerij] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT r2_sleutel FROM afbeeldingen WHERE id = ?").bind(id),
    env.DB.prepare(
      `SELECT title FROM reizen
        WHERE cover_image = ?1
           OR EXISTS (SELECT 1 FROM json_each(reizen.gallery) WHERE value = ?1)
        ORDER BY departure_date`,
    ).bind(id),
    env.DB.prepare("SELECT 1 FROM galerij WHERE afbeelding_id = ? LIMIT 1").bind(id),
  ]);

  const r2Sleutel = afbeelding.results[0]?.r2_sleutel;
  if (typeof r2Sleutel !== "string") {
    return json({ ok: false, melding: "Deze foto bestaat niet." }, 404);
  }

  const plekken = reizen.results.map((rij) => `"${String(rij.title)}"`);
  if (galerij.results.length > 0) plekken.push("de homepagegalerij");
  if (plekken.length > 0) {
    return json(
      {
        ok: false,
        melding: `Deze foto is nog in gebruik bij ${opsomming(plekken)}. Kies daar eerst een andere foto.`,
      },
      409,
    );
  }

  /*
   * De voorwaarde staat ook in de DELETE zelf: kiest iemand tussen de controle
   * hierboven en dit moment alsnog deze foto, dan verwijdert dit niets in plaats
   * van een gat te slaan.
   */
  const uitkomst = await env.DB.prepare(
    `DELETE FROM afbeeldingen
      WHERE id = ?1
        AND NOT EXISTS (SELECT 1 FROM galerij WHERE afbeelding_id = ?1)
        AND NOT EXISTS (
              SELECT 1 FROM reizen
               WHERE cover_image = ?1
                  OR EXISTS (SELECT 1 FROM json_each(reizen.gallery) WHERE value = ?1))`,
  )
    .bind(id)
    .run();

  if (uitkomst.meta.changes === 0) {
    return json(
      { ok: false, melding: "Deze foto is net in gebruik genomen. Herlaad en probeer opnieuw." },
      409,
    );
  }

  /*
   * De rij is weg en daarmee de foto voor de site. Lukt het opruimen in R2 niet,
   * dan blijven er onbereikbare bestanden over — jammer, maar geen reden om de
   * beheerder een fout te tonen voor iets wat wél gelukt is.
   */
  try {
    await verwijderVarianten(env.MEDIA, r2Sleutel);
  } catch (fout) {
    console.error(`Opruimen van ${r2Sleutel}/ in R2 na verwijderen faalde:`, fout);
  }
  return json({ ok: true });
}

/**
 * Verwijdert alles onder het voorvoegsel, niet alleen de breedtes van nu: een
 * ladder die later wijzigt, laat anders bestanden achter die niemand meer ziet.
 */
async function verwijderVarianten(bucket: R2Bucket, r2Sleutel: string): Promise<void> {
  const prefix = `${r2Sleutel}/`;
  let cursor: string | undefined;
  do {
    const lijst = await bucket.list({ prefix, cursor });
    if (lijst.objects.length > 0) await bucket.delete(lijst.objects.map((o) => o.key));
    cursor = lijst.truncated ? lijst.cursor : undefined;
  } while (cursor);
}

/* -------------------------------------------------------------------------- */
/* Homepagegalerij                                                            */
/* -------------------------------------------------------------------------- */

async function leesGalerij(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT afbeelding_id FROM galerij ORDER BY positie",
  ).all<{ afbeelding_id: string }>();

  const antwoord: GalerijAntwoord = { galerij: results.map((rij) => rij.afbeelding_id) };
  return json(antwoord);
}

async function bewaarGalerij(request: Request, env: Env): Promise<Response> {
  const body = await leesJson(request);
  const ruw: unknown = body?.ids;

  /*
   * De tabel zelf heeft geen CHECK of UNIQUE: deze controle is de enige. Precies
   * zes, allemaal verschillend, allemaal bestaand — anders vult het raster niet.
   */
  if (
    !Array.isArray(ruw) ||
    ruw.length !== GALERIJ_AANTAL ||
    !ruw.every((id): id is string => typeof id === "string" && leesId(id) === id)
  ) {
    return json({ ok: false, melding: `Kies precies ${GALERIJ_AANTAL} foto's.` }, 400);
  }
  const ids = ruw as string[];
  if (new Set(ids).size !== ids.length) {
    return json({ ok: false, melding: "Elke foto mag maar één keer voorkomen." }, 400);
  }

  if (!(await bestaanAlle(env, ids))) {
    return json({ ok: false, melding: "Een of meer foto's bestaan niet meer." }, 400);
  }

  // Eén batch is één transactie: de homepage ziet nooit een halve galerij.
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM galerij"),
      ...ids.map((id, i) =>
        env.DB.prepare("INSERT INTO galerij (positie, afbeelding_id) VALUES (?, ?)").bind(
          i + 1,
          id,
        ),
      ),
    ]);
  } catch (fout) {
    /*
     * Is er tussen de controle en het schrijven een foto verwijderd, dan weigert
     * de foreign key de batch. Dat stellen we vast door opnieuw te kijken, niet
     * door de tekst van de D1-fout te lezen. Bestaan ze nog allemaal, dan was het
     * iets anders en mag de algemene foutafhandeling het overnemen.
     */
    if (await bestaanAlle(env, ids)) throw fout;
    return json(
      {
        ok: false,
        melding:
          "Een van de gekozen foto's bestaat niet meer. Vernieuw de pagina en probeer opnieuw.",
      },
      409,
    );
  }

  const antwoord: GalerijAntwoord = { galerij: ids };
  return json(antwoord);
}

/* -------------------------------------------------------------------------- */
/* Hulpjes                                                                    */
/* -------------------------------------------------------------------------- */

/** Zelfde vorm als een slug: de bestaande foto's hebben leesbare id's, nieuwe hex. */
const ID_PATROON = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_ID = 100;

function leesId(ruw: string): string | null {
  return ruw.length <= MAX_ID && ID_PATROON.test(ruw) ? ruw : null;
}

/** Staan alle (unieke) id's in de bibliotheek? */
async function bestaanAlle(env: Env, ids: string[]): Promise<boolean> {
  const rij = await env.DB.prepare(
    `SELECT COUNT(*) AS aantal FROM afbeeldingen
      WHERE id IN (${ids.map(() => "?").join(", ")})`,
  )
    .bind(...ids)
    .first<{ aantal: number }>();
  return rij?.aantal === ids.length;
}

function naarRecord(rij: AfbeeldingRij): AfbeeldingRecord {
  return {
    id: rij.id,
    sleutel: rij.r2_sleutel,
    alt: rij.alt,
    width: rij.width,
    height: rij.height,
  };
}

function enkeleTekst(formulier: FormData, naam: string): string | null {
  const waarden = formulier.getAll(naam);
  return waarden.length === 1 && typeof waarden[0] === "string" ? waarden[0] : null;
}

function afmeting(ruw: string | null): number | null {
  if (ruw === null || !/^\d{1,5}$/.test(ruw)) return null;
  const getal = Number(ruw);
  return getal >= 1 && getal <= UPLOAD.maxAfmeting ? getal : null;
}

function fout(melding: string): { ok: false; melding: string } {
  return { ok: false, melding };
}

/** "A", "A en B", "A, B en C". */
function opsomming(delen: string[]): string {
  return delen.length <= 1
    ? delen.join("")
    : `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}
