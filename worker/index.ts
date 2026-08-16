/**
 * De enige servercode van de site.
 *
 * Alles buiten /api/ is een statisch bestand dat Cloudflare rechtstreeks van het
 * netwerk serveert; deze Worker draait alleen voor het inschrijfformulier en het
 * admin-overzicht. Zie `run_worker_first` in wrangler.jsonc.
 *
 * De validatieregels staan in `src/lib/leads.ts` en worden gedeeld met het
 * formulier. Wat hier gebeurt is het oordeel dat telt: een bezoeker kan de
 * controle in de browser overslaan.
 */

import { API, type Deelnemer, type DeelnemersAntwoord } from "../src/lib/api";
import { valideerLead } from "../src/lib/leads";
import {
  gelijkInConstanteTijd,
  hashIp,
  heeftGeldigeSessie,
  maakSessieCookie,
  wisSessieCookie,
} from "./auth";
import { bouwCsv } from "./csv";

/** Bovengrens op het overzicht, zodat één verzoek nooit de hele tabel trekt. */
const OVERZICHT_LIMIET = 5000;

/** Een te kort adminwachtwoord is online te raden; hieronder weigert de Worker. */
const MINIMALE_WACHTWOORDLENGTE = 16;

const TURNSTILE_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Vorm van een rij uit `deelnemers`, met de kolomnamen van de database. */
interface DeelnemerRij {
  id: number;
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string | null;
  bron: string;
  aangemaakt_op: string;
}

