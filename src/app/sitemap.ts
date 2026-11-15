import type { MetadataRoute } from "next";

import { SITE } from "@/lib/content";
import { getTrips } from "@/lib/trips";

// Per verzoek uit D1, zodat een nieuwe reis meteen in de sitemap staat.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/reizen`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/giveaway`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    // /admin staat er bewust niet in: dat is geen pagina voor bezoekers.
  ];

  const tripRoutes: MetadataRoute.Sitemap = (await getTrips()).map((trip) => ({
    url: `${SITE.url}/reizen/${trip.slug}`,
    lastModified: trip.updatedAt ? new Date(trip.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...tripRoutes];
}
