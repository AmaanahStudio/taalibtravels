import type { MetadataRoute } from "next";

import { SITE, getContentPages, getTrips } from "@/lib/content";
import { MAX_IMAGE_WIDTH, optimizedImage } from "@/lib/image-variants";

// Verplicht bij `output: "export"`: zonder deze regel weigert de build een
// metadata-route te genereren, omdat hij die anders per request zou draaien.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // De site wordt statisch gebouwd, dus "nu" is het moment van de build. Dat is
  // precies wat `lastModified` hoort te zijn voor pagina's die geen eigen
  // wijzigingsdatum in de data hebben staan.
  const builtAt = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE.url,
      lastModified: builtAt,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE.url}/reizen`,
      lastModified: builtAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/veelgestelde-vragen`,
      lastModified: builtAt,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE.url}/contact`,
      lastModified: builtAt,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  /* De tekstpagina's dragen hun eigen `updatedAt`, dus die is nauwkeuriger. */
  const contentRoutes: MetadataRoute.Sitemap = getContentPages().map((page) => ({
    url: `${SITE.url}/${page.slug}`,
    lastModified: new Date(page.updatedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  /*
   * Bij de reizen gaan de foto's mee. Dat is de afbeeldingssitemap-uitbreiding
   * van Google: hij maakt de reisfoto's vindbaar in Google Afbeeldingen, een
   * ingang die voor een reissite zelden onbenut hoort te blijven.
   *
   * Genoemd wordt de WebP-variant en niet de bron-JPEG: alleen die eerste staat
   * ook echt op de pagina, en een afbeelding zonder pagina eromheen heeft in
   * Google Afbeeldingen weinig te vertellen.
   */
  const tripRoutes: MetadataRoute.Sitemap = getTrips().map((trip) => ({
    url: `${SITE.url}/reizen/${trip.slug}`,
    lastModified: trip.updatedAt ? new Date(trip.updatedAt) : builtAt,
    changeFrequency: "weekly",
    priority: 0.8,
    images: [trip.coverImage, ...trip.gallery].map(
      (image) => `${SITE.url}${optimizedImage(image.src, MAX_IMAGE_WIDTH)}`,
    ),
  }));

  return [...staticRoutes, ...contentRoutes, ...tripRoutes];
}
