/**
 * De breedteladder van elke foto: de enige plek waar die getallen staan.
 *
 * Vier kanten lezen dit bestand en moeten het eens blijven:
 *  - `next.config.ts` geeft de breedtes aan Next voor de `srcset`;
 *  - `scripts/build-images.mjs` en het seed-script maken met sharp de varianten;
 *  - het uploadformulier in het portaal maakt ze in de browser;
 *  - `worker/afbeeldingen.ts` eist bij een upload precies deze breedtes.
 * Lopen ze uiteen, dan vraagt de browser een variant op die niet bestaat.
 *
 * Daarom een `.ts`-bestand zonder imports, zonder `@/*`-alias en met alleen
 * wegstripbare typen: de browserbundel, esbuild (Worker) én Node zelf (de
 * scripts, via type stripping vanaf 22.18) kunnen het zo rechtstreeks laden.
 * `scripts/image-sizes.mjs` exporteert het door voor de scripts.
 *
 * Bovenaan staat 1600: de bronfoto's van de site zijn hoogstens zo breed, en
 * hoger zou alleen opschalen.
 */

/** Voor `sizes` met viewport-eenheden (de galerij en de reiscards). */
export const DEVICE_SIZES: readonly number[] = [640, 828, 1080, 1600];

/** Voor de kleinere, vaste formaten binnen een raster. */
export const IMAGE_SIZES: readonly number[] = [256, 384, 512];

/** Alles bij elkaar: de varianten die er van elke foto moeten zijn, oplopend. */
export const ALL_WIDTHS: readonly number[] = [...IMAGE_SIZES, ...DEVICE_SIZES].sort(
  (a, b) => a - b,
);

/** Kwaliteit voor WebP (0–100, zoals sharp hem leest). 78 is visueel nagenoeg gelijk aan de JPEG-bron. */
export const WEBP_QUALITY = 78;

/**
 * Het deelbeeld voor linkvoorbeelden (WhatsApp, LinkedIn): een JPEG, omdat niet elke
 * previewer WebP als `og:image` leest. Altijd 1200px breed, nooit opgeschaald; een
 * smallere bron houdt zijn eigen breedte.
 */
export const OG_BREEDTE = 1200;

/** Kwaliteit van de deel-JPEG (0–100, zoals sharp hem leest). */
export const OG_KWALITEIT = 82;
