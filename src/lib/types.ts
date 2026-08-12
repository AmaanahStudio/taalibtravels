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

/**
 * De navigatie staat gesplitst: de navbar blijft kort, de footer linkt naar
 * alles. Die footerlijst is meteen de interne bekabeling van de site — elke
 * pagina is vanaf elke andere pagina bereikbaar, wat zoekmachines helpt alles
 * te vinden.
 */
export interface Navigation {
  main: NavLink[];
  footer: NavLink[];
}

/**
 * Postadres voor het `LocalBusiness`-schema.
 *
 * Zolang `street`, `postalCode` of `city` leeg is, laat `schema.ts` het adres
 * volledig weg: een half adres is voor Google slechter dan geen adres.
 */
export interface SiteAddress {
  street: string;
  postalCode: string;
  city: string;
  region: string;
  /** ISO 3166-1 alpha-2, bv. "BE". */
  country: string;
}

/** Bedrijfsgegevens: één plek voor het nummer, de socials en de domeinnaam. */
export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  url: string;
  /** OpenGraph-vorm, bv. "nl_BE". */
  locale: string;
  /** Overige markten, bv. ["nl_NL"] — vult `og:locale:alternate`. */
  alternateLocales: string[];
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
  address: SiteAddress;
  /** Landen waar we op werven, ISO 3166-1 alpha-2. */
  areaServed: string[];
  /** Grove prijsindicatie voor `LocalBusiness`, bv. "€€". */
  priceRange: string;
  verification: {
    /** Token uit Google Search Console; leeg = geen meta-tag. */
    google: string;
  };
  /** Vult het `VideoObject`-schema van de homepage-hero. */
  heroVideo: {
    name: string;
    description: string;
    /** ISO-8601 datum. */
    uploadDate: string;
    src: string;
    poster: string;
  };
}

export interface FaqItem {
  question: string;
  answer: string;
  /** Kopje waaronder de vraag op de FAQ-pagina valt. */
  category: string;
  /** Toont de vraag ook op de homepage en de contactpagina. */
  featured?: boolean;
}

/** Eén kop met bijbehorende tekst op een losse tekstpagina. */
export interface ContentSection {
  /** Anker in de URL en doel van de inhoudsopgave. */
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

/**
 * Een losse tekstpagina (`/umrah`, `/over-ons`). Net als bij de reizen staat de
 * tekst in JSON en kent alleen `content.ts` die bestanden.
 */
export interface ContentPage {
  slug: string;
  /** Titel voor `<title>` en de zoekresultaten. */
  title: string;
  description: string;
  /** De `<h1>` op de pagina zelf; mag afwijken van `title`. */
  heading: string;
  intro: string;
  sections: ContentSection[];
  /** ISO-8601; vult `lastModified` in de sitemap en `dateModified` in het schema. */
  updatedAt: string;
}

/** Eén reden om met ons te reizen, op de homepage. */
export interface HomeUsp {
  icon: IconKey;
  title: string;
  body: string;
}

/** Eén stap uit "Zo werkt het". */
export interface HomeStep {
  title: string;
  body: string;
}

/** Kop van een homepage-sectie: klein label plus grote titel. */
export interface SectionCopy {
  eyebrow: string;
  heading: string;
}

/** Alle losse teksten van de homepage. */
export interface HomeContent {
  hero: {
    /** Eerste regel van de `<h1>`, groot. */
    headingPrimary: string;
    /** Tweede regel van de `<h1>`, in accentkleur. */
    headingSecondary: string;
    intro: string;
  };
  intro: SectionCopy & { paragraphs: string[] };
  usps: SectionCopy & { items: HomeUsp[] };
  steps: SectionCopy & { items: HomeStep[] };
  faq: SectionCopy;
}

/*
 * De site heeft geen formulieren: reserveren en vragen stellen gaat volledig
 * via WhatsApp. Er zijn dus ook geen types voor ingevulde velden.
 */
