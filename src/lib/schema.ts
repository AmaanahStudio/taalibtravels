import { SITE } from "@/lib/content";
import { MAX_IMAGE_WIDTH, optimizedImage } from "@/lib/image-variants";
import type { ContentPage, FaqItem, Trip, TripAudience } from "@/lib/types";
import { tripFullTitle } from "@/lib/utils";

/**
 * De enige module die schema.org kent.
 *
 * Zoekmachines lezen de zichtbare tekst, maar prijzen, beschikbaarheid en
 * kruimelpaden komen alleen als rich result in de zoekresultaten wanneer ze óók
 * als JSON-LD op de pagina staan. Dit bestand bouwt die blokken uit dezelfde
 * data als de pagina's zelf, zodat het schema niet uit de pas kan lopen met wat
 * de bezoeker ziet — dat is precies waar Google op afrekent.
 *
 * De organisatie en de site staan één keer beschreven, in de root layout, met
 * een vaste `@id`. Pagina's herhalen die niet maar verwijzen ernaar. Zo ziet een
 * zoekmachine één bedrijf met meerdere pagina's in plaats van vijf losse
 * beschrijvingen die toevallig dezelfde naam dragen.
 */

/** JSON-LD is vrij van vorm; dit houdt het typebaar zonder extra dependency. */
export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;

/** Schema.org wil absolute URL's; overal elders in de code staan paden. */
function absolute(path: string): string {
  if (path.startsWith("http")) return path;

  // "/" zou anders een dubbele slash of een afwijkende homepage-URL opleveren,
  // terwijl de canonical van de homepage zonder slash staat.
  return path === "/" ? SITE.url : `${SITE.url}${path}`;
}

/**
 * De prijsgarantie loopt tot een maand voor vertrek — zie de FAQ. Dertig dagen
 * aftrekken in plaats van de maand verlagen voorkomt de randgevallen rond de
 * 31e van een maand.
 */
const PRICE_GUARANTEE_DAYS = 30;

/**
 * Geeft `undefined` zodra de garantie verlopen is. Een `priceValidUntil` in het
 * verleden leest Google als een verouderde prijs en is een reden om de prijs
 * helemaal niet meer in het zoekresultaat te tonen — dan liever geen datum dan
 * een datum die tegen ons werkt.
 */
function priceValidUntil(departureDate: string): string | undefined {
  const ms =
    Date.parse(`${departureDate}T00:00:00Z`) -
    PRICE_GUARANTEE_DAYS * 86_400_000;

  if (ms <= Date.now()) return undefined;

  return new Date(ms).toISOString().slice(0, 10);
}

/** Voor wie de reis bedoeld is, in gewone taal voor `touristType`. */
const AUDIENCE_LABELS: Record<TripAudience, string> = {
  brothers: "Broeders",
  sisters: "Zusters",
  mixed: "Broeders en zusters",
  families: "Gezinnen",
};

/**
 * Alleen een compleet adres gaat mee. Een `PostalAddress` met lege velden is
 * voor Google slechter dan geen adres: het maakt de vermelding onbetrouwbaar
 * in plaats van onvolledig.
 */
function postalAddress(): JsonLdNode | undefined {
  const { street, postalCode, city, region, country } = SITE.address;

  if (!street || !postalCode || !city) return undefined;

  return {
    "@type": "PostalAddress",
    streetAddress: street,
    postalCode,
    addressLocality: city,
    ...(region ? { addressRegion: region } : {}),
    addressCountry: country,
  };
}

/**
 * Het bedrijf. `TravelAgency` is een subtype van `LocalBusiness`, dus dit is
 * meteen de basis voor lokale zoekresultaten.
 */
function organization(): JsonLdNode {
  const address = postalAddress();

  return {
    "@type": "TravelAgency",
    "@id": ORGANIZATION_ID,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    email: SITE.email,
    telephone: `+${SITE.whatsapp.international}`,
    priceRange: SITE.priceRange,
    image: absolute("/images/og-image.jpg"),
    logo: {
      "@type": "ImageObject",
      url: absolute("/images/logo.png"),
    },
    sameAs: [SITE.instagram.url],
    knowsLanguage: ["nl"],
    areaServed: SITE.areaServed.map((code) => ({
      "@type": "Country",
      identifier: code,
    })),
    ...(address ? { address } : {}),
  };
}

