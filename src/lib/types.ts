/**
 * Domeinmodellen voor TaalibTravels.
 *
 * Reizen, foto's en de homepagegalerij staan in D1 en R2 (beheerportaal);
 * de vaste content (site, navigatie, FAQ, giveaway, privacy) staat als JSON in
 * `src/data`. Deze types beschrijven de vorm nadat `src/lib/trips.ts` en
 * `src/lib/content.ts` hem hebben uitgepakt — in de opslag staan foto's als id's,
 * hier als volledige objecten.
 */

/** `draft` verbergt een reis zonder hem uit het JSON-bestand te halen. */
export type TripStatus = "draft" | "published" | "sold-out";

/** Voor wie de reis bedoeld is. */
export type TripAudience = "brothers" | "sisters" | "mixed" | "families";

/** Sleutel van een inline SVG-icoon uit `components/ui/icons.tsx`. */
export type IconKey =
  | "plane"
  | "hotel"
  | "passport"
  | "guide"
  | "activities"
  | "education"
  | "meals"
  | "transport";

/**
 * Eén foto. Elke foto staat één keer beschreven, in de tabel `afbeeldingen`
 * van D1 met de sleutel als id; reizen en de homepagegalerij verwijzen er
 * enkel naar. Zo staat een alt-tekst of afmeting op één plek, ook wanneer
 * dezelfde foto bij meerdere reizen hoort.
 */
export interface ImageAsset {
  /**
   * Basispad zonder breedte: `/media/fotos/<id>` voor een foto uit het beheer,
   * of een pad onder /public. De image-loader maakt er een variant van.
   */
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Eén regel uit de "Inclusief?"-lijst.
 *
 * Een reis bewaart zijn inclusies als volledige regels in D1. `inclusions.json`
 * levert alleen de voorstellen in het reisformulier van het beheerportaal.
 */
export interface TripInclusion {
  id: string;
  label: string;
  description?: string;
  icon: IconKey;
}

export interface TripPrice {
  /** Bedrag in euro's, bv. 1499.99. */
  amount: number;
  currency: "EUR";
  /** Toont de "termijnen mogelijk"-vermelding. */
  installmentsAvailable: boolean;
  /** Optionele extra regel onder de prijs, bv. "per persoon". */
  note?: string;
}

export interface Trip {
  /** Uniek, en tegelijk het laatste stuk van de URL. */
  slug: string;
  title: string;
  subtitle: string;
  /** Korte tekst voor de card in het overzicht. */
  summary: string;
  /** Paragrafen voor de detailpagina. */
  description: string[];
  /** ISO-8601, bv. "2026-11-07". */
  departureDate: string;
  returnDate: string;
  price: TripPrice;
  inclusions: TripInclusion[];
  coverImage: ImageAsset;
  /**
   * Eigen foto's (zes), of de gedeelde galerij als de reis er geen heeft. Die
   * laatste kan minder foto's tellen of leeg zijn; de pagina's vangen dat op.
   */
  gallery: ImageAsset[];
  audience: TripAudience;
  /**
   * Optioneel: laat je ze weg, dan toont de reiskaart geen "Nog X plekken".
   * TypeScript merkt een ontbrekend veld hier niet op — de JSON wordt met
   * `as unknown as` gecast — dus de consumenten gaan uit van `undefined`.
   */
  spotsTotal?: number;
  spotsLeft?: number;
  status: TripStatus;
  /** Laatste inhoudelijke wijziging; vult `lastModified` in de sitemap. */
  updatedAt?: string;
}

export interface NavLink {
  href: string;
  label: string;
}

/** Bedrijfsgegevens: één plek voor het nummer, de socials en de domeinnaam. */
export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  locale: string;
  email: string;
  whatsapp: {
    /** Weergavevorm, bv. "0489 28 94 90". */
    display: string;
    /** Internationaal, zonder + of spaties — vereist door wa.me. */
    international: string;
  };
  instagram: {
    handle: string;
    url: string;
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * De copy van de giveaway-pagina. Alles staat als tekst in `giveaway.json`, ook
 * de labels van de twee vinkjes — dan hoeft een wijziging aan de actie geen
 * enkel component te raken.
 */
export interface GiveawayContent {
  eyebrow: string;
  title: string;
  intro: string;
  /** Wat er te winnen valt, in één zin. */
  prijs: string;
  /**
   * ISO-8601 mét tijd en tijdzone-offset, bv. "2026-09-04T21:00:00+02:00". De
   * aftelklok op de pagina rekent hierop, dus zonder offset telt hij af naar
   * middernacht UTC in plaats van naar de Belgische klok.
   */
  einddatum: string;
  /**
   * De deelnamevoorwaarden zelf staan niet op de site — die communiceer je via
   * Instagram. Het vinkje hieronder laat de deelnemer alleen bevestigen dat hij
   * eraan voldaan heeft.
   */
  vinkjes: {
    voorwaarden: string;
    consent: string;
  };
  /** Wat er in beeld komt nadat de inschrijving gelukt is. */
  bevestiging: {
    title: string;
    tekst: string;
  };
  /**
   * Publieke sleutel van de Turnstile-widget — mag in git, in tegenstelling tot
   * de bijbehorende secret key, die als Worker-secret staat.
   */
  turnstileSiteKey: string;
}

export interface PrivacySectie {
  kop: string;
  /** Eén string per paragraaf. */
  tekst: string[];
}

export interface PrivacyContent {
  title: string;
  /** ISO-8601: wanneer de verklaring voor het laatst is bijgewerkt. */
  bijgewerkt: string;
  intro: string;
  secties: PrivacySectie[];
}

/*
 * Reserveren en vragen stellen gaat nog altijd volledig via WhatsApp. Het enige
 * formulier op de site is de giveaway-inschrijving; de vorm van die velden staat
 * in `lib/leads.ts`, want die regels worden gedeeld met de Worker en mogen dus
 * niets uit dit bestand importeren.
 */
