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
 * Herhaalbaar, maar let op het verschil tussen R2 en D1:
 *  - D1-rijen worden NOOIT overschreven (`ON CONFLICT DO NOTHING`). Een tikfout
 *    in de JSON herstellen en opnieuw draaien verandert in D1 dus niets; wat de
 *    beheerder inmiddels in het portaal wijzigde blijft zo ook staan.
 *  - R2-varianten worden WEL overschreven, elke run opnieuw. Per foto zijn dat de
 *    WebP-ladder en `og.jpg`; draai opnieuw om og.jpg bij te maken.
 *
 * Eerst valideren, dan pas schrijven: één foute reis breekt af vóór er iets
 * naar R2 of D1 gaat.
 *
 * Elke wrangler-aanroep heeft een time-out en draait niet-interactief; een
 * blijvend falende aanroep breekt het script af met de naam van het bestand.
 * Opnieuw draaien is dan veilig. Omgevingsvariabelen (voor testen):
 *  - SEED_WRANGLER     pad naar een ander wrangler-script (standaard: node_modules)
 *  - SEED_TIMEOUT_MS   time-out per aanroep in ms (standaard 120000)
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { ALL_WIDTHS, OG_BREEDTE, OG_KWALITEIT, WEBP_QUALITY } from "./image-sizes.mjs";

// Vóór de import van reizen.ts: op een te oude Node zou die met een cryptische
// syntaxfout stranden in plaats van met deze melding.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`Dit script vereist Node 22.18 of nieuwer; dit is ${process.versions.node}.`);
  process.exit(1);
}
const { GALERIJ_AANTAL, valideerReis } = await import("../src/lib/reizen.ts");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "src", "data");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DATABASE = "taalibtravels-leads";
const BUCKET = "taalibtravels-media";
const WRANGLER_SCRIPT = process.env.SEED_WRANGLER || WRANGLER;
const TIMEOUT_MS = Number(process.env.SEED_TIMEOUT_MS) || 120_000;

// Alleen wat wrangler nodig heeft (pad, profielmap voor de login, Cloudflare-token),
// niet de rest van de omgeving. CI=true schakelt prompts en de update-check uit.
const DOORGEGEVEN = /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|COMSPEC|WINDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|TMPDIR|XDG_.*|HTTPS?_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|CLOUDFLARE_.*|WRANGLER_.*)$/i;
const WRANGLER_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([naam]) => DOORGEGEVEN.test(naam))),
  CI: "true",
  NO_COLOR: "1",
  WRANGLER_SEND_METRICS: "false",
};

const lokaal = process.argv.includes("--local");
const extern = process.argv.includes("--remote");
if (lokaal === extern) {
  console.error(
    "Gebruik: node scripts/seed-bestaande-content.mjs --local|--remote (precies één van de twee)",
  );
  process.exit(1);
}
const modus = extern ? "--remote" : "--local";

const leesJson = async (...delen) =>
  JSON.parse(await fs.readFile(path.join(DATA, ...delen), "utf8"));

/**
 * Wrangler draait zonder shell, dus er valt niets te injecteren via bestandsnamen.
 * Eén keer per ~200 aanroepen faalt wrangler op een netwerkcheck die met de
 * eigenlijke opdracht niets te maken heeft; vandaar de herpoging. Alles wat we
 * uitvoeren is idempotent, dus opnieuw proberen is veilig. Een hangende aanroep
 * wordt na TIMEOUT_MS gedood en telt als mislukte poging.
 */
