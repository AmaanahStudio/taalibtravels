/**
 * Maakt de webvariant van de hero-compilatie: `hero-compilatie.webm` (VP9).
 *
 * Waarom apart van `build-hero-video.mjs`: dat script monteert de compilatie uit
 * de losse clips in `CLIPS_DIR`, een map die alleen op de machine van de montage
 * staat. Dit script heeft die clips niet nodig — het gaat uit van de al
 * gepubliceerde `hero-compilatie.mp4` en zet die om.
 *
 * De MP4 blijft ongemoeid en is dus de master: hij is na het verdwijnen van de
 * bronclips het enige origineel dat er nog is, én de fallback voor Safari-versies
 * zonder WebM. Dit script schrijft uitsluitend een nieuw bestand.
 *
 * Volgorde in de hero: eerst de WebM, dan de MP4. Browsers nemen de eerste bron
 * die ze aankunnen, dus vrijwel iedereen krijgt de kleine variant.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

import { WEBP_QUALITY } from "./image-sizes.mjs";

const run = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_DIR = path.join(ROOT, "public", "videos");
const IMAGE_DIR = path.join(ROOT, "public", "images");
const BRON = path.join(VIDEO_DIR, "hero-compilatie.mp4");
const DOEL = path.join(VIDEO_DIR, "hero-compilatie.webm");
const POSTER_JPG = path.join(IMAGE_DIR, "hero-poster.jpg");
const POSTER_WEBP = path.join(IMAGE_DIR, "hero-poster.webp");

/**
 * 30 → 24 fps. Het is een rustige montage met langzame beelden; het verschil is
 * niet te zien, maar het scheelt een vijfde van de frames.
 */
const FPS = 24;

/**
 * Constante kwaliteit voor VP9 (schaal 0–63, hoger = kleiner).
 *
 * Let op: deze schaal is níét te vergelijken met de CRF van x264 in
 * `build-hero-video.mjs`. Die staat op 32; met VP9 op 38 werd het bestand
 * juist bijna twee keer zo groot als de MP4, omdat VP9 dan bits besteedt aan
 * het natekenen van de compressieartefacten van x264.
 *
 * 52 is bij deze montage gemeten als het punt waarop de WebM ongeveer een derde
 * kleiner is dan de MP4 bij gelijk ogende beeldkwaliteit — het gouden
 * kalligrafiewerk op de kiswah blijft scherp. Lager kost meteen veel bytes,
 * hoger maakt juist die fijne details zichtbaar zachter.
 */
const CRF = 52;

async function main() {
  const bronBytes = (await fs.stat(BRON)).size;

  console.log(
    `build-hero-web: ${path.basename(BRON)} (${(bronBytes / 1024 / 1024).toFixed(2)} MB) → WebM/VP9 …`,
  );

  await run(
    ffmpeg,
    [
      "-y",
      "-i", BRON,
      "-c:v", "libvpx-vp9",
      "-crf", String(CRF),
      // Verplicht bij CRF: zonder deze regel leest libvpx het als een bovengrens
      // voor de bitrate en levert het alsnog een veel groter bestand.
      "-b:v", "0",
      "-r", String(FPS),
      // Meerdere threads over rijen én tegels; anders duurt VP9 onnodig lang.
      "-row-mt", "1",
      "-tile-columns", "1",
      "-cpu-used", "2",
      "-deadline", "good",
      "-pix_fmt", "yuv420p",
      // De montage heeft geen audiospoor; dit houdt het zo.
      "-an",
      DOEL,
    ],
    { maxBuffer: 1024 * 1024 * 32 },
  );

  const doelBytes = (await fs.stat(DOEL)).size;
  const winst = (100 - (doelBytes / bronBytes) * 100).toFixed(0);

  console.log(
    `build-hero-web: ${path.basename(DOEL)} = ${(doelBytes / 1024 / 1024).toFixed(2)} MB (${winst}% kleiner)`,
  );

  /*
   * Het poster-frame gaat niet door `build-images.mjs` heen: het staat niet in
   * images.json en wordt niet door next/image getoond, maar als `poster`-attribuut
   * op de video. Toch is het het zwaarste onderdeel van de eerste weergave
   * geworden — het is letterlijk het eerste beeld dat een bezoeker ziet — dus
   * hier alsnog een WebP naast de JPEG. De JPEG blijft als origineel staan.
   */
  const posterVoor = (await fs.stat(POSTER_JPG)).size;
  await sharp(POSTER_JPG).webp({ quality: WEBP_QUALITY }).toFile(POSTER_WEBP);
  const posterNa = (await fs.stat(POSTER_WEBP)).size;

  console.log(
    `build-hero-web: ${path.basename(POSTER_WEBP)} = ${Math.round(posterNa / 1024)} KB ` +
      `(was ${Math.round(posterVoor / 1024)} KB als JPEG)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
