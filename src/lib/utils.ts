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

/**
 * "4 september 2026 om 21:00" — voor een moment mét tijd, zoals de deadline van
 * de giveaway.
 *
 * Deze leest de onderdelen uit de tekst zelf in plaats van via een `Date`, want
 * de andere formatters hierboven rekenen in UTC. Voor "2026-09-04T21:00:00+02:00"
 * levert dat 19:00 op — het juiste tijdstip, maar niet het uur dat de bezoeker
 * op zijn eigen klok ziet staan. De offset in de string zegt in welke tijdzone
 * de geschreven tijd bedoeld is, en dat is precies wat hier getoond moet worden.
 */
export function formatDateTimeLong(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);

  if (!match) {
    throw new Error(
      `formatDateTimeLong verwacht een ISO-datum mét tijd (bv. "2026-09-04T21:00:00+02:00"), maar kreeg "${iso}".`,
    );
  }

  const [, year, month, day, hour, minute] = match;

  return `${Number(day)} ${MONTHS_NL[Number(month) - 1]} ${year} om ${hour}:${minute}`;
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

/**
 * Bouwt een wa.me-link met een voorgevuld bericht. Klanten boeken via hun
 * telefoon, dus dit is de belangrijkste conversie-actie van de site.
 */
export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${SITE.whatsapp.international}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
