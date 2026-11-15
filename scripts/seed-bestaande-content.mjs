/**
 * Zet de bestaande foto's en reizen (JSON in `src/data`) over naar R2 en D1.
 *
 *   npm run seed -- --local
 *   npm run seed -- --remote
 *
 * Vereist Node >= 22.18: het script importeert `src/lib/reizen.ts` rechtstreeks,
 * zodat de seed exact dezelfde validatie doorloopt als de Worker. Node haalt de
 * typen daarbij zelf weg; er is geen extra dependency voor nodig.
 *
 * Idempotent: R2-objecten worden overschreven met identieke inhoud, rijen gaan
 * erin met `ON CONFLICT DO NOTHING`. Een tweede run verandert dus niets, en wat
 * de beheerder inmiddels in het portaal wijzigde blijft staan.
 *
 * Eerst valideren, dan pas schrijven: één foute reis breekt af vóór er iets
 * naar R2 of D1 gaat.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { valideerReis } from "../src/lib/reizen.ts";
import { ALL_WIDTHS, WEBP_QUALITY } from "./image-sizes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "src", "data");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DATABASE = "taalibtravels-leads";
const BUCKET = "taalibtravels-media";

const modus = process.argv.includes("--remote")
  ? "--remote"
  : process.argv.includes("--local")
    ? "--local"
    : null;
if (!modus) {
  console.error("Gebruik: node scripts/seed-bestaande-content.mjs --local|--remote");
  process.exit(1);
}

const leesJson = async (...delen) =>
  JSON.parse(await fs.readFile(path.join(DATA, ...delen), "utf8"));

/**
 * Wrangler draait zonder shell, dus er valt niets te injecteren via bestandsnamen.
 * Eén keer per ~200 aanroepen faalt wrangler op een netwerkcheck die met de
 * eigenlijke opdracht niets te maken heeft; vandaar de herpoging. Alles wat we
 * uitvoeren is idempotent, dus opnieuw proberen is veilig.
 */
function wrangler(args, pogingen = 3) {
  for (let poging = 1; ; poging += 1) {
    try {
      return execFileSync(process.execPath, [WRANGLER, ...args], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      });
    } catch (fout) {
      if (poging >= pogingen) throw fout;
      console.warn(`wrangler faalde (poging ${poging}/${pogingen}), opnieuw...`);
    }
  }
}

/** SQL-tekstliteral: aanhalingstekens verdubbeld, NUL-bytes geweigerd. */
function sqlTekst(waarde) {
  if (waarde === null || waarde === undefined) return "NULL";
  const tekst = String(waarde);
  if (tekst.includes("\0")) throw new Error("Tekst bevat een NUL-teken.");
  return `'${tekst.replaceAll("'", "''")}'`;
}

function sqlGetal(waarde) {
  if (waarde === null || waarde === undefined) return "NULL";
  if (!Number.isFinite(waarde)) throw new Error(`Geen geldig getal: ${waarde}`);
  return String(waarde);
}