function wrangler(args, label, pogingen = 3) {
  for (let poging = 1; ; poging += 1) {
    try {
      return execFileSync(process.execPath, [WRANGLER_SCRIPT, ...args], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
        env: WRANGLER_ENV,
        timeout: TIMEOUT_MS,
        killSignal: "SIGKILL",
      });
    } catch (fout) {
      const oorzaak = fout.code === "ETIMEDOUT" ? `geen antwoord na ${TIMEOUT_MS / 1000}s` : "mislukt";
      if (poging >= pogingen) {
        throw new Error(
          `${label}: wrangler ${oorzaak} na ${pogingen} pogingen. Het script is veilig opnieuw te draaien.`,
        );
      }
      console.warn(`${label}: wrangler ${oorzaak} (poging ${poging}/${pogingen}), opnieuw...`);
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
  const begin = Date.now();
  const [images, galerijIds, inclusies] = await Promise.all([
    leesJson("images.json"),
    leesJson("gallery.json"),
    leesJson("inclusions.json"),
  ]);
  // Direct uit de map: elk bestand in `trips/` is één reis, er is geen register.
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
  if (galerijIds.length !== GALERIJ_AANTAL) {
    throw new Error(`gallery.json telt geen ${GALERIJ_AANTAL} foto's.`);
  }
  if (new Set(galerijIds).size !== galerijIds.length) {
    throw new Error("gallery.json bevat dubbele foto-id's.");
  }

  // Alle bronfoto's controleren vóór de eerste schrijfactie, zodat een kapot
  // bestand niet halverwege een productie-run alles half laat staan.
  const kapot = [];
  for (const [id, foto] of Object.entries(images)) {
    const bron = path.join(ROOT, "public", foto.src.replace(/^\//, ""));
    try {
      await fs.access(bron);
      await sharp(bron).metadata();
    } catch {
      kapot.push(`${id} (${foto.src})`);
    }
  }
  if (kapot.length > 0) {
    throw new Error(
      `Deze bronfoto's ontbreken of zijn onleesbaar, er is niets geschreven:\n  ${kapot.join("\n  ")}`,
    );
  }

  // 2. Varianten genereren en naar R2 uploaden.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "seed-fotos-"));
  try {
    const start = Date.now();
    let nr = 0;
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
        ], `foto ${id} variant ${breedte}`);
      }

      // De JPEG voor linkvoorbeelden (WhatsApp, LinkedIn): 1200px, nooit opgeschaald.
      const og = path.join(tmp, `${id}-og.jpg`);
      await sharp(bron)
        .resize({ width: Math.min(OG_BREEDTE, foto.width), withoutEnlargement: true })
        .jpeg({ quality: OG_KWALITEIT })
        .toFile(og);
      wrangler([
        "r2", "object", "put", `${BUCKET}/fotos/${id}/og.jpg`,
        "--file", og, "--content-type", "image/jpeg", modus,
      ], `foto ${id} variant og.jpg`);
      nr += 1;
      console.log(
        `[${nr}/${Object.keys(images).length}] ${id}: ${breedtes.length + 1}/${breedtes.length + 1} varianten (${Math.round((Date.now() - start) / 1000)}s)`,
      );
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
    wrangler(["d1", "execute", DATABASE, modus, `--file=${sqlBestand}`], "D1-rijen");
  } finally {
    await fs.rm(path.dirname(sqlBestand), { recursive: true, force: true });
  }

  const telling = JSON.parse(
    wrangler(
      [
        "d1", "execute", DATABASE, modus, "--json", "--command",
        "SELECT (SELECT COUNT(*) FROM reizen) AS reizen, (SELECT COUNT(*) FROM afbeeldingen) AS afbeeldingen, (SELECT COUNT(*) FROM galerij) AS galerij",
      ],
      "D1-telling",
    ),
  )[0].results[0];
  const verwacht = Object.keys(images).length * (ALL_WIDTHS.length + 1);
  console.log(
    `Klaar in ${Math.round((Date.now() - begin) / 1000)}s. D1: ${telling.reizen} reizen, ${telling.afbeeldingen} afbeeldingen, ${telling.galerij} galerijplekken (bestand: ${reizen.length}/${Object.keys(images).length}/${galerijIds.length}). R2: ${verwacht} objecten geschreven.`,
  );
}

main().catch((fout) => {
  console.error(fout.message);
  process.exit(1);
});
