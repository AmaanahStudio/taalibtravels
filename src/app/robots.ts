import type { MetadataRoute } from "next";

import { SITE } from "@/lib/content";

// Verplicht bij `output: "export"`: zonder deze regel weigert de build een
// metadata-route te genereren, omdat hij die anders per request zou draaien.
export const dynamic = "force-static";

/*
 * Alles mag gecrawld worden. `/_next/` blijft bewust toegestaan: Google heeft
 * de JS en CSS daaruit nodig om de pagina te renderen zoals een bezoeker hem
 * ziet, en dichtzetten kost dus rankings in plaats van crawlbudget te sparen.
 *
 * De regels over de grootte van de miniatuur en het fragment (`max-image-preview`
 * en `max-snippet`) staan niet hier — robots.txt kent ze niet. Die zitten in de
 * `robots.googleBot`-metadata in src/app/layout.tsx.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