interface ExportRij extends Omit<DeelnemerRij, "id"> {
  voorwaarden: number;
  consent: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    /*
     * Vangnet. `run_worker_first: ["/api/*"]` hoort ervoor te zorgen dat er hier
     * niets anders binnenkomt, maar als die regel ooit sneuvelt, is dit het
     * verschil tussen "de site werkt" en "elke pagina geeft 404".
     */
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      return await routeer(request, url, env);
    } catch (fout) {
      // De echte fout blijft in de Cloudflare-logs; de bezoeker krijgt hem niet
      // te zien. Een stacktrace of SQL-melding vertelt een aanvaller te veel.
      console.error("Onverwachte fout:", fout);
      return json(
        { ok: false, melding: "Er ging iets mis. Probeer het later opnieuw." },
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function routeer(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const { pathname } = url;
  const methode = request.method;

  if (pathname === API.inschrijven) {
    if (methode !== "POST") return methodeNietToegestaan("POST");
    return inschrijven(request, url, env);
  }

  if (pathname === API.login) {
    if (methode !== "POST") return methodeNietToegestaan("POST");
    return login(request, url, env);
  }

  if (pathname === API.logout) {
    if (methode !== "POST") return methodeNietToegestaan("POST");
    return json({ ok: true }, 200, wisSessieCookie());
  }

  if (!beheerIsIngesteld(env)) return beheerNietIngesteld();

  // Eén poort voor alles wat hierna komt: geen geldige sessie, geen data.
  if (!(await heeftGeldigeSessie(request, env.ADMIN_SESSIE_SECRET))) {
    return json({ ok: false, melding: "Niet ingelogd." }, 401);
  }

  if (pathname === API.deelnemers && methode === "GET") return lijst(env);
  if (pathname === API.export && methode === "GET") return exporteer(env);

  if (pathname.startsWith(`${API.deelnemers}/`) && methode === "DELETE") {
    return verwijder(request, url, env);
  }

  return json({ ok: false, melding: "Onbekende route." }, 404);
}

/* -------------------------------------------------------------------------- */
/* Inschrijven                                                                */
/* -------------------------------------------------------------------------- */

async function inschrijven(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  if (!vanEigenOrigin(request, url)) {
    return json({ ok: false, melding: "Ongeldig verzoek." }, 403);
  }

  const ip = clientIp(request);

  if (!(await binnenLimiet(env.SIGNUP_LIMIT, ip))) {
    return json(
      { ok: false, melding: "Te veel pogingen. Wacht even en probeer opnieuw." },
      429,
    );
  }

  const body = await leesJson(request);
  if (!body) return json({ ok: false, melding: "Ongeldig verzoek." }, 400);

  /*
   * Honeypot: een veld dat met CSS verborgen staat en dus leeg hoort te blijven.
   * Een bot die blind elk invoerveld invult, verraadt zich hier. Het antwoord is
   * bewust een gewone bevestiging — wie merkt dat hij geweerd wordt, past zijn
   * script aan.
   */
  if (typeof body.website === "string" && body.website.length > 0) {
    return json({ ok: true }, 201);
  }

  const resultaat = valideerLead(body);
  if (!resultaat.ok) {
    return json(
      {
        ok: false,
        melding: "Controleer de gemarkeerde velden.",
        fouten: resultaat.fouten,
      },
      400,
    );
  }

  const token = typeof body.turnstile === "string" ? body.turnstile : "";
  if (!(await turnstileGoedgekeurd(token, env.TURNSTILE_SECRET, ip))) {
    return json(
      {
        ok: false,
        melding:
          "De beveiligingscontrole is niet gelukt. Herlaad de pagina en probeer opnieuw.",
      },
      400,
    );
  }

  const { lead } = resultaat;

  const uitkomst = await env.DB.prepare(
    `INSERT INTO deelnemers
       (voornaam, achternaam, email, telefoon, bron, voorwaarden, consent, aangemaakt_op, ip_hash)
     VALUES (?, ?, ?, ?, 'giveaway', 1, 1, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
  )
    .bind(
      lead.voornaam,
      lead.achternaam,
      lead.email,
      lead.telefoon,
      new Date().toISOString(),
      env.IP_SALT ? await hashIp(ip, env.IP_SALT) : null,
    )
    .run();

  /*
   * `changes === 0` betekent dat ON CONFLICT heeft toegeslagen: dit adres deed
   * al mee. Dat via de teller afhandelen en niet via de tekst van een
   * foutmelding — die tekst is een implementatiedetail van D1 en kan wijzigen.
   */
  if (uitkomst.meta.changes === 0) {
    return json(
      { ok: false, melding: "Dit e-mailadres doet al mee aan de giveaway." },
      409,
    );
  }

  return json({ ok: true }, 201);
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

async function login(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  if (!vanEigenOrigin(request, url)) {
    return json({ ok: false, melding: "Ongeldig verzoek." }, 403);
  }

  if (!beheerIsIngesteld(env)) return beheerNietIngesteld();

  if (!(await binnenLimiet(env.LOGIN_LIMIT, clientIp(request)))) {
    return json(
      { ok: false, melding: "Te veel pogingen. Wacht een minuut." },
      429,
    );
  }

  const body = await leesJson(request);
  const ingevuld = typeof body?.wachtwoord === "string" ? body.wachtwoord : "";

  if (!(await gelijkInConstanteTijd(ingevuld, env.ADMIN_WACHTWOORD))) {
    return json({ ok: false, melding: "Onjuist wachtwoord." }, 401);
  }

  return json({ ok: true }, 200, await maakSessieCookie(env.ADMIN_SESSIE_SECRET));
}

async function lijst(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, voornaam, achternaam, email, telefoon, bron, aangemaakt_op
       FROM deelnemers
      ORDER BY aangemaakt_op DESC, id DESC
      LIMIT ?`,
  )
    .bind(OVERZICHT_LIMIET)
    .all<DeelnemerRij>();

  // Apart geteld: bij meer dan OVERZICHT_LIMIET rijen zou `results.length` een
  // te laag totaal tonen, en dan klopt het getal boven de tabel niet meer.
  const telling = await env.DB.prepare(
    "SELECT COUNT(*) AS aantal FROM deelnemers",
  ).first<{ aantal: number }>();

  const antwoord: DeelnemersAntwoord = {
    deelnemers: results.map(naarDeelnemer),
    totaal: telling?.aantal ?? results.length,
  };

  return json(antwoord);
}

async function exporteer(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT voornaam, achternaam, email, telefoon, bron, voorwaarden, consent, aangemaakt_op
       FROM deelnemers
      ORDER BY aangemaakt_op DESC, id DESC`,
  ).all<ExportRij>();

  const csv = bouwCsv(
    [
      "Voornaam",
      "Achternaam",
      "E-mail",
      "Telefoon",
      "Bron",
      "Voorwaarden akkoord",
      "Marketing akkoord",
      "Ingeschreven op",
    ],
    results.map((rij) => [
      rij.voornaam,
      rij.achternaam,
      rij.email,
      rij.telefoon,
      rij.bron,
      rij.voorwaarden ? "ja" : "nee",
      rij.consent ? "ja" : "nee",
      rij.aangemaakt_op,
    ]),
  );

  const bestandsnaam = `deelnemers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${bestandsnaam}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function verwijder(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  if (!vanEigenOrigin(request, url)) {
    return json({ ok: false, melding: "Ongeldig verzoek." }, 403);
  }

  const id = Number(url.pathname.slice(`${API.deelnemers}/`.length));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return json({ ok: false, melding: "Ongeldig id." }, 400);
  }

  const uitkomst = await env.DB.prepare("DELETE FROM deelnemers WHERE id = ?")
    .bind(id)
    .run();

  if (uitkomst.meta.changes === 0) {
    return json({ ok: false, melding: "Deze inschrijving bestaat niet." }, 404);
  }

  return json({ ok: true });
}

/* -------------------------------------------------------------------------- */
/* Hulpjes                                                                    */
/* -------------------------------------------------------------------------- */

function naarDeelnemer(rij: DeelnemerRij): Deelnemer {
  return {
    id: rij.id,
    voornaam: rij.voornaam,
    achternaam: rij.achternaam,
    email: rij.email,
    telefoon: rij.telefoon,
    bron: rij.bron,
    aangemaaktOp: rij.aangemaakt_op,
  };
}

/**
 * Zijn de twee admin-secrets gezet en lang genoeg?
 *
 * De gegenereerde types zeggen `string`, maar dat is wat wrangler.jsonc en
 * .dev.vars beloven — staat een secret in productie niet ingesteld, dan is de
 * waarde bij het draaien gewoon `undefined`. Dat mag nergens stilzwijgend
 * doorgaan: met een lege sessiesleutel kan iedereen die dat doorheeft zelf een
 * geldige cookie ondertekenen, en dan ligt het hele overzicht open.
 */
function beheerIsIngesteld(env: Env): boolean {
  return (
    (env.ADMIN_WACHTWOORD ?? "").length >= MINIMALE_WACHTWOORDLENGTE &&
    (env.ADMIN_SESSIE_SECRET ?? "").length >= MINIMALE_WACHTWOORDLENGTE
  );
}

function beheerNietIngesteld(): Response {
  console.error(
    "ADMIN_WACHTWOORD of ADMIN_SESSIE_SECRET ontbreekt of is korter dan " +
      `${MINIMALE_WACHTWOORDLENGTE} tekens. Zet ze met \`wrangler secret put\`.`,
  );
  return json({ ok: false, melding: "Beheer is nog niet ingesteld." }, 503);
}

/** JSON-antwoord. Nooit cachen: elk antwoord hier hangt aan één bezoeker. */
function json(data: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (cookie) headers.append("Set-Cookie", cookie);

  return new Response(JSON.stringify(data), { status, headers });
}

function methodeNietToegestaan(toegestaan: string): Response {
  const antwoord = json(
    { ok: false, melding: "Deze methode kan hier niet." },
    405,
  );
  antwoord.headers.set("Allow", toegestaan);
  return antwoord;
}

/**
 * `SameSite=Strict` houdt de sessiecookie al weg bij een verzoek dat van een
 * andere site komt. Deze controle is de tweede laag op alles wat schrijft: komt
 * er een Origin mee, dan moet die de onze zijn.
 */
function vanEigenOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "onbekend";
}

/**
 * De rate-limit-binding bestaat niet in elke lokale opstelling. Ontbreekt hij,
 * dan laten we door: lokaal ontwikkelen mag niet stukgaan op een limiet, en in
 * productie staat de binding in wrangler.jsonc.
 */
async function binnenLimiet(
  limiet: RateLimit | undefined,
  sleutel: string,
): Promise<boolean> {
  if (!limiet) return true;
  const { success } = await limiet.limit({ key: sleutel });
  return success;
}

async function leesJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("Content-Type")?.includes("application/json")) {
    return null;
  }

  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Controleert het Turnstile-token bij Cloudflare.
 *
 * Faalt bewust dicht: zonder secret of zonder token gaat er niets door. Voor
 * lokaal ontwikkelen zijn er testsleutels die altijd slagen (site key
 * `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`) —
 * gebruik die in plaats van deze controle uit te zetten.
 */
