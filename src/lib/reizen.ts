/**
 * Validatie van een reis, gedeeld door het beheerformulier en de Worker.
 *
 * De browser gebruikt deze regels om direct te kunnen zeggen wat er mis is; de
 * Worker gebruikt exact dezelfde regels als het echte oordeel.
 *
 * BELANGRIJK: net als `leads.ts` mag dit bestand geen `@/*`-alias gebruiken —
 * wrangler bundelt de Worker zonder de aliassen uit tsconfig.json. Een relatieve
 * `import type` is veilig: die verdwijnt bij het bundelen.
 */

import type { IconKey, TripAudience, TripStatus } from "./types";

/** Alle iconen die `icons.tsx` kent. De controle eronder houdt dit gelijk aan `IconKey`. */
export const ICON_KEYS = [
  "plane",
  "hotel",
  "passport",
  "guide",
  "activities",
  "education",
  "meals",
  "transport",
] as const satisfies readonly IconKey[];

// Compile-time: faalt zodra `IconKey` een waarde krijgt die hierboven ontbreekt.
const _iconsVolledig: IconKey extends (typeof ICON_KEYS)[number] ? true : never = true;
void _iconsVolledig;

/** Een galerij vult het raster alleen met precies zes foto's. */
export const GALERIJ_AANTAL = 6;

const AUDIENCES: readonly TripAudience[] = ["brothers", "sisters", "mixed", "families"];
const STATUSSEN: readonly TripStatus[] = ["draft", "published", "sold-out"];

const SLUG_PATROON = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATUM_PATROON = /^(\d{4})-(\d{2})-(\d{2})$/;

const MAX = {
  slug: 80,
  title: 80,
  subtitle: 80,
  summary: 300,
  paragraaf: 2000,
  paragrafen: 20,
  inclusies: 30,
  inclusieLabel: 60,
  inclusieToelichting: 200,
  prijsNotitie: 100,
  prijs: 100000,
  plekken: 10000,
  afbeeldingId: 100,
} as const;

export interface InclusieInvoer {
  label: string;
  description?: string;
  icon: IconKey;
}

export interface ReisInvoer {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  description: string[];
  departureDate: string;
  returnDate: string;
  price: { amount: number; installmentsAvailable: boolean; note?: string };
  inclusions: InclusieInvoer[];
  coverImage: string;
  gallery: string[] | null;
  audience: TripAudience;
  status: TripStatus;
  spotsTotal?: number;
  spotsLeft?: number;
}

/** Sleutel is een veldpad, bv. `inclusions.2.label`; ontbreekt hij, dan is dat veld goed. */
export type ReisFouten = Partial<Record<string, string>>;

export type ReisResultaat = { ok: true; reis: ReisInvoer } | { ok: false; fouten: ReisFouten };

type Obj = Record<string, unknown>;

function isObj(waarde: unknown): waarde is Obj {
  return typeof waarde === "object" && waarde !== null && !Array.isArray(waarde);
}

/** Echte kalenderdatum (`2026-02-30` valt af), niet alleen een patroon. */
function isIsoDatum(waarde: string): boolean {
  const m = DATUM_PATROON.exec(waarde);
  if (!m) return false;
  const [jaar, maand, dag] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(jaar, maand - 1, dag));
  return d.getUTCFullYear() === jaar && d.getUTCMonth() === maand - 1 && d.getUTCDate() === dag;
}

/** Hoogstens twee decimalen, met ruimte voor de afrondingsfout van een float. */
function heeftHoogstensTweeDecimalen(bedrag: number): boolean {
  return Math.abs(bedrag * 100 - Math.round(bedrag * 100)) < 1e-6;
}

