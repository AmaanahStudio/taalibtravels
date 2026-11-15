import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Standaardconfig. Geen incrementele cache (R2): de pagina's zijn dynamisch
// of worden bij de build al gerenderd, dus er is niets om te cachen.
export default defineCloudflareConfig();