function website(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "nl",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Wikkelt losse nodes in de `@graph` die op de pagina belandt. */
export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** Staat op elke pagina, via de root layout. */
export function siteSchema(): JsonLdNode {
  return graph(organization(), website());
}

/** Kruimelpad; levert de padregel onder het zoekresultaat. */
export function breadcrumbSchema(
  trail: Array<{ name: string; path: string }>,
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

/** Beschikbaarheid volgt de reisdata, zodat een volle reis dat ook uitstraalt. */
function availability(trip: Trip): string {
  if (trip.status === "sold-out") return "https://schema.org/SoldOut";

  if (trip.spotsLeft !== undefined && trip.spotsLeft <= 5) {
    return "https://schema.org/LimitedAvailability";
  }

  return "https://schema.org/InStock";
}

/**
 * Eén reis, met een dubbel type.
 *
 * `Product` + `Offer` is wat Google leest om prijs en beschikbaarheid in het
 * zoekresultaat te zetten; `TouristTrip` beschrijft wat het écht is en is wat
 * AI-zoekmachines oppikken. Eén node mag meerdere types dragen, dus dit levert
 * allebei op zonder de reis twee keer te beschrijven.
 */
export function tripSchema(trip: Trip): JsonLdNode {
  const url = absolute(`/reizen/${trip.slug}`);
  const validUntil = priceValidUntil(trip.departureDate);

  return {
    "@type": ["Product", "TouristTrip"],
    "@id": `${url}#reis`,
    name: tripFullTitle(trip),
    description: [trip.summary, ...trip.description].join(" "),
    url,
    // Dezelfde WebP-varianten als op de pagina zelf: Google controleert of de
    // opgegeven afbeelding ook echt bij de pagina hoort.
    image: [trip.coverImage, ...trip.gallery].map((image) =>
      absolute(optimizedImage(image.src, MAX_IMAGE_WIDTH)),
    ),
    brand: { "@id": ORGANIZATION_ID },
    provider: { "@id": ORGANIZATION_ID },
    touristType: AUDIENCE_LABELS[trip.audience],
    departureTime: trip.departureDate,
    arrivalTime: trip.returnDate,
    itinerary: {
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "City",
            name: "Makkah",
            address: {
              "@type": "PostalAddress",
              addressCountry: "SA",
            },
          },
        },
        {
          "@type": "ListItem",
          position: 2,
          item: {
            "@type": "City",
            name: "Madinah",
            address: {
              "@type": "PostalAddress",
              addressCountry: "SA",
            },
          },
        },
      ],
    },
    includesObject: trip.inclusions.map((inclusion) => ({
      "@type": "TypeAndQuantityNode",
      amountOfThisGood: 1,
      typeOfGood: {
        "@type": "Service",
        name: inclusion.label,
      },
    })),
    offers: {
      "@type": "Offer",
      price: trip.price.amount.toFixed(2),
      priceCurrency: trip.price.currency,
      availability: availability(trip),
      url,
      ...(validUntil ? { priceValidUntil: validUntil } : {}),
      validThrough: trip.departureDate,
      seller: { "@id": ORGANIZATION_ID },
    },
  };
}

/** Het reisoverzicht als geordende lijst, zodat Google de reizen samen ziet. */
export function tripListSchema(trips: Trip[]): JsonLdNode {
  return {
    "@type": "ItemList",
    name: "Umrah reizen van TaalibTravels",
    numberOfItems: trips.length,
    itemListElement: trips.map((trip, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tripFullTitle(trip),
      url: absolute(`/reizen/${trip.slug}`),
    })),
  };
}

/**
 * Google toont hier sinds 2023 zelden nog sterretjes voor; dit staat er voor
 * Bing en voor de AI-antwoorden die steeds vaker vóór de blauwe links komen.
 */
export function faqSchema(items: FaqItem[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** Een tekstpagina zoals `/umrah` of `/over-ons`. */
export function articleSchema(page: ContentPage): JsonLdNode {
  const url = absolute(`/${page.slug}`);

  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: page.heading,
    description: page.description,
    url,
    inLanguage: "nl",
    dateModified: page.updatedAt,
    image: absolute("/images/og-image.jpg"),
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    mainEntityOfPage: url,
  };
}

/** De hero-compilatie; maakt de homepage in aanmerking komen voor videoresultaten. */
export function heroVideoSchema(): JsonLdNode {
  const { name, description, uploadDate, src, poster } = SITE.heroVideo;

  return {
    "@type": "VideoObject",
    name,
    description,
    uploadDate,
    contentUrl: absolute(src),
    thumbnailUrl: [absolute(poster)],
  };
}

/** De contactpagina, gekoppeld aan het bedrijf. */
export function contactPageSchema(): JsonLdNode {
  return {
    "@type": "ContactPage",
    "@id": `${absolute("/contact")}#webpage`,
    url: absolute("/contact"),
    name: `Contact — ${SITE.name}`,
    inLanguage: "nl",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORGANIZATION_ID },
  };
}

/** Het reisoverzicht als verzamelpagina. */
export function collectionPageSchema(
  path: string,
  name: string,
  description: string,
): JsonLdNode {
  return {
    "@type": "CollectionPage",
    "@id": `${absolute(path)}#webpage`,
    url: absolute(path),
    name,
    description,
    inLanguage: "nl",
    isPartOf: { "@id": WEBSITE_ID },
  };
}
