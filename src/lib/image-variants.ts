/**
 * De afspraak tussen het optimalisatiescript, de image-loader en de sitemap.
 *
 * `scripts/optimize-images.mjs` schrijft per bronfoto een WebP-variant voor
 * elke breedte hieronder; `image-loader.ts` wijst `next/image` naar die
 * bestanden; de sitemap noemt de grootste variant, want dát is de afbeelding
 * die op de pagina staat. Loopt een van die drie uit de pas, dan vraagt de
 * browser een bestand op dat nooit geschreven is — vandaar één bron.
 *
 * Deze module draagt bewust géén `"use client"`: hij wordt zowel door de loader
 * (client) als door de sitemap (server) geïmporteerd.
 *
 * Het script leest deze lijst niet in — een `.mjs` kan geen TypeScript
 * importeren — dus daar staat hij overgeschreven, met een verwijzing hierheen.
 * `next.config.ts` splitst dezelfde reeks in `imageSizes` en `deviceSizes`.
 */
export const IMAGE_WIDTHS = [
  256, 384, 640, 750, 828, 1080, 1200, 1400,
] as const;

/** De breedste variant; wat `next/image` als `src`-terugval neerzet. */
export const MAX_IMAGE_WIDTH = IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];

const OPTIMIZED = /^\/images\/([^/]+)\.(?:jpe?g|png)$/i;

/**
 * Foto's die het script overslaat en die hier dus geen variant hebben. Moet
 * gelijk blijven aan SKIP in scripts/optimize-images.mjs — zonder deze lijst
 * zou een verwijzing naar de deelafbeelding een pad opleveren dat nooit
 * geschreven is.
 */
const WITHOUT_VARIANTS = new Set([
  // Wordt als CSS-masker getoond, niet als <img>.
  "/images/logo.png",
  // Social media wil een echte JPEG op een vaste URL.
  "/images/og-image.jpg",
]);

/**
 * Zet een bronpad om naar de WebP-variant voor die breedte. Geeft het pad
 * ongewijzigd terug wanneer er geen varianten van bestaan (het logo, de
 * deelafbeelding, een externe URL) — dat is juister dan een 404 raden.
 */
export function optimizedImage(src: string, width: number): string {
  if (WITHOUT_VARIANTS.has(src)) return src;

  const match = OPTIMIZED.exec(src);

  if (!match) return src;

  const target =
    IMAGE_WIDTHS.find((candidate) => candidate >= width) ?? MAX_IMAGE_WIDTH;

  return `/images/opt/${match[1]}-${target}.webp`;
}
