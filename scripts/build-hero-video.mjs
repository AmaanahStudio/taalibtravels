/**
 * Bouwt de videocompilatie voor de hero op de homepage.
 *
 * Wat het doet:
 *   - neemt van elke bronvideo maximaal MAX_CLIP_SECONDS
 *   - zet alles om naar hetzelfde portretformaat (576x1024, 30 fps)
 *   - plakt de fragmenten achter elkaar, zonder audiotrack
 *   - schrijft public/videos/hero-compilatie.mp4 en een bijpassend poster-frame
 *
 * Gebruik:
 *   node scripts/build-hero-video.mjs
 *
 * Vereist ffmpeg. Het script zoekt eerst `ffmpeg` in PATH en valt anders terug
 * op het npm-pakket `ffmpeg-static` (npm i -D ffmpeg-static).
 *
 * Nieuwe montage? Pas SOURCES aan — dat is de enige lijst die telt.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Maximale duur per fragment. Kortere video's worden in hun geheel gebruikt. */
const MAX_CLIP_SECONDS = 10;

/** Uitvoerformaat: staand, zoals de hero-card op de site. */
const WIDTH = 576;
const HEIGHT = 1024;
const FPS = 30;

/** Hoger = kleiner bestand, lager = betere kwaliteit. 28–32 is een zinnig bereik. */
const CRF = 30;

/** Seconde waaruit het poster-frame gegrepen wordt. */
const POSTER_AT = 2;

const SOURCE_DIR = "C:/Users/muham/Downloads";

/** Volgorde van de fragmenten in de compilatie. */
const SOURCES = [
  "WhatsApp Video 2026-07-26 at 22.07.06.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.10.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.11.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.12.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.13.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.14.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.15.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.16.mp4",
  "WhatsApp Video 2026-07-26 at 22.07.18.mp4",
  "WhatsApp Video 2026-07-26 at 20.50.07.mp4",
].map((name) => path.join(SOURCE_DIR, name));

function findFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    // Niet in PATH — probeer ffmpeg-static.
  }
  try {
    const require = createRequire(import.meta.url);
    return require("ffmpeg-static");
  } catch {
    throw new Error(
      "ffmpeg niet gevonden. Installeer ffmpeg, of voer `npm i -D ffmpeg-static` uit.",
    );
  }
}

const missing = SOURCES.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error("Deze bronbestanden ontbreken:");
  for (const file of missing) console.error("  -", file);
  process.exit(1);
}

const ffmpeg = findFfmpeg();
const outDir = path.join(ROOT, "public", "videos");
const videoOut = path.join(outDir, "hero-compilatie.mp4");
const posterOut = path.join(ROOT, "public", "images", "hero-poster.jpg");
mkdirSync(outDir, { recursive: true });

/*
 * Elk fragment wordt eerst genormaliseerd: schalen tot het kader gevuld is,
 * bijsnijden naar het midden, en gelijktrekken qua framerate en pixelformaat.
 * Zonder die stap weigert `concat` bronnen met afwijkende afmetingen.
 * ffmpeg past de rotatie uit de metadata automatisch toe bij het decoderen.
 */
const inputArgs = SOURCES.flatMap((file) => [
  "-t",
  String(MAX_CLIP_SECONDS),
  "-i",
  file,
]);

const normalise = SOURCES.map(
  (_, i) =>
    `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT},fps=${FPS},setsar=1,format=yuv420p[v${i}]`,
).join(";");

const concat =
  SOURCES.map((_, i) => `[v${i}]`).join("") +
  `concat=n=${SOURCES.length}:v=1:a=0[out]`;

console.log(`Bouwen uit ${SOURCES.length} fragmenten van max ${MAX_CLIP_SECONDS}s…`);

execFileSync(
  ffmpeg,
  [
    "-hide_banner",
    "-loglevel", "error",
    "-stats",
    ...inputArgs,
    "-filter_complex", `${normalise};${concat}`,
    "-map", "[out]",
    "-an",
    "-c:v", "libx264",
    "-crf", String(CRF),
    "-preset", "slow",
    "-profile:v", "high",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-y", videoOut,
  ],
  { stdio: "inherit" },
);

// Poster-frame uit de compilatie zelf, zodat het beeld niet springt bij de start.
execFileSync(
  ffmpeg,
  [
    "-hide_banner",
    "-loglevel", "error",
    "-ss", String(POSTER_AT),
    "-i", videoOut,
    "-frames:v", "1",
    "-q:v", "4",
    "-y", posterOut,
  ],
  { stdio: "inherit" },
);

console.log("\nKlaar:");
console.log("  ", path.relative(ROOT, videoOut));
console.log("  ", path.relative(ROOT, posterOut));
