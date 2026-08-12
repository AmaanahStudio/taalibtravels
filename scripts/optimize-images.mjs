/**
 * Genereert de responsieve WebP-varianten waar `next/image` naar wijst.
 *
 * Waarom dit bestaat: de site draait op `output: "export"`, en dan is de
 * ingebouwde image-optimizer van Next uitgeschakeld. Zonder deze stap zet
 * `next/image` een kale `<img>` zonder `srcset` neer en downloadt elke
 * bezoeker — ook op een telefoon — de volledige bronfoto van 1400px. Dat is op
 * de homepage ruim anderhalve megabyte.
 *
 * De oplossing is een custom loader (`src/lib/image-loader.ts`) die naar de
 * bestanden wijst die dit script vooraf schrijft:
 *
 *   public/images/bij-de-kaaba.jpg  ->  public/images/opt/bij-de-kaaba-640.webp
 *                                        public/images/opt/bij-de-kaaba-828.webp
 *                                        ...
 *
 * WebP en niet AVIF: statische hosting doet geen content-negotiation, dus de
 * loader kan maar één formaat teruggeven. WebP wordt overal ondersteund.
 *
 * Gebruik:
 *   node scripts/optimize-images.mjs
 *
 * Draait automatisch vóór `npm run dev` en `npm run build`. De uitvoer staat in
 * .gitignore: het zijn afgeleide bestanden, geen bron.
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "public", "images");
const OUTPUT_DIR = path.join(SOURCE_DIR, "opt");

/**
 * Moet gelijk blijven aan `deviceSizes` + `imageSizes` in next.config.ts en aan
 * WIDTHS in src/lib/image-loader.ts. Lopen die uit elkaar, dan vraagt de
 * browser een bestand op dat hier nooit geschreven is.
 */
const WIDTHS = [256, 384, 640, 750, 828, 1080, 1200, 1400];

/** Hoger = betere kwaliteit en groter bestand. 72–80 is een zinnig bereik. */
const QUALITY = 74;

/**
 * Bestanden die nooit via `next/image` geladen worden. Moet gelijk blijven aan
 * WITHOUT_VARIANTS in src/lib/image-variants.ts.
 */
const SKIP = new Set([
  // Wordt als CSS-masker getoond, niet als <img>.
  "logo.png",
  // Deelafbeelding voor social media; die vragen om een echte JPEG op een
  // vaste URL, niet om varianten.
  "og-image.jpg",
]);

const SOURCE_PATTERN = /\.(jpe?g|png)$/i;

if (!existsSync(SOURCE_DIR)) {
  throw new Error(`Bronmap ontbreekt: ${SOURCE_DIR}`);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const sources = readdirSync(SOURCE_DIR).filter(
  (file) => SOURCE_PATTERN.test(file) && !SKIP.has(file),
);

let written = 0;
let skipped = 0;

for (const file of sources) {
  const sourcePath = path.join(SOURCE_DIR, file);
  const sourceStat = statSync(sourcePath);
  const name = file.replace(SOURCE_PATTERN, "");

  const image = sharp(sourcePath);

  // Elke bron krijgt élke breedte uit WIDTHS. Dat houdt de loader een simpele
  // afbeelding zonder uitzonderingen: welke breedte hij ook kiest, het bestand
  // bestaat. `withoutEnlargement` zorgt dat een smallere bron niet opgeblazen
  // wordt — die levert dan gewoon een kleiner bestand onder dezelfde naam.
  for (const width of WIDTHS) {
    const outputPath = path.join(OUTPUT_DIR, `${name}-${width}.webp`);

    // Idempotent: alleen opnieuw encoderen wanneer de bron nieuwer is. Zo kost
    // een tweede build vrijwel niets.
    if (
      existsSync(outputPath) &&
      statSync(outputPath).mtimeMs >= sourceStat.mtimeMs
    ) {
      skipped += 1;
      continue;
    }

    await image
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outputPath);

    written += 1;
  }
}

console.log(
  `Foto's geoptimaliseerd: ${written} geschreven, ${skipped} ongewijzigd (${sources.length} bronbestanden).`,
);
