/**
 * De loader die `next/image` gebruikt om een bron-URL naar een variant te
 * vertalen. Aangewezen via `images.loaderFile` in next.config.ts.
 *
 * Waarom dit bestaat: de Image Optimization API van Next draait hier nergens.
 * Zonder loader is de enige optie `unoptimized: true`, en dan komt er helemaal
 * géén `srcset` in de HTML — een telefoon van 390px laadt dan dezelfde foto van
 * 1600px als een desktop. De varianten bestaan al; deze functie wijst ze aan:
 *
 * - beheerde foto's (`/media/fotos/<id>`): het beheer zet elke breedte uit
 *   `scripts/image-sizes.mjs` in R2 als `/media/fotos/<id>/<breedte>.webp`;
 * - bronfoto's in `public/images`: `scripts/build-images.mjs` maakt ze bij het
 *   bouwen in `public/images/generated`.
 *
 * Dit bestand belandt ook in de browserbundel, dus: geen imports, geen state,
 * puur een string-omzetting. Vandaar `/media/` hier letterlijk in plaats van
 * `MEDIA_PAD` uit `api.ts`; die twee moeten gelijk blijven, net als het id-patroon
 * met `MEDIA_SLEUTEL` in `worker/media.ts`.
 */

/**
 * Precies het basispad van een beheerde foto. Alleen dan bestaan de varianten;
 * al het andere onder `/media/` (een lege id, een query-string, een pad dat
 * al een breedte heeft) gaat ongewijzigd terug.
 */
const MEDIA_FOTO = /^\/media\/fotos\/[a-z0-9-]+$/;

/** Bestandsnamen die `build-images.mjs` verwerkt. */
const BRONFOTO = /^\/images\/([^/]+)\.(?:jpg|jpeg|png)$/;

export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (MEDIA_FOTO.test(src)) return `${src}/${width}.webp`;

  const match = BRONFOTO.exec(src);

  // Alles zonder variant — het logo, het og-beeld, een externe URL — gaat
  // ongewijzigd terug. Beter de bron dan een pad naar een bestand dat er niet is.
  if (!match) return src;

  return `/images/generated/${match[1]}-${width}.webp`;
}
