import type { MetadataRoute } from "next";

import { SITE, getTrips } from "@/lib/content";

// Verplicht bij `output: "export"`: zonder deze regel weigert de build een
// metadata-route te genereren, omdat hij die anders per request zou draaien.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/reizen`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const tripRoutes: MetadataRoute.Sitemap = getTrips().map((trip) => ({
    url: `${SITE.url}/reizen/${trip.slug}`,
    lastModified: trip.updatedAt ? new Date(trip.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...tripRoutes];
}
