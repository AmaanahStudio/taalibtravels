/**
 * Kopieert reizen, foto's en de homepagegalerij van productie naar acceptatie.
 *
 *   npm run kopieer:acc                 overzicht, er wordt niets geschreven
 *   npm run kopieer:acc -- --overschrijf   echt kopiëren
 *
 * Raakt `deelnemers` nergens aan: niet lezen, niet schrijven, niet leegmaken. De
 * tabellijst hieronder is een vaste allowlist; dit script kent die tabel niet.
 * Productie wordt alleen gelezen.
 *
 * Gevolgen om te kennen:
 *  - Wat op acceptatie aan reizen, foto's of galerij is gewijzigd, wordt
 *    overschreven. Dat is de bedoeling van een kopie; daarom de vlag.
 *  - Foto's die alleen op acceptatie bestonden, blijven als wees in de R2-bucket
 *    staan. Onschuldig.
 *  - De eerste keer zijn het ongeveer 23 x 9 = 207 objecten, twee wrangler-aanroepen
 *    per object: reken op een kwartier. Daarna gaan alleen nieuwe foto's over,
 *    want een foto-id wordt nooit hergebruikt.
 *  - Is de D1-stap halverwege mislukt, draai het script dan opnieuw: het begint
 *    met DELETE, dus opnieuw draaien is veilig.
 *  - Niet draaien terwijl een acceptatie-deploy loopt (migratie).
 *  - Deelnemers op acceptatie zijn testinschrijvingen van de klant; ruim ze na de
 *    test op via /admin.
 *
 * Vereist Node >= 22.18: `foto-breedtes.ts` wordt rechtstreeks geladen.
 * Omgevingsvariabele KOPIEER_TIMEOUT_MS zet de time-out per wrangler-aanroep (standaard 120000).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Vóór de import van foto-breedtes.ts: op een te oude Node zou die met een cryptische
// syntaxfout stranden in plaats van met deze melding.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`Dit script vereist Node 22.18 of nieuwer; dit is ${process.versions.node}.`);
  process.exit(1);
}
const { ALL_WIDTHS } = await import("../src/lib/foto-breedtes.ts");

// Hard ingebakken, bewust geen argumenten of omgevingsvariabelen: een verkeerde
// bestemming moet onmogelijk zijn, niet onwaarschijnlijk.
const BRON_DB = "taalibtravels-leads";
const DOEL_DB = "taalibtravels-leads-acc";
const BRON_BUCKET = "taalibtravels-media";
const DOEL_BUCKET = "taalibtravels-media-acc";
// Volgorde = invoegvolgorde (vreemde sleutels); verwijderen gaat andersom.
const TABELLEN = ["afbeeldingen", "reizen", "galerij"];

if (
  !DOEL_DB.endsWith("-acc") ||
  !DOEL_BUCKET.endsWith("-acc") ||
  DOEL_DB === BRON_DB ||
  DOEL_BUCKET === BRON_BUCKET
) {
  console.error("Bron en doel zijn niet duidelijk gescheiden; afgebroken.");
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const TIMEOUT_MS = Number(process.env.KOPIEER_TIMEOUT_MS) || 120_000;

// Alleen wat wrangler nodig heeft (pad, profielmap voor de login, Cloudflare-token),
// niet de rest van de omgeving. CI=true schakelt prompts en de update-check uit.
const DOORGEGEVEN = /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|COMSPEC|WINDIR|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|TMPDIR|XDG_.*|HTTPS?_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|CLOUDFLARE_(?!ENV$).*|WRANGLER_.*)$/i;
const WRANGLER_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([naam]) => DOORGEGEVEN.test(naam))),
  CI: "true",
  NO_COLOR: "1",
  WRANGLER_SEND_METRICS: "false",
};

const overschrijf = process.argv.includes("--overschrijf");

/**
 * Wrangler draait zonder shell, dus er valt niets te injecteren via bestandsnamen.
 * Af en toe faalt wrangler op een netwerkcheck die met de opdracht niets te maken
 * heeft; vandaar de herpoging. Alles wat we uitvoeren is idempotent. Een hangende
 * aanroep wordt na TIMEOUT_MS gedood en telt als mislukte poging.
 */
