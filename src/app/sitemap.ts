import type { MetadataRoute } from "next";

import { SITE, getTrips } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/reizen`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const tripRoutes: MetadataRoute.Sitemap = getTrips().map((trip) => ({
    url: `${SITE.url}/reizen/${trip.slug}`,
    lastModified: new Date(trip.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...tripRoutes];
}
