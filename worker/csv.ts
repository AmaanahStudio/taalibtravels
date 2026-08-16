/** Opbouw van de CSV-export, met de twee valkuilen die zo'n bestand kent. */

/**
 * Excel, Google Sheets en LibreOffice voeren de inhoud van een cel uit als
 * formule zodra die met =, +, - of @ begint. Iemand die zich inschrijft als
 * `=HYPERLINK("http://...")` krijgt zijn tekst dan uitgevoerd op jouw computer
 * op het moment dat jij het bestand opent. Een apostrof ervoor maakt er weer
 * gewone tekst van.
 */
function ontschadelijk(tekst: string): string {
  return /^[=+\-@\t\r]/.test(tekst) ? `'${tekst}` : tekst;
}

/** Eén veld volgens RFC 4180: tussen dubbele quotes, interne quotes verdubbeld. */
function veld(waarde: string | number | null): string {
  const tekst = waarde === null || waarde === undefined ? "" : String(waarde);
  return `"${ontschadelijk(tekst).replace(/"/g, '""')}"`;
}

/**
 * Byte order mark. Zonder dit teken leest Excel het bestand als Windows-1252 en
 * wordt "Aïcha" onleesbaar. Opgebouwd met een charcode in plaats van als
 * letterlijk teken: een BOM is onzichtbaar in een editor, en een onzichtbaar
 * teken dat iemand per ongeluk wist, kost een half uur zoeken.
 */
const BOM = String.fromCharCode(0xfeff);

/**
 * Zet koppen en rijen om naar een CSV-tekst.
 *
 * Komma's als scheidingsteken — dat is de standaard uit RFC 4180 en wat
 * mailtools zoals Mailchimp en Brevo verwachten. Excel met een Belgische
 * locale zet zo'n bestand in één kolom; gebruik daar Gegevens → Uit tekst.
 */
export function bouwCsv(
  koppen: readonly string[],
  rijen: readonly (readonly (string | number | null)[])[],
): string {
  const regels = [koppen.map(veld).join(",")];

  for (const rij of rijen) regels.push(rij.map(veld).join(","));

  return `${BOM}${regels.join("\r\n")}\r\n`;
}
