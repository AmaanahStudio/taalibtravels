/**
 * Genereert eenvoudige, donkere placeholder-foto's voor TaalibTravels.
 * De echte foto's worden later door de klant vervangen; bestandsnamen blijven gelijk.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "images");
mkdirSync(OUT, { recursive: true });

/** @param {{name:string,w:number,h:number,a:string,b:string,glow:string}} spec */
function svg({ w, h, a, b, glow }) {
  const r = Math.max(w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="100%" stop-color="${b}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.72" cy="0.22" r="0.75">
      <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="${glow}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.18" cy="0.85" r="0.7">
      <stop offset="0%" stop-color="#93c9ea" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#93c9ea" stop-opacity="0"/>
    </radialGradient>
    <pattern id="lines" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="34" height="34" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="34" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1.5"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#base)"/>
  <rect width="${w}" height="${h}" fill="url(#lines)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect width="${w}" height="${h}" fill="url(#glow2)"/>
  <g fill="none" stroke="#eaf1f7" stroke-opacity="0.14" stroke-width="${Math.round(r / 260)}">
    <circle cx="${w * 0.74}" cy="${h * 0.3}" r="${r * 0.16}"/>
    <circle cx="${w * 0.74}" cy="${h * 0.3}" r="${r * 0.27}"/>
  </g>
  <g fill="#090c11" fill-opacity="0.28">
    <path d="M0 ${h} L${w * 0.28} ${h * 0.62} L${w * 0.52} ${h} Z"/>
    <path d="M${w * 0.42} ${h} L${w * 0.72} ${h * 0.5} L${w} ${h * 0.78} L${w} ${h} Z"/>
  </g>
</svg>`;
}

/*
 * Alle tinten blijven binnen het blauwe palet van de site (zie globals.css).
 * De hero gebruikt geen placeholder meer maar een video; het poster-frame
 * daarvan (`hero-poster.jpg`) komt uit de video zelf en staat hier dus niet.
 */
const specs = [
  { name: "og-image", w: 1200, h: 630, a: "#141d29", b: "#090c11", glow: "#5fabd8" },

  // Fotogalerij (6 stuks, net als op de poster)
  { name: "gallery-1", w: 1200, h: 900, a: "#12212b", b: "#090e14", glow: "#5fabd8" },
  { name: "gallery-2", w: 1200, h: 900, a: "#1a2433", b: "#090c11", glow: "#93c9ea" },
  { name: "gallery-3", w: 1200, h: 900, a: "#14232a", b: "#080d10", glow: "#4ec2c8" },
  { name: "gallery-4", w: 1200, h: 900, a: "#1b2130", b: "#0a0c12", glow: "#7fa8d8" },
  { name: "gallery-5", w: 1200, h: 900, a: "#161e2e", b: "#080b12", glow: "#3d8bbd" },
  { name: "gallery-6", w: 1200, h: 900, a: "#1d2636", b: "#0b0e15", glow: "#a9d4ee" },

  // Cover-afbeeldingen per reis
  { name: "trip-umrah-budget", w: 1200, h: 800, a: "#152230", b: "#090c11", glow: "#5fabd8" },
  { name: "trip-umrah-comfort", w: 1200, h: 800, a: "#111d2b", b: "#080b0f", glow: "#4a90c8" },
  { name: "trip-umrah-ramadan", w: 1200, h: 800, a: "#151b30", b: "#080a12", glow: "#6f8fd1" },
  { name: "trip-umrah-winter", w: 1200, h: 800, a: "#132428", b: "#080d0e", glow: "#4ec2c0" },
];

await Promise.all(
  specs.map(async (spec) => {
    const file = path.join(OUT, `${spec.name}.jpg`);
    await sharp(Buffer.from(svg(spec)))
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(file);
    console.log("✔", `${spec.name}.jpg`, `${spec.w}x${spec.h}`);
  })
);
