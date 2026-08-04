import faqJson from "@/data/faq.json";
import galleryJson from "@/data/gallery.json";
import imagesJson from "@/data/images.json";
import inclusionsJson from "@/data/inclusions.json";
import navigationJson from "@/data/navigation.json";
import siteJson from "@/data/site.json";
import { TRIP_FILES } from "@/data/trips";
import type {
  FaqItem,
  ImageAsset,
  NavLink,
  SiteConfig,
  Trip,
  TripInclusion,
} from "@/lib/types";

/**
 * De enige plek die de contentbestanden kent.
 *
 * Alle teksten, reizen en bedrijfsgegevens staan in `src/data`, opgesplitst per
 * onderwerp: `site.json`, `navigation.json`, `inclusions.json`, `images.json`,
 * `gallery.json`, `faq.json` en één bestand per reis onder `trips/`. Dit bestand
 * leest die in, pakt de verwijzingen uit naar de domeintypes en levert de
 * lees-functies die de pagina's gebruiken. Er is geen backend en geen database:
 * de JSON wordt bij het bouwen meegebundeld, dus alle pagina's kunnen statisch
 * gegenereerd worden.
 *
 * Twee dingen staan bewust één keer beschreven en worden elders alleen met een
 * id aangeroepen: de "Inclusief?"-regels en de foto's. Zo blijft een alt-tekst
 * of een afmeting op één plek staan, ook als dezelfde foto bij meerdere reizen
 * hoort.
 *
 * Content aanpassen? Bewerk de JSON-bestanden — hier hoeft niets te wijzigen.
 */

/** Vorm van `inclusions.json`: sleutel = de id waarnaar een reis verwijst. */
type RawInclusions = Record<string, Omit<TripInclusion, "id">>;

/** Vorm van `images.json`: sleutel = de id waarnaar een galerij verwijst. */
type RawImages = Record<string, ImageAsset>;

/** Vorm van één reisbestand, vóór het uitpakken van de id-verwijzingen. */
interface RawTrip extends Omit<Trip, "inclusions" | "coverImage" | "gallery"> {
  inclusions: string[];
  coverImage: string;
  /** Eigen foto's; weglaten laat de reis terugvallen op de gedeelde pool. */
  gallery?: string[];
}

/**
 * Een galerij toont precies zes foto's: met de grote tegel erbij vult dat het
 * raster, bij een ander aantal blijft er een lege cel over.
 */
const GALLERY_SIZE = 6;

export const SITE = siteJson as SiteConfig;
export const NAV_LINKS = navigationJson as NavLink[];
export const FAQ = faqJson as FaqItem[];

const IMAGES = imagesJson as RawImages;

/*
 * TypeScript leest uit een JSON-import alleen brede types ("EUR" wordt `string`,
 * een icoonnaam ook), dus de precieze vorm moet hier bevestigd worden. De
 * resolvers hieronder controleren bij het opstarten wél echt of alle
 * verwijzingen bestaan, zodat een typefout in een JSON-bestand meteen de build
 * breekt in plaats van stilzwijgend een lege lijst op te leveren.
 */
const INCLUSIONS = inclusionsJson as unknown as RawInclusions;
const TRIPS_RAW = TRIP_FILES as unknown as RawTrip[];

/** Zet de id's uit een reis om naar de volledige inclusie-regels. */
function resolveInclusions(ids: string[], herkomst: string): TripInclusion[] {
  return ids.map((id) => {
    const inclusion = INCLUSIONS[id];

    if (!inclusion) {
      throw new Error(
        `inclusions.json: ${herkomst} verwijst naar inclusion "${id}", die niet bestaat.`,
      );
    }

    return { id, ...inclusion };
  });
}

/** Zoekt één foto op in het register. `herkomst` komt terug in de foutmelding. */
function resolveImage(id: string, herkomst: string): ImageAsset {
  const image = IMAGES[id];

  if (!image) {
    throw new Error(
      `images.json: ${herkomst} verwijst naar foto "${id}", die niet bestaat.`,
    );
  }

  return image;
}

/** Zet de foto-id's van een galerij om, en bewaakt het vaste aantal van zes. */
function resolveGallery(ids: string[], herkomst: string): ImageAsset[] {
  if (ids.length !== GALLERY_SIZE) {
    throw new Error(
      `${herkomst}: een galerij telt ${GALLERY_SIZE} foto's, deze telt er ${ids.length}. ` +
        "Bij een ander aantal blijft er een lege cel over in het raster.",
    );
  }

  return ids.map((id) => resolveImage(id, herkomst));
}

/** Gedeelde fotopool, voor de homepage en voor reizen zonder eigen galerij. */
const GALLERY = resolveGallery(galleryJson as string[], "gallery.json");

/** Alle publiek zichtbare reizen, gesorteerd op vertrekdatum. */
const TRIPS: Trip[] = TRIPS_RAW.filter((trip) => trip.status !== "draft")
  .map((trip) => {
    const herkomst = `reis "${trip.slug}"`;

    return {
      ...trip,
      inclusions: resolveInclusions(trip.inclusions, herkomst),
      coverImage: resolveImage(trip.coverImage, herkomst),
      gallery: trip.gallery ? resolveGallery(trip.gallery, herkomst) : GALLERY,
    };
  })
  .sort((a, b) => a.departureDate.localeCompare(b.departureDate));

/**
 * Controles die pas kloppen wanneer je alle reizen naast elkaar legt. Nu elke
 * reis een eigen bestand heeft, ziet niemand meer in één oogopslag dat twee
 * reizen dezelfde slug of allebei `featured` gebruiken — daarom hier.
 */
function assertTripsConsistent(trips: Trip[]): void {
  const slugs = new Set<string>();

  for (const trip of trips) {
    if (slugs.has(trip.slug)) {
      throw new Error(
        `Twee reisbestanden gebruiken de slug "${trip.slug}". Een slug vormt de URL en moet uniek zijn.`,
      );
    }

    slugs.add(trip.slug);
  }

  const featured = trips.filter((trip) => trip.featured);

  if (featured.length > 1) {
    throw new Error(
      `Meerdere reizen staan op featured (${featured.map((trip) => trip.slug).join(", ")}). ` +
        "De homepage licht er maar één uit.",
    );
  }
}

assertTripsConsistent(TRIPS);

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
  return GALLERY;
}