export function valideerReis(ruw: unknown): ReisResultaat {
  const fouten: ReisFouten = {};
  if (!isObj(ruw)) return { ok: false, fouten: { reis: "Ongeldige invoer." } };

  /** Getrimde, verplichte tekst met maximumlengte. */
  const tekst = (pad: string, waarde: unknown, naam: string, max: number): string => {
    const t = typeof waarde === "string" ? waarde.trim() : "";
    if (!t) fouten[pad] = `${naam} is verplicht.`;
    else if (t.length > max) fouten[pad] = `${naam} mag hoogstens ${max} tekens zijn.`;
    return t;
  };

  /** Optionele tekst: afwezig (of null) mag, een ander type dan tekst niet. */
  const optioneleTekst = (pad: string, waarde: unknown): string => {
    if (waarde === undefined || waarde === null) return "";
    if (typeof waarde !== "string") {
      fouten[pad] = "Vul tekst in.";
      return "";
    }
    return waarde.trim();
  };

  const slug = tekst("slug", ruw.slug, "De slug", MAX.slug);
  if (slug && !fouten.slug && !SLUG_PATROON.test(slug)) {
    fouten.slug = "Gebruik alleen kleine letters, cijfers en streepjes (bv. umrah-budget).";
  }
  const title = tekst("title", ruw.title, "De titel", MAX.title);
  const subtitle = tekst("subtitle", ruw.subtitle, "De ondertitel", MAX.subtitle);
  const summary = tekst("summary", ruw.summary, "De samenvatting", MAX.summary);

  // Lege alinea's vallen weg, zodat een achtergebleven lege regel geen fout is.
  // De foutsleutel gebruikt de index in de invoer, want dat is de rij die het formulier toont.
  const description: string[] = [];
  if (Array.isArray(ruw.description)) {
    ruw.description.forEach((alinea: unknown, i) => {
      const t = typeof alinea === "string" ? alinea.trim() : "";
      if (!t) return;
      if (t.length > MAX.paragraaf) {
        fouten[`description.${i}`] = `Een alinea mag hoogstens ${MAX.paragraaf} tekens zijn.`;
      }
      description.push(t);
    });
  }
  if (description.length === 0) {
    fouten.description = "Voeg minstens één alinea toe.";
  } else if (description.length > MAX.paragrafen) {
    fouten.description = `Hoogstens ${MAX.paragrafen} alinea's.`;
  }

  const departureDate = typeof ruw.departureDate === "string" ? ruw.departureDate.trim() : "";
  const returnDate = typeof ruw.returnDate === "string" ? ruw.returnDate.trim() : "";
  if (!isIsoDatum(departureDate)) fouten.departureDate = "Vul een geldige vertrekdatum in.";
  if (!isIsoDatum(returnDate)) {
    fouten.returnDate = "Vul een geldige terugkeerdatum in.";
  } else if (!fouten.departureDate && returnDate < departureDate) {
    // ISO-datums sorteren alfabetisch gelijk aan chronologisch.
    fouten.returnDate = "De terugkeer kan niet voor het vertrek liggen.";
  }

  const prijs = isObj(ruw.price) ? ruw.price : {};
  const amount = prijs.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    fouten["price.amount"] = "Vul een bedrag groter dan nul in.";
  } else if (amount > MAX.prijs) {
    fouten["price.amount"] = `Het bedrag mag hoogstens € ${MAX.prijs} zijn.`;
  } else if (!heeftHoogstensTweeDecimalen(amount)) {
    fouten["price.amount"] = "Gebruik hoogstens twee decimalen.";
  }
  const note = optioneleTekst("price.note", prijs.note);
  if (note.length > MAX.prijsNotitie) {
    fouten["price.note"] = `De toelichting mag hoogstens ${MAX.prijsNotitie} tekens zijn.`;
  }
  if (prijs.installmentsAvailable !== undefined && typeof prijs.installmentsAvailable !== "boolean") {
    fouten["price.installmentsAvailable"] = "Kies ja of nee.";
  }
  const installmentsAvailable = prijs.installmentsAvailable === true;

  const inclusions: InclusieInvoer[] = [];
  if (!Array.isArray(ruw.inclusions) || ruw.inclusions.length === 0) {
    fouten.inclusions = "Voeg minstens één inclusie toe.";
  } else if (ruw.inclusions.length > MAX.inclusies) {
    fouten.inclusions = `Hoogstens ${MAX.inclusies} inclusies.`;
  } else {
    ruw.inclusions.forEach((rij: unknown, i) => {
      const r = isObj(rij) ? rij : {};
      const label = tekst(`inclusions.${i}.label`, r.label, "Het label", MAX.inclusieLabel);
      const toelichting = optioneleTekst(`inclusions.${i}.description`, r.description);
      if (toelichting.length > MAX.inclusieToelichting) {
        fouten[`inclusions.${i}.description`] =
          `De toelichting mag hoogstens ${MAX.inclusieToelichting} tekens zijn.`;
      }
      const icon = ICON_KEYS.find((k) => k === r.icon);
      if (!icon) fouten[`inclusions.${i}.icon`] = "Kies een icoon.";
      else inclusions.push({ label, ...(toelichting ? { description: toelichting } : {}), icon });
    });
  }

  const coverImage = typeof ruw.coverImage === "string" ? ruw.coverImage.trim() : "";
  if (!coverImage) fouten.coverImage = "Kies een omslagfoto.";
  else if (coverImage.length > MAX.afbeeldingId) fouten.coverImage = "Ongeldige foto.";

  let gallery: string[] | null = null;
  if (ruw.gallery !== null && ruw.gallery !== undefined) {
    const ids: string[] = [];
    let alleIds = Array.isArray(ruw.gallery);
    if (Array.isArray(ruw.gallery)) {
      for (const id of ruw.gallery as unknown[]) {
        const t = typeof id === "string" ? id.trim() : "";
        if (!t || t.length > MAX.afbeeldingId) alleIds = false;
        ids.push(t);
      }
    }
    if (!alleIds || ids.length !== GALERIJ_AANTAL) {
      fouten.gallery = `Kies precies ${GALERIJ_AANTAL} foto's.`;
    } else if (new Set(ids).size !== ids.length) {
      fouten.gallery = "Elke foto mag maar één keer voorkomen.";
    } else {
      gallery = ids;
    }
  }

  const audience = AUDIENCES.find((a) => a === ruw.audience);
  if (!audience) fouten.audience = "Kies voor wie de reis is.";
  const status = STATUSSEN.find((s) => s === ruw.status);
  if (!status) fouten.status = "Kies een status.";

  const plekken = (pad: string, waarde: unknown): number | undefined => {
    if (waarde === undefined || waarde === null) return undefined;
    if (typeof waarde !== "number" || !Number.isInteger(waarde) || waarde < 0 || waarde > MAX.plekken) {
      fouten[pad] = "Vul een geheel getal van nul of meer in.";
      return undefined;
    }
    return waarde;
  };
  const spotsTotal = plekken("spotsTotal", ruw.spotsTotal);
  const spotsLeft = plekken("spotsLeft", ruw.spotsLeft);
  if (spotsTotal !== undefined && spotsLeft !== undefined && spotsLeft > spotsTotal) {
    fouten.spotsLeft = "Er kunnen niet meer plekken over zijn dan het totaal.";
  }

  if (Object.keys(fouten).length > 0 || !audience || !status || typeof amount !== "number") {
    return { ok: false, fouten };
  }

  return {
    ok: true,
    reis: {
      slug,
      title,
      subtitle,
      summary,
      description,
      departureDate,
      returnDate,
      price: { amount, installmentsAvailable, ...(note ? { note } : {}) },
      inclusions,
      coverImage,
      gallery,
      audience,
      status,
      ...(spotsTotal !== undefined ? { spotsTotal } : {}),
      ...(spotsLeft !== undefined ? { spotsLeft } : {}),
    },
  };
}

/**
 * Stelt een slug voor uit titel en ondertitel. Het formulier vult hem vooraf in;
 * de beheerder mag hem aanpassen tot de reis bestaat.
 */
export function maakSlug(title: string, subtitle: string): string {
  return `${title} ${subtitle}`
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX.slug)
    .replace(/-+$/, "");
}
