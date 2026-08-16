import type { MetadataRoute } from "next";

import { SITE } from "@/lib/content";

// Verplicht bij `output: "export"`: zonder deze regel weigert de build een
// metadata-route te genereren, omdat hij die anders per request zou draaien.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin is het beheeroverzicht en /api levert alleen JSON: allebei zinloos
    // in een zoekresultaat. De echte afscherming is de sessiecontrole in de
    // Worker — dit houdt ze enkel uit de index.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
