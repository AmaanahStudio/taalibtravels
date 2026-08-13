/**
 * Genereert de WebP-varianten waar `src/lib/image-loader.ts` naar verwijst.
 *
 * Draait automatisch vóór `next build` (zie het `prebuild`-script). De bronnen
 * staan in `public/images`, de varianten in `public/images/generated` — die map
 * is gegenereerd en staat daarom in .gitignore.
 *
 * Waarom: de bronfoto's zijn 1400 tot 1600px breed en 100–300 KB per stuk. Een
 * galerijtegel is op een telefoon nog geen 200px breed. Zonder varianten laadt
 * elk toestel de volle resolutie, want een statische export heeft geen
 * beeldoptimalisatie op de server.
 *
 * Het script is incrementeel: een variant die al bestaat en nieuwer is dan zijn
 * bron wordt overgeslagen. Een tweede build kost daardoor vrijwel niets.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { ALL_WIDTHS, OUTPUT_DIR, WEBP_QUALITY } from "./image-sizes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(PUBLIC_DIR, OUTPUT_DIR);
const IMAGES_JSON = path.join(ROOT, "src", "data", "images.json");

/** Laatste wijziging van een bestand, of 0 als het niet bestaat. */
async function mtime(file) {
  try {
    return (await fs.stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

async function main() {
  const images = JSON.parse(await fs.readFile(IMAGES_JSON, "utf8"));
  await fs.mkdir(OUT_DIR, { recursive: true });

  let geschreven = 0;
  let overgeslagen = 0;
  let totaal = 0;

  for (const [id, image] of Object.entries(images)) {
    const bron = path.join(PUBLIC_DIR, image.src.replace(/^\//, ""));
    const naam = path.basename(image.src, path.extname(image.src));
    const bronTijd = await mtime(bron);

    if (bronTijd === 0) {
      throw new Error(
        `images.json: foto "${id}" verwijst naar ${image.src}, maar dat bestand bestaat niet.`,
      );
    }

    const { width: bronBreedte } = await sharp(bron).metadata();

    for (const breedte of ALL_WIDTHS) {
      const doel = path.join(OUT_DIR, `${naam}-${breedte}.webp`);
      const doelTijd = await mtime(doel);

      if (doelTijd > bronTijd) {
        overgeslagen += 1;
        totaal += (await fs.stat(doel)).size;
        continue;
      }

      // Nooit opschalen: is de bron smaller dan de gevraagde breedte, dan komt
      // de variant op de bronbreedte uit. De bestandsnaam houdt wél de gevraagde
      // breedte aan, zodat elke breedte uit de ladder gegarandeerd bestaat en de
      // loader nooit naar een ontbrekend bestand wijst.
      await sharp(bron)
        .resize({ width: Math.min(breedte, bronBreedte), withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(doel);

      geschreven += 1;
      totaal += (await fs.stat(doel)).size;
    }
  }

  const mb = (totaal / 1024 / 1024).toFixed(1);
  console.log(
    `build-images: ${geschreven} nieuw, ${overgeslagen} ongewijzigd — ${mb} MB in public/${OUTPUT_DIR}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
