/**
 * Schrijft `public/_headers` uit `worker/beveiligingsheaders.ts`.
 *
 * Draait als `prebuild`, dus vóór elke `next build` — ook die binnen
 * `opennextjs-cloudflare build`. Daarmee krijgen de statische bestanden exact
 * dezelfde CSP als de pagina's die de Worker maakt; zie het commentaar in
 * `beveiligingsheaders.ts` voor waarom er twee wegen zijn.
 *
 * `public/_headers` is daardoor gegenereerd en staat in .gitignore: wie hem met
 * de hand wijzigt, ziet die wijziging bij de volgende build verdwijnen.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HEADER_REGELS } from "../worker/beveiligingsheaders.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOEL = path.join(ROOT, "public", "_headers");

const regels = [
  "# GEGENEREERD door scripts/build-headers.mjs uit worker/beveiligingsheaders.ts.",
  "# Niet met de hand wijzigen: de volgende build overschrijft dit bestand.",
];

for (const { pad, uitleg, headers } of HEADER_REGELS) {
  regels.push("", `# ${uitleg}`, pad);
  for (const [naam, waarde] of Object.entries(headers)) {
    // Een regeleinde in een waarde zou een nieuwe regel in _headers beginnen.
    if (/[\r\n]/.test(waarde)) throw new Error(`Header ${naam} bevat een regeleinde.`);
    regels.push(`  ${naam}: ${waarde}`);
  }
}

await fs.writeFile(DOEL, `${regels.join("\n")}\n`);
console.log(`public/_headers: ${HEADER_REGELS.length} regels geschreven.`);
