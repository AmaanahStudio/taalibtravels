/**
 * Publieke, alleen-lezen toegang tot de foto's in R2 onder `/media/<sleutel>`.
 *
 * Er is geen sessie nodig: deze bestanden staan op de openbare pagina's. Wat
 * hier wel bewaakt wordt, is wélke sleutels bereikbaar zijn — alleen de
 * varianten die het beheer zelf schrijft, nooit een willekeurig object dat
 * later in dezelfde bucket belandt.
 */

import { MEDIA_PAD } from "../src/lib/api";

/** De vormen die `afbeeldingen.ts` schrijft: `fotos/<id>/<breedte>.webp` en `fotos/<id>/og.jpg`. */
const MEDIA_SLEUTEL = /^fotos\/[a-z0-9-]+\/(?:\d+\.webp|og\.jpg)$/;

/*
 * Een sleutel bevat een id die nooit hergebruikt wordt; een ander bestand krijgt
 * een andere URL. De browser en de CDN mogen hem dus een jaar bewaren zonder
 * ooit opnieuw te vragen.
 */
const MEDIA_CACHE = "public, max-age=31536000, immutable";

export async function serveerMedia(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Deze methode kan hier niet.", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const sleutel = url.pathname.slice(MEDIA_PAD.length);
  if (!MEDIA_SLEUTEL.test(sleutel)) return nietGevonden();

  /*
   * `onlyIf` laat R2 zelf If-None-Match en If-Modified-Since beoordelen. Klopt de
   * ETag van de browser nog, dan komt er een object zonder body terug en sturen
   * we een 304 — het bestand gaat dan niet opnieuw over de lijn.
   */
  const object: R2Object | R2ObjectBody | null =
    request.method === "HEAD"
      ? await env.MEDIA.head(sleutel)
      : await env.MEDIA.get(sleutel, { onlyIf: request.headers });

  if (!object) return nietGevonden();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", MEDIA_CACHE);
  // Het type staat vast; een ander type in de metadata mag de browser niet verleiden.
  headers.set("Content-Type", sleutel.endsWith(".jpg") ? "image/jpeg" : "image/webp");
  headers.set("X-Content-Type-Options", "nosniff");

  if (request.method === "HEAD") {
    headers.set("Content-Length", String(object.size));
    return new Response(null, { headers });
  }

  if (!heeftBody(object)) return new Response(null, { status: 304, headers });

  return new Response(object.body, { headers });
}

/** Zonder body betekent: de voorwaarde uit `onlyIf` sloeg niet aan, de browser heeft hem al. */
function heeftBody(object: R2Object | R2ObjectBody): object is R2ObjectBody {
  return "body" in object;
}

function nietGevonden(): Response {
  // Niet cachen: een 404 op een net verwijderde of nog te uploaden foto mag niet blijven hangen.
  return new Response("Niet gevonden.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
