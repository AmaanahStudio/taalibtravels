/**
 * De breedtes waarop `next/image` een foto mag opvragen.
 *
 * Staat hier als los `.mjs`-bestand omdat twee kanten dezelfde lijst nodig
 * hebben: `next.config.ts` geeft hem aan Next mee om de `srcset` samen te
 * stellen, en `build-images.mjs` genereert precies deze varianten. Lopen ze
 * uiteen, dan vraagt de browser een bestand op dat niet bestaat.
 *
 * De bronfoto's zijn maximaal 1600px breed, dus hoger dan 1600 heeft geen zin —
 * dat zou alleen maar opschalen.
 */

/** Voor `sizes` met viewport-eenheden (de galerij en de reiscards). */
export const DEVICE_SIZES = [640, 828, 1080, 1600];

/** Voor de kleinere, vaste formaten binnen een raster. */
export const IMAGE_SIZES = [256, 384, 512];

/** Alles bij elkaar: de varianten die er van elke foto moeten zijn. */
export const ALL_WIDTHS = [...IMAGE_SIZES, ...DEVICE_SIZES].sort(
  (a, b) => a - b,
);

/** Kwaliteit voor WebP. 78 is visueel nagenoeg gelijk aan de JPEG-bron. */
export const WEBP_QUALITY = 78;

/** Map waarin de gegenereerde varianten belanden, relatief aan `public/`. */
export const OUTPUT_DIR = "images/generated";
