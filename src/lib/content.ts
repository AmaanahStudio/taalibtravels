import faqJson from "@/data/faq.json";
import galleryJson from "@/data/gallery.json";
import homeJson from "@/data/home.json";
import imagesJson from "@/data/images.json";
import inclusionsJson from "@/data/inclusions.json";
import navigationJson from "@/data/navigation.json";
import { PAGE_FILES } from "@/data/pages";
import siteJson from "@/data/site.json";
import { TRIP_FILES } from "@/data/trips";
import type {
  ContentPage,
  FaqItem,
  HomeContent,
  ImageAsset,
  Navigation,
  SiteConfig,
  Trip,
  TripInclusion,
} from "@/lib/types";

/**
 * De enige plek die de contentbestanden kent.
 *
 * Alle teksten, reizen en bedrijfsgegevens staan in `src/data`, opgesplitst per
 * onderwerp: `site.json`, `navigation.json`, `home.json`, `inclusions.json`,
 * `images.json`, `gallery.json`, `faq.json`, één bestand per reis onder `trips/`
 * en één per tekstpagina onder `pages/`. Dit bestand leest die in, pakt de
 * verwijzingen uit naar de domeintypes en levert de lees-functies die de
 * pagina's gebruiken. Er is geen backend en geen database: de JSON wordt bij het
 * bouwen meegebundeld, dus alle pagina's kunnen statisch gegenereerd worden.
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
export const NAV = navigationJson as Navigation;
export const FAQ = faqJson as FaqItem[];
export const HOME = homeJson as unknown as HomeContent;

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
 * Controle die pas klopt wanneer je alle reizen naast elkaar legt. Nu elke reis
 * een eigen bestand heeft, ziet niemand meer in één oogopslag dat twee reizen
 * dezelfde slug gebruiken — daarom hier.
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
 * De reis die de homepage uitlicht: de eerstvolgende die nog niet voorbij is.
 * `TRIPS` staat op vertrekdatum gesorteerd, dus de eerste reis die vandaag nog
 * niet terug is, is de juiste. Zijn ze allemaal geweest, dan blijft de laatste
 * staan — een lege hero is erger dan een verlopen datum.
 *
 * De datum wordt hier berekend en niet op moduleniveau: dit bestand belandt via
 * de navbar ook in de browserbundel, en een tijdstip dat server en client
 * verschillend invullen geeft een hydration-mismatch. Deze functie wordt alleen
 * vanuit een server component aangeroepen.
 */
export function getNextTrip(): Trip {
  const today = new Date().toISOString().slice(0, 10);

  return (
    TRIPS.find((trip) => trip.returnDate >= today) ?? TRIPS[TRIPS.length - 1]
  );
}

/** Slugs voor `generateStaticParams`, zodat elke detailpagina statisch wordt. */
export function getTripSlugs(): string[] {
  return TRIPS.map((trip) => trip.slug);
}

/** Gedeelde fotopool, voor de galerij op de homepage. */
export function getGallery(): ImageAsset[] {
  return GALLERY;
}

/*
 * Losse tekstpagina's (`/umrah`, `/over-ons`). Dezelfde opzet als de reizen:
 * één JSON-bestand per pagina, een handgeschreven register, en hier het
 * uitpakken plus de controle dat er geen twee dezelfde slug gebruiken.
 */
const PAGES = PAGE_FILES as unknown as ContentPage[];

const PAGES_BY_SLUG = new Map<string, ContentPage>();

for (const page of PAGES) {
  if (PAGES_BY_SLUG.has(page.slug)) {
    throw new Error(
      `Twee tekstpagina's gebruiken de slug "${page.slug}". Een slug vormt de URL en moet uniek zijn.`,
    );
  }

  PAGES_BY_SLUG.set(page.slug, page);
}

/**
 * Eén tekstpagina. Gooit wanneer de slug niet bestaat in plaats van `null` te
 * geven: deze pagina's hebben elk een eigen route die de slug hardcodeert, dus
 * een misser is een typefout die de build hoort te breken — niet een 404 die
 * pas een bezoeker opvalt.
 */
export function getContentPage(slug: string): ContentPage {
  const page = PAGES_BY_SLUG.get(slug);

  if (!page) {
    throw new Error(
      `src/data/pages: er is geen pagina met de slug "${slug}". Staat het bestand in het register in pages/index.ts?`,
    );
  }

  return page;
}

/** Alle tekstpagina's, voor de sitemap. */
export function getContentPages(): ContentPage[] {
  return PAGES;
}

/** De handvol vragen die ook op de homepage en de contactpagina staan. */
export function getFeaturedFaq(): FaqItem[] {
  return FAQ.filter((item) => item.featured);
}

/**
 * De volledige FAQ, gegroepeerd op categorie. De volgorde van de categorieën
 * volgt die van `faq.json`, zodat de redactievolgorde leidend blijft.
 */
export function getFaqByCategory(): Array<{
  category: string;
  items: FaqItem[];
}> {
  const groups = new Map<string, FaqItem[]>();

  for (const item of FAQ) {
    const group = groups.get(item.category);

    if (group) {
      group.push(item);
    } else {
      groups.set(item.category, [item]);
    }
  }

  return [...groups].map(([category, items]) => ({ category, items }));
}