function wrangler(args, label, pogingen = 3) {
  for (let poging = 1; ; poging += 1) {
    try {
      return execFileSync(process.execPath, [WRANGLER, ...args], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
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
  const tekst = String(waarde);
  if (tekst.includes("\0")) throw new Error("Tekst bevat een NUL-teken.");
  return `'${tekst.replaceAll("'", "''")}'`;
}

function sqlGetal(waarde) {
  if (!Number.isFinite(waarde)) throw new Error(`Geen geldig getal: ${waarde}`);
  return String(waarde);
}

function sqlWaarde(waarde) {
  if (waarde === null || waarde === undefined) return "NULL";
  return typeof waarde === "number" ? sqlGetal(waarde) : sqlTekst(waarde);
}

/** Resultaatrijen van `d1 execute --json`. */
function query(db, sql, label, doel) {
  const uitvoer = wrangler(
    ["d1", "execute", db, ...(doel ? ["--env", "acceptatie"] : []), "--remote", "--json", "--command", sql],
    label,
  );
  return JSON.parse(uitvoer)[0].results;
}

async function main() {
  // 1. Lezen. De tabelnamen komen uit de allowlist, dus SELECT * mag; zo volgt de
  // kopie een latere kolom vanzelf.
  const bron = {};
  for (const tabel of TABELLEN) {
    bron[tabel] = query(BRON_DB, `SELECT * FROM ${tabel}`, `lezen ${tabel} (productie)`, false);
    for (const rij of bron[tabel]) {
      for (const kolom of Object.keys(rij)) {
        if (!/^[a-z][a-z0-9_]*$/.test(kolom)) throw new Error(`Onverwachte kolomnaam in ${tabel}: ${kolom}`);
      }
    }
  }
  const doelFotos = new Set(
    query(DOEL_DB, "SELECT id FROM afbeeldingen", "lezen afbeeldingen (acceptatie)", true).map((r) => r.id),
  );
  const nieuw = bron.afbeeldingen.filter((foto) => !doelFotos.has(foto.id));
  for (const foto of nieuw) {
    // De sleutel komt uit productie-D1, maar wordt een bestandspad voor wrangler: toch controleren.
    if (!/^fotos\/[a-z0-9]+(-[a-z0-9]+)*$/.test(foto.r2_sleutel)) {
      throw new Error(`Onverwachte R2-sleutel: ${foto.r2_sleutel}`);
    }
  }

  // 2. Overzicht.
  console.log("Productie -> acceptatie");
  for (const tabel of TABELLEN) console.log(`  ${tabel}: ${bron[tabel].length} rijen`);
  console.log(
    `  foto's nog niet op acceptatie: ${nieuw.length} (${nieuw.length * (ALL_WIDTHS.length + 1)} objecten)`,
  );
  if (!overschrijf) {
    console.log("\nEr is niets geschreven. Draai met --overschrijf om te kopiëren;");
    console.log("reizen, foto's en galerij op acceptatie worden dan vervangen.");
    return;
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kopieer-acc-"));
  try {
    // 3. R2 eerst: faalt een object, dan is D1 nog onaangeroerd en wijst geen rij
    // naar een ontbrekende foto.
    const bestanden = [...ALL_WIDTHS.map((w) => [`${w}.webp`, "image/webp"]), ["og.jpg", "image/jpeg"]];
    let nr = 0;
    for (const foto of nieuw) {
      for (const [naam, type] of bestanden) {
        const sleutel = `${foto.r2_sleutel}/${naam}`;
        const tijdelijk = path.join(tmp, "object");
        wrangler(["r2", "object", "get", `${BRON_BUCKET}/${sleutel}`, "--remote", "--file", tijdelijk], `ophalen ${sleutel}`);
        wrangler(
          ["r2", "object", "put", `${DOEL_BUCKET}/${sleutel}`, "--remote", "--file", tijdelijk, "--content-type", type],
          `wegschrijven ${sleutel}`,
        );
      }
      nr += 1;
      console.log(`[${nr}/${nieuw.length}] ${foto.id}`);
    }

    // 4. D1 in één bestand: eerst leegmaken (kinderen vóór ouders), dan invoegen.
    const sql = [...TABELLEN].reverse().map((tabel) => `DELETE FROM ${tabel};`);
    for (const tabel of TABELLEN) {
      for (const rij of bron[tabel]) {
        const kolommen = Object.keys(rij);
        sql.push(
          `INSERT INTO ${tabel} (${kolommen.join(", ")}) VALUES (${kolommen.map((k) => sqlWaarde(rij[k])).join(", ")});`,
        );
      }
    }
    const sqlBestand = path.join(tmp, "kopie.sql");
    await fs.writeFile(sqlBestand, sql.join("\n"), "utf8");
    wrangler(["d1", "execute", DOEL_DB, "--env", "acceptatie", "--remote", `--file=${sqlBestand}`], "D1-rijen");
    console.log(
      `Klaar: ${TABELLEN.map((t) => `${bron[t].length} ${t}`).join(", ")}; ${nieuw.length} nieuwe foto's gekopieerd.`,
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

main().catch((fout) => {
  console.error(fout.message);
  process.exit(1);
});