async function turnstileGoedgekeurd(
  token: string,
  secret: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!secret || token.length === 0) return false;

  const formulier = new FormData();
  formulier.append("secret", secret);
  formulier.append("response", token);
  if (ip !== "onbekend") formulier.append("remoteip", ip);

  const antwoord = await fetch(TURNSTILE_URL, {
    method: "POST",
    body: formulier,
  });

  const uitslag = (await antwoord.json()) as {
    success?: boolean;
    hostname?: string;
    "error-codes"?: string[];
  };

  /*
   * Waaróm een token afgewezen wordt, is van buitenaf niet te zien: de bezoeker
   * krijgt bewust één algemene melding. Zonder deze regel is een verkeerd
   * ingesteld secret niet te onderscheiden van een verlopen token, en zoek je
   * je blind. `invalid-input-secret` betekent dat TURNSTILE_SECRET niet klopt,
   * `timeout-or-duplicate` dat het token te oud is of al gebruikt.
   *
   * De foutcodes bevatten geen geheimen; ze komen alleen in de Worker-logs
   * (`wrangler tail`), niet in het antwoord aan de bezoeker.
   */
  if (uitslag.success !== true) {
    console.error(
      "Turnstile weigerde het token:",
      JSON.stringify({
        codes: uitslag["error-codes"] ?? [],
        hostname: uitslag.hostname ?? null,
      }),
    );
  }

  return uitslag.success === true;
}
