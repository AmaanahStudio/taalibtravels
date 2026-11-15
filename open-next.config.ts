import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Standaardconfig, bewust zonder incrementele cache (R2). Pagina's die uit D1
// lezen moeten dus `force-dynamic` zijn; vooraf gerenderde pagina's krijgen
// `s-maxage=31536000` en blijven tot de volgende build staan.
export default defineCloudflareConfig();
