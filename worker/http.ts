/**
 * Antwoord- en verzoekhulpen die `index.ts`, `reizen.ts` en `afbeeldingen.ts`
 * delen. Eigen bestand, zodat de routers niet vanuit `index.ts` hoeven te
 * importeren en er geen kringverwijzing ontstaat.
 */

/** JSON-antwoord. Nooit cachen: elk antwoord hier hangt aan één bezoeker. */
export function json(data: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });

  if (cookie) headers.append("Set-Cookie", cookie);

  return new Response(JSON.stringify(data), { status, headers });
}

export function methodeNietToegestaan(toegestaan: string): Response {
  const antwoord = json({ ok: false, melding: "Deze methode kan hier niet." }, 405);
  antwoord.headers.set("Allow", toegestaan);
  return antwoord;
}

/**
 * `SameSite=Strict` houdt de sessiecookie al weg bij een verzoek dat van een
 * andere site komt. Deze controle is de tweede laag op alles wat schrijft: komt
 * er een Origin mee, dan moet die de onze zijn.
 *
 * Soepel, alleen voor de oudere routes (inschrijven, inloggen, deelnemer
 * verwijderen): een verzoek zonder Origin gaat daar nog door. Nieuwe
 * beheerroutes gebruiken `vanEigenOriginStrikt`.
 */
export function vanEigenOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}

/**
 * Strenger dan `vanEigenOrigin`: een ontbrekende Origin wordt geweigerd. Een
 * browser stuurt hem bij elke fetch die schrijft altijd mee, ook op de eigen
 * site; wie hem weglaat, is geen pagina van ons. Voor de beheerroutes voor
 * reizen en foto's, die pas na de sessiecontrole bereikbaar zijn.
 */
export function vanEigenOriginStrikt(request: Request, url: URL): boolean {
  return request.headers.get("Origin") === url.origin;
}

/** Leest een JSON-object uit de body; alles anders (ook een array) wordt `null`. */
export async function leesJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("Content-Type")?.includes("application/json")) return null;
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
