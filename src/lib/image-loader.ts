"use client";

import { optimizedImage } from "@/lib/image-variants";

/**
 * Custom image-loader voor `next/image`.
 *
 * Bij `output: "export"` staat de ingebouwde optimizer van Next uit. Een eigen
 * loader is de weg die de documentatie daarvoor aanwijst: hij bepaalt zelf naar
 * welke URL `next/image` per breedte wijst. Hier zijn dat de WebP-varianten die
 * `scripts/optimize-images.mjs` vooraf schrijft.
 *
 * Daarmee komt er weer een echte `srcset` op de pagina: een telefoon haalt een
 * bestand van 640px op in plaats van de bron van 1400px, en `priority` blijft
 * gewoon een preload-hint opleveren voor de LCP.
 *
 * De directive staat er omdat Next de functie moet kunnen serialiseren naar de
 * client — zo schrijft de documentatie het voor. De naamgeving zelf staat in
 * `image-variants.ts`, omdat de sitemap hem ook nodig heeft.
 */
export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
}): string {
  return optimizedImage(src, width);
}
