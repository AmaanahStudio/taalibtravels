/**
 * De loader die `next/image` gebruikt om een bron-URL naar een variant te
 * vertalen. Aangewezen via `images.loaderFile` in next.config.ts.
 *
 * Waarom dit bestaat: de site is een statische export, dus de Image
 * Optimization API van Next draait nergens. Zonder loader is de enige optie
 * `unoptimized: true`, en dan komt er helemaal géén `srcset` in de HTML — een
 * telefoon van 390px laadt dan dezelfde foto van 1400px als een desktop.
 * `scripts/build-images.mjs` maakt de varianten bij het bouwen; deze functie
 * wijst ze aan.
 *
 * Dit bestand belandt ook in de browserbundel, dus: geen imports, geen state,
 * puur een string-omzetting.
 */

/** Bestandsnamen die `build-images.mjs` verwerkt, zie `images.json`. */
const BRONFOTO = /^\/images\/([^/]+)\.(?:jpg|jpeg|png)$/;

export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const match = BRONFOTO.exec(src);

  // Alles zonder variant — het logo, het og-beeld, een externe URL — gaat
  // ongewijzigd terug. Beter de bron dan een pad naar een bestand dat er niet is.
  if (!match) return src;

  return `/images/generated/${match[1]}-${width}.webp`;
}
