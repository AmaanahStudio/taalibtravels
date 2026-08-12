import type { MetadataRoute } from "next";

import { SITE } from "@/lib/content";

// Verplicht bij `output: "export"`: zonder deze regel weigert de build een
// metadata-route te genereren, omdat hij die anders per request zou draaien.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
