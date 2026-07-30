import contentJson from "@/data/content.json";
import type {
  FaqItem,
  IconKey,
  ImageAsset,
  NavLink,
  SiteConfig,
  Trip,
  TripInclusion,
} from "@/lib/types";

/**
 * De enige plek die het contentbestand kent.
 *
 * Alle teksten, reizen en bedrijfsgegevens staan in `src/data/content.json`.
 * Dit bestand leest dat in, pakt het uit naar de domeintypes en levert de
 * lees-functies die de pagina's gebruiken. Er is geen backend en geen
 * database: de JSON wordt bij het bouwen meegebundeld, dus alle pagina's
 * kunnen statisch gegenereerd worden.
 *
 * Content aanpassen? Bewerk het JSON-bestand — hier hoeft niets te wijzigen.
 */

/** Vorm van het JSON-bestand, vóór het uitpakken. */
interface RawContent {
  site: SiteConfig;
  navigation: NavLink[];
  /** Sleutel = de id waarnaar een reis verwijst. */
  inclusions: Record<string, { label: string; description?: string; icon: IconKey }>;
  /** Gedeelde fotopool, gebruikt door reizen zonder eigen `gallery`. */
  gallery: ImageAsset[];
  trips: Array<
    Omit<Trip, "inclusions" | "gallery"> & {
      inclusions: string[];
      gallery?: ImageAsset[];
    }
  >;
  faq: FaqItem[];
}

/*
 * TypeScript leest uit een JSON-import alleen brede types ("EUR" wordt `string`),
 * dus de precieze vorm moet hier bevestigd worden. De `resolveInclusions`
 * hieronder controleert bij het opstarten wél echt of alle verwijzingen
 * bestaan, zodat een typefout in het JSON-bestand meteen de build breekt in
 * plaats van stilzwijgend een lege lijst op te leveren.
 */
const content = contentJson as unknown as RawContent;

export const SITE = content.site;
export const NAV_LINKS = content.navigation;
export const FAQ = content.faq;

/** Zet de id's uit een reis om naar de volledige inclusie-regels. */
function resolveInclusions(ids: string[], tripSlug: string): TripInclusion[] {
  return ids.map((id) => {
    const inclusion = content.inclusions[id];

    if (!inclusion) {
      throw new Error(
        `content.json: reis "${tripSlug}" verwijst naar inclusion "${id}", die niet bestaat.`,
      );
    }

    return { id, ...inclusion };
  });
}

/** Alle publiek zichtbare reizen, gesorteerd op vertrekdatum. */
const TRIPS: Trip[] = content.trips
  .filter((trip) => trip.status !== "draft")
  .map((trip) => ({
    ...trip,
    inclusions: resolveInclusions(trip.inclusions, trip.slug),
    gallery: trip.gallery ?? content.gallery,
  }))
  .sort((a, b) => a.departureDate.localeCompare(b.departureDate));

export function getTrips(): Trip[] {
  return TRIPS;
}

/** Eén reis op basis van de slug uit de URL. `null` als hij niet bestaat. */
export function getTripBySlug(slug: string): Trip | null {
  return TRIPS.find((trip) => trip.slug === slug) ?? null;
}

/**
 * De reis die op de homepage wordt uitgelicht. Valt terug op de eerstvolgende
 * reis wanneer er geen enkele als `featured` is gemarkeerd.
 */
export function getFeaturedTrip(): Trip {
  return TRIPS.find((trip) => trip.featured) ?? TRIPS[0];
}

/** Slugs voor `generateStaticParams`, zodat elke detailpagina statisch wordt. */
export function getTripSlugs(): string[] {
  return TRIPS.map((trip) => trip.slug);
}

/** Laagste prijs over alle reizen heen — de "vanaf"-prijs op de homepage. */
export function getStartingPrice(): number {
  return Math.min(...TRIPS.map((trip) => trip.price.amount));
}

/** Gedeelde fotopool, voor de galerij op de homepage. */
export function getGallery(): ImageAsset[] {
  return content.gallery;
}
