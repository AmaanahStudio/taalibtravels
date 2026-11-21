/**
 * Controle van het Cloudflare Access-token op de beheer-API.
 *
 * Access staat vóór `/admin*` en `/api/admin/*` en laat alleen toegestane e-mailadressen
 * door. Dit bestand is de tweede laag: de Worker vertrouwt er niet blind op dat die
 * bescherming aan staat, maar eist zelf het token dat Access op elk doorgelaten
 * verzoek zet (`Cf-Access-Jwt-Assertion`). Valt Access per ongeluk weg of staat een
 * pad verkeerd, dan is de beheer-API alsnog dicht in plaats van stilzwijgend open.
 *
 * Geen externe bibliotheek: RS256 controleren is met Web Crypto een paar regels,
 * en het scheelt een dependency in de Worker-bundel.
 */

const TOKEN_HEADER = "Cf-Access-Jwt-Assertion";

/** Cloudflare roteert de sleutel ongeveer elke zes weken; een uur cache is ruim veilig. */
const SLEUTEL_CACHE_MS = 60 * 60 * 1000;

/** Onbekende `kid`: hooguit zo vaak opnieuw ophalen, zodat rommel de Worker niet laat hameren. */
const MIN_HERLAAD_MS = 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface SleutelCache {
  sleutels: Map<string, CryptoKey>;
  opgehaald: number;
  teamDomein: string;
}

/** Leeft zolang de isolate leeft; een nieuwe isolate haalt de sleutels gewoon opnieuw op. */
let cache: SleutelCache | null = null;

function vanBase64url(tekst: string): Uint8Array {
  const standaard = tekst.replace(/-/g, "+").replace(/_/g, "/");
  const binair = atob(standaard.padEnd(Math.ceil(standaard.length / 4) * 4, "="));
  return Uint8Array.from(binair, (teken) => teken.charCodeAt(0));
}

function leesJsonDeel(tekst: string): Record<string, unknown> | null {
  try {
    const waarde: unknown = JSON.parse(decoder.decode(vanBase64url(tekst)));
    return typeof waarde === "object" && waarde !== null && !Array.isArray(waarde)
      ? (waarde as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function haalSleutelsOp(teamDomein: string): Promise<SleutelCache> {
  const antwoord = await fetch(`${teamDomein}/cdn-cgi/access/certs`);
  if (!antwoord.ok) throw new Error(`Access-sleutels ophalen mislukt (${antwoord.status}).`);

  const { keys } = (await antwoord.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const sleutels = new Map<string, CryptoKey>();

  for (const jwk of keys ?? []) {
    // Eén onleesbare of vreemde sleutel mag het beheer niet voor iedereen blokkeren.
    if (!jwk.kid || jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256")) continue;
    try {
      sleutels.set(
        jwk.kid,
        await crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"],
        ),
      );
    } catch {
      console.error("Access-sleutel overgeslagen:", jwk.kid);
    }
  }

  return { sleutels, opgehaald: Date.now(), teamDomein };
}

async function zoekSleutel(teamDomein: string, kid: string): Promise<CryptoKey | null> {
  const verouderd =
    !cache || cache.teamDomein !== teamDomein || Date.now() - cache.opgehaald > SLEUTEL_CACHE_MS;
  if (verouderd) cache = await haalSleutelsOp(teamDomein);

  const bekend = cache?.sleutels.get(kid);
  if (bekend) return bekend;

  // Mogelijk net geroteerd: één keer opnieuw proberen, maar niet bij elk verzoek.
  if (cache && Date.now() - cache.opgehaald > MIN_HERLAAD_MS) {
    cache = await haalSleutelsOp(teamDomein);
    return cache.sleutels.get(kid) ?? null;
  }

  return null;
}

/** Klopt de handtekening, uitgever, doelgroep (AUD) en geldigheidsduur van het token? */
export async function heeftGeldigAccessToken(
  request: Request,
  teamDomein: string,
  aud: string,
): Promise<boolean> {
  const token = request.headers.get(TOKEN_HEADER);
  if (!token) return false;

  const delen = token.split(".");
  if (delen.length !== 3) return false;
  const [kop, inhoud, handtekening] = delen;

  const koptekst = leesJsonDeel(kop);
  if (!koptekst || koptekst.alg !== "RS256" || typeof koptekst.kid !== "string") return false;

  const sleutel = await zoekSleutel(teamDomein, koptekst.kid);
  if (!sleutel) return false;

  let geldig: boolean;
  try {
    geldig = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      sleutel,
      vanBase64url(handtekening),
      encoder.encode(`${kop}.${inhoud}`),
    );
  } catch {
    return false;
  }
  if (!geldig) return false;

  const claims = leesJsonDeel(inhoud);
  if (!claims) return false;

  const nu = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  return (
    claims.iss === teamDomein &&
    audiences.includes(aud) &&
    typeof claims.exp === "number" &&
    claims.exp > nu &&
    (typeof claims.nbf !== "number" || claims.nbf <= nu)
  );
}
