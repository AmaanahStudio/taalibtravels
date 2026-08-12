import { SITE } from "@/lib/content";

/** Voegt classnames samen en filtert falsy waarden weg. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

const MONTHS_NL_SHORT = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;

/**
 * Datums worden handmatig geformatteerd in plaats van met `Intl`. Zo is de
 * uitvoer op de server exact gelijk aan die in de browser en krijgen we geen
 * hydration-mismatch door een afwijkende locale of tijdzone.
 */
function parts(iso: string) {
  const date = new Date(iso);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "07/11/2026" — het formaat van de poster. */
export function formatDateNumeric(iso: string) {
  const { day, month, year } = parts(iso);
  return `${pad(day)}/${pad(month + 1)}/${year}`;
}

/** "7 november 2026" */
export function formatDateLong(iso: string) {
  const { day, month, year } = parts(iso);
  return `${day} ${MONTHS_NL[month]} ${year}`;
}

/** Losse onderdelen voor de grote datumweergave in de "Datum"-sectie. */
export function splitDate(iso: string) {
  const { day, month, year } = parts(iso);
  return { day: pad(day), month: MONTHS_NL_SHORT[month], year: String(year) };
}

/** Aantal nachten tussen vertrek en terugkomst. */
export function nightsBetween(departureIso: string, returnIso: string) {
  const ms = new Date(returnIso).getTime() - new Date(departureIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** "1.499,99" — Belgisch formaat, zonder valutateken. */
export function formatAmount(amount: number) {
  const [euros, cents = "00"] = amount.toFixed(2).split(".");
  const grouped = euros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped},${cents}`;
}

/**
 * "€ 1.499,99" — met een harde spatie, zodat het euroteken nooit op een eigen
 * regel belandt wanneer de kolom smal is.
 */
export function formatPrice(amount: number) {
  return `€ ${formatAmount(amount)}`;
}

type TitledTrip = { title: string; subtitle: string };

/**
 * Splitst de naam van een reis in de titel en het deel van de ondertitel dat
 * daar nog niet in staat.
 *
 * `title` en `subtitle` overlappen soms. "Umrah September" met ondertitel
 * "September 2026" zou anders "Umrah September September 2026" opleveren — in
 * de `<h1>`, in de paginatitel én in het kruimelpad, waar Google het overneemt.
 * Woorden die al in de titel voorkomen vallen daarom weg; bij "Umrah Budget"
 * met "November 2026" blijft de ondertitel volledig staan.
 *
 * De periode hoort er wél bij: mensen zoeken op "umrah september 2026", niet op
 * "umrah september".
 */
export function tripTitleParts(trip: TitledTrip) {
  const title = trip.title.toLowerCase();

  const rest = trip.subtitle
    .split(" ")
    .filter((word) => !title.includes(word.toLowerCase()))
    .join(" ");

  return { title: trip.title, rest };
}

/** De volledige naam op één regel, voor titels, schema en kruimelpad. */
export function tripFullTitle(trip: TitledTrip) {
  const { title, rest } = tripTitleParts(trip);
  return rest ? `${title} ${rest}` : title;
}

/**
 * Bouwt een wa.me-link met een voorgevuld bericht. Klanten boeken via hun
 * telefoon, dus dit is de belangrijkste conversie-actie van de site.
 */
export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${SITE.whatsapp.international}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
