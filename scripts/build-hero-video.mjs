/**
 * Bouwt de videocompilatie voor de hero op de homepage.
 *
 * Wat het doet:
 *   - neemt van elke bronvideo maximaal MAX_CLIP_SECONDS
 *   - zet alles om naar hetzelfde staande kader (WIDTH x HEIGHT, FPS)
 *   - plakt de fragmenten achter elkaar, zonder audiotrack
 *   - schrijft public/videos/hero-compilatie.mp4 en een bijpassend poster-frame
 *
 * Staande en liggende bronnen worden verschillend behandeld. Een staand
 * fragment wordt bijgesneden tot het kader vol is. Een liggend fragment zou
 * daarbij ruim de helft van het beeld verliezen, dus dat wordt passend
 * geschaald met een uitvergrote, vervaagde kopie van zichzelf als achtergrond.
 *
 * Gebruik:
 *   node scripts/build-hero-video.mjs
 *
 * Vereist ffmpeg. Het script zoekt eerst `ffmpeg` in PATH en valt anders terug
 * op het npm-pakket `ffmpeg-static` (npm i -D ffmpeg-static).
 *
 * Nieuwe montage? Pas SOURCE_DIR en SOURCES aan — dat zijn de enige lijsten
 * die tellen.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Maximale duur per fragment. Kortere video's worden in hun geheel gebruikt. */
const MAX_CLIP_SECONDS = 8;

/** Uitvoerformaat: staand 4:5, gelijk aan de hero-card op de site. */
const WIDTH = 720;
const HEIGHT = 900;
const FPS = 30;

/**
 * Hoger = kleiner bestand, lager = betere kwaliteit. 28–32 is een zinnig bereik.
 * De video speelt automatisch af, dus elke bezoeker downloadt hem: houd het
 * eindbestand bij voorkeur onder ~5 MB.
 */
const CRF = 32;

/**
 * Seconde waaruit het poster-frame gegrepen wordt. Kies een moment in een
 * staand fragment: dat vult het kader, terwijl een liggend fragment balken
 * heeft — en dit frame is het eerste wat elke bezoeker ziet.
 */
const POSTER_AT = 3;

const DOWNLOADS = "C:/Users/muham/Downloads";
const CLIPS_DIR = path.join(DOWNLOADS, "wetransfer_img_0081-mov_2026-08-01_1936");

/**
 * Volgorde van de fragmenten. De compilatie opent staand, zodat het beeld
 * meteen het hele kader vult, en het enige liggende fragment staat achteraan.
 */
const SOURCES = [
  path.join(CLIPS_DIR, "IMG_0413.mov"), // staand — les in de moskee
  path.join(CLIPS_DIR, "IMG_1076.mov"), // staand — deur van de Kaaba
  path.join(CLIPS_DIR, "IMG_0345.mov"), // staand — minaretten
  path.join(DOWNLOADS, "WhatsApp Video 2026-07-26 at 20.50.07.mp4"), // staand
  path.join(CLIPS_DIR, "IMG_0229.mov"), // staand
  path.join(CLIPS_DIR, "IMG_0207.mov"), // liggend — avond
];

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

/**
 * Leest de weergave-afmetingen uit. Telefoons slaan staand beeld vaak liggend
 * op met een rotatievlag; ffmpeg draait dat bij het decoderen recht, dus de
 * opgeslagen afmetingen zeggen op zichzelf niets over de oriëntatie.
 */
function isPortrait(ffmpeg, file) {
  let out = "";
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
  } catch (err) {
    out = String(err.stderr ?? "");
  }

  const line = out.split("\n").find((l) => l.includes("Video:")) ?? "";
  const dims = line.match(/, (\d{2,5})x(\d{2,5})/);
  const rotated = /displaymatrix: rotation of -?(90|270)/.test(out);

  if (!dims) throw new Error(`Kon de afmetingen van ${path.basename(file)} niet lezen.`);

  const [w, h] = rotated
    ? [Number(dims[2]), Number(dims[1])]
    : [Number(dims[1]), Number(dims[2])];

  return h > w;
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

const inputArgs = SOURCES.flatMap((file) => [
  "-t",
  String(MAX_CLIP_SECONDS),
  "-i",
  file,
]);

const normalise = SOURCES.map((file, i) => {
  const common = `fps=${FPS},setsar=1,format=yuv420p`;

  if (isPortrait(ffmpeg, file)) {
    // Vult het kader; er gaat alleen wat boven- en onderkant af.
    return (
      `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${WIDTH}:${HEIGHT},${common}[v${i}]`
    );
  }

  // Liggend: volledig beeld in het midden, vervaagde uitsnede erachter.
  return (
    `[${i}:v]split=2[bg${i}][fg${i}];` +
    `[bg${i}]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,` +
    `crop=${WIDTH}:${HEIGHT},gblur=sigma=28[bgb${i}];` +
    `[fg${i}]scale=${WIDTH}:-2[fgs${i}];` +
    `[bgb${i}][fgs${i}]overlay=(W-w)/2:(H-h)/2,${common}[v${i}]`
  );
}).join(";");

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
