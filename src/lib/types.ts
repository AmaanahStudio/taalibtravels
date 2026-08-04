/**
 * Domeinmodellen voor TaalibTravels.
 *
 * Dit is een statische site zonder backend: alle content staat als JSON in
 * `src/data` en wordt bij het bouwen ingelezen. Deze types beschrijven de vorm
 * van die data nadat `src/lib/content.ts` hem heeft uitgepakt — in de bestanden
 * zelf staan inclusies en foto's als id's, hier als volledige objecten.
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
 * Eén foto. Net als de inclusies staan deze één keer beschreven, in
 * `images.json` met de sleutel als id; reizen en de gedeelde pool verwijzen er
 * enkel naar. Zo staat een alt-tekst of afmeting op één plek, ook wanneer
 * dezelfde foto bij meerdere reizen hoort.
 */
export interface ImageAsset {
  /** Pad onder /public. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Eén regel uit de "Inclusief?"-lijst.
 *
 * In `inclusions.json` staan deze één keer, met de sleutel als id. Een reis
 * verwijst er enkel naar, zodat dezelfde tekst niet bij elke reis herhaald
 * hoeft te worden.
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
  /** Eigen foto's, of de gedeelde fotopool als de reis er geen heeft. Altijd zes. */
  gallery: ImageAsset[];
  audience: TripAudience;
  spotsTotal: number;
  spotsLeft: number;
  status: TripStatus;
  /** Uitgelicht op de homepage. Slechts één reis hoort dit op `true` te hebben. */
  featured: boolean;
  /** Laatste inhoudelijke wijziging; wordt gebruikt in de sitemap. */
  updatedAt: string;
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

/*
 * De site heeft geen formulieren: reserveren en vragen stellen gaat volledig
 * via WhatsApp. Er zijn dus ook geen types voor ingevulde velden.
 */
