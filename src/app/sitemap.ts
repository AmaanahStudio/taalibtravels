import type { MetadataRoute } from "next";

import { SITE, getTrips } from "@/lib/content";

// Verplicht bij `output: "export"`: zonder deze regel weigert de build een
// metadata-route te genereren, omdat hij die anders per request zou draaien.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/reizen`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/giveaway`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    // /admin staat er bewust niet in: dat is geen pagina voor bezoekers.
  ];

  const tripRoutes: MetadataRoute.Sitemap = getTrips().map((trip) => ({
    url: `${SITE.url}/reizen/${trip.slug}`,
    lastModified: trip.updatedAt ? new Date(trip.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...tripRoutes];
}