async function main() {
  const [images, galerijIds, inclusies] = await Promise.all([
    leesJson("images.json"),
    leesJson("gallery.json"),
    leesJson("inclusions.json"),
  ]);
  // Direct uit de map: `trips/index.ts` importeert JSON zonder import-attributen,
  // wat Node niet slikt. Het register is alleen nodig voor de bundler van de site.
  const tripMap = path.join(DATA, "trips");
  const TRIP_FILES = await Promise.all(
    (await fs.readdir(tripMap))
      .filter((naam) => naam.endsWith(".json"))
      .sort()
      .map((naam) => leesJson("trips", naam)),
  );

  // 1. Reizen valideren, nog zonder iets te schrijven.
  const reizen = [];
  for (const ruw of TRIP_FILES) {
    const resultaat = valideerReis({
      ...ruw,
      inclusions: ruw.inclusions.map((id) => {
        const inclusie = inclusies[id];
        if (!inclusie) throw new Error(`Reis ${ruw.slug}: onbekende inclusie "${id}".`);
        return inclusie;
      }),
    });
    if (!resultaat.ok) {
      console.error(`Reis ${ruw.slug} is ongeldig:`, resultaat.fouten);
      process.exit(1);
    }
    reizen.push(resultaat.reis);
  }

  const bekend = (id, waar) => {
    if (!images[id]) throw new Error(`${waar}: onbekende foto "${id}".`);
  };
  galerijIds.forEach((id) => bekend(id, "gallery.json"));
  for (const reis of reizen) {
    bekend(reis.coverImage, reis.slug);
    reis.gallery?.forEach((id) => bekend(id, reis.slug));
  }
  if (galerijIds.length !== 6) throw new Error("gallery.json telt geen zes foto's.");

  // 2. Varianten genereren en naar R2 uploaden.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "seed-fotos-"));
  try {
    for (const [id, foto] of Object.entries(images)) {
      const bron = path.join(ROOT, "public", foto.src.replace(/^\//, ""));
      // Elke breedte uit de ladder krijgt een bestand, ook als de bron smaller is:
      // next/image vraagt ze allemaal op. Nooit opschalen, dus zo'n variant komt
      // op de bronbreedte uit (zelfde aanpak als build-images.mjs).
      const breedtes = ALL_WIDTHS;
      for (const breedte of breedtes) {
        const bestand = path.join(tmp, `${id}-${breedte}.webp`);
        await sharp(bron)
          .resize({ width: Math.min(breedte, foto.width), withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toFile(bestand);
        wrangler([
          "r2", "object", "put", `${BUCKET}/fotos/${id}/${breedte}.webp`,
          "--file", bestand, "--content-type", "image/webp", modus,
        ]);
      }
      console.log(`foto ${id}: ${breedtes.length} varianten`);
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }

  // 3. Rijen invoegen via een tijdelijk SQL-bestand.
  const nu = new Date().toISOString();
  const sql = [];
  for (const [id, foto] of Object.entries(images)) {
    sql.push(
      `INSERT INTO afbeeldingen (id, r2_sleutel, alt, width, height, aangemaakt) VALUES (${sqlTekst(id)}, ${sqlTekst(`fotos/${id}`)}, ${sqlTekst(foto.alt)}, ${sqlGetal(foto.width)}, ${sqlGetal(foto.height)}, ${sqlTekst(nu)}) ON CONFLICT DO NOTHING;`,
    );
  }
  for (const r of reizen) {
    sql.push(
      `INSERT INTO reizen (slug, title, subtitle, summary, description, departure_date, return_date, price_amount, price_installments, price_note, inclusions, cover_image, gallery, audience, status, spots_total, spots_left, updated_at) VALUES (${[
        sqlTekst(r.slug),
        sqlTekst(r.title),
        sqlTekst(r.subtitle),
        sqlTekst(r.summary),
        sqlTekst(JSON.stringify(r.description)),
        sqlTekst(r.departureDate),
        sqlTekst(r.returnDate),
        sqlGetal(r.price.amount),
        r.price.installmentsAvailable ? 1 : 0,
        sqlTekst(r.price.note ?? null),
        sqlTekst(JSON.stringify(r.inclusions)),
        sqlTekst(r.coverImage),
        sqlTekst(r.gallery ? JSON.stringify(r.gallery) : null),
        sqlTekst(r.audience),
        sqlTekst(r.status),
        sqlGetal(r.spotsTotal),
        sqlGetal(r.spotsLeft),
        sqlTekst(nu),
      ].join(", ")}) ON CONFLICT DO NOTHING;`,
    );
  }
  galerijIds.forEach((id, i) => {
    sql.push(
      `INSERT INTO galerij (positie, afbeelding_id) VALUES (${i + 1}, ${sqlTekst(id)}) ON CONFLICT DO NOTHING;`,
    );
  });

  const sqlBestand = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "seed-sql-")), "seed.sql");
  try {
    await fs.writeFile(sqlBestand, sql.join("\n"), "utf8");
    wrangler(["d1", "execute", DATABASE, modus, `--file=${sqlBestand}`]);
  } finally {
    await fs.rm(path.dirname(sqlBestand), { recursive: true, force: true });
  }

  console.log(
    `Klaar: ${Object.keys(images).length} foto's, ${reizen.length} reizen, ${galerijIds.length} galerijplekken.`,
  );
}

main().catch((fout) => {
  console.error(fout.message);
  process.exit(1);
});
