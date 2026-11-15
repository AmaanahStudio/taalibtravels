/**
 * De beveiligings- en cacheheaders van de site: de enige plek waar ze staan.
 *
 * Ze moeten op twee soorten antwoorden komen, en die lopen langs verschillende
 * wegen:
 *  - Statische bestanden serveert Cloudflare zelf, zonder de Worker. Die krijgen
 *    hun headers uit `public/_headers`. Dat bestand is GEGENEREERD uit
 *    `HEADER_REGELS` hieronder, door `scripts/build-headers.mjs` (draait als
 *    `prebuild`, dus ook binnen `opennextjs-cloudflare build`).
 *  - Pagina's en API-antwoorden maakt de Worker (OpenNext en `/api/*`). Daar komt
 *    `_headers` nooit aan te pas; `index.ts` zet ze met `metBeveiligingsheaders`.
 * Omdat beide uit dezelfde constanten komen, kunnen ze niet uit elkaar lopen.
 *
 * Geen imports en alleen wegstripbare typen: Node laadt dit bestand rechtstreeks
 * voor het build-script.
 */

/*
 * Over de CSP: `'unsafe-inline'` bij script-src is nodig voor het themascript in
 * <head> en voor de hydratie-scripts van Next. Een nonce zou kunnen nu de pagina's
 * per verzoek renderen, maar vraagt dat Next elk inline script tagt; dat is een
 * eigen klus. Zo beschermt deze CSP niet tegen een injectie ín de pagina, maar wél
 * tegen het inladen van scripts van vreemde domeinen, en dat is hier de reële
 * winst: /giveaway haalt een script van Cloudflare binnen op een formulier dat
 * persoonsgegevens verzamelt.
 *
 * challenges.cloudflare.com staat er drie keer in omdat Turnstile alle drie nodig
 * heeft: het script zelf, de iframe die het opent, en het verzoek dat het doet.
 *
 * `blob:` bij img-src is voor het voorbeeld van een gekozen foto in het
 * uploadformulier van het beheer (`URL.createObjectURL`); dat zijn altijd
 * bestanden die de bezoeker zelf koos. De hero-video valt onder default-src 'self'.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
].join("; ");

type HeaderLijst = Readonly<Record<string, string>>;

/** Voor elk antwoord van de site. */
export const BEVEILIGINGSHEADERS: HeaderLijst = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), interest-cohort=()",
  "Content-Security-Policy": CSP,
};

/**
 * Het beheer. De HTML bevat geen gegevens — die komen via de API achter een
 * sessiecontrole — maar er is ook geen reden om hem te bewaren of te tonen in een
 * zoekresultaat.
 */
export const BEHEERHEADERS: HeaderLijst = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/** Foto's en video met een vaste naam: een dag hard, daarna een week serveren terwijl de nieuwe binnenkomt. */
const VASTE_NAAM_CACHE: HeaderLijst = {
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
};

export interface HeaderRegel {
  /** Padpatroon in de syntax van `_headers`; `*` aan het eind is een joker. */
  pad: string;
  /** Wordt als commentaar boven de regel in `_headers` gezet. */
  uitleg: string;
  headers: HeaderLijst;
}

/**
 * De regels voor `public/_headers`, in deze volgorde. Zonder dat bestand krijgt
 * élk statisch bestand `max-age=0, must-revalidate` — ook de content-gehashte
 * bundels — en hervalideert een telefoon bij elk bezoek ruim vijftien bestanden.
 */
export const HEADER_REGELS: readonly HeaderRegel[] = [
  {
    pad: "/*",
    uitleg: "Beveiligingsheaders voor alles.",
    headers: BEVEILIGINGSHEADERS,
  },
  {
    pad: "/_next/static/*",
    uitleg:
      "Next zet een contenthash in deze bestandsnamen; ze verouderen nooit en mogen een jaar vast blijven.",
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  },
  {
    pad: "/images/*",
    uitleg: "Vaste bestandsnaam, wordt bij een nieuwe versie overschreven.",
    headers: VASTE_NAAM_CACHE,
  },
  {
    pad: "/videos/*",
    uitleg: "Vaste bestandsnaam, wordt bij een nieuwe montage overschreven.",
    headers: VASTE_NAAM_CACHE,
  },
  { pad: "/admin", uitleg: "Het beheer: nooit bewaren of indexeren.", headers: BEHEERHEADERS },
  { pad: "/admin/*", uitleg: "Idem, voor alles eronder.", headers: BEHEERHEADERS },
];

export function isBeheerPad(pad: string): boolean {
  return pad === "/admin" || pad.startsWith("/admin/");
}

/**
 * Zet de headers op een antwoord dat de Worker zelf maakt.
 *
 * Bewust alleen de beveiligingsheaders en die van het beheer, níet de
 * cacheregels uit `HEADER_REGELS`: `immutable` hoort bij bestanden met een hash
 * in de naam, en een pagina die per verzoek uit D1 komt, mag nooit zo lang
 * blijven hangen. De cache van een pagina bepaalt Next zelf.
 *
 * Een kopie, omdat de headers van een doorgegeven antwoord (OpenNext, fetch)
 * onveranderlijk kunnen zijn.
 */
export function metBeveiligingsheaders(antwoord: Response, pad: string): Response {
  const kopie = new Response(antwoord.body, antwoord);
  for (const [naam, waarde] of Object.entries(BEVEILIGINGSHEADERS)) {
    kopie.headers.set(naam, waarde);
  }
  if (isBeheerPad(pad)) {
    for (const [naam, waarde] of Object.entries(BEHEERHEADERS)) {
      kopie.headers.set(naam, waarde);
    }
  }
  return kopie;
}
