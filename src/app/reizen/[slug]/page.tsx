import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripDetail } from "@/components/trips/trip-detail";
import { SITE } from "@/lib/content";
import { OG_BREEDTE } from "@/lib/foto-breedtes";
import imageLoader from "@/lib/image-loader";
import { getTripBySlug } from "@/lib/trips";
import type { ImageAsset } from "@/lib/types";
import { formatDateLong, formatPrice } from "@/lib/utils";

// Leest per verzoek uit D1: een nieuwe of gewijzigde reis staat meteen live, en
// een onbekende slug of een concept geeft de 404-pagina.
export const dynamic = "force-dynamic";

/**
 * Het deelbeeld van een beheerde foto is een JPEG (`og.jpg`, 1200px breed, of de
 * bronbreedte als die smaller is): niet elke previewer leest WebP. Een foto buiten
 * het beheer heeft geen `og.jpg` en valt terug op een vaste WebP-variant.
 * Ontbreekt `og.jpg` voor een beheerde foto, dan geeft de preview een 404 en toont
 * de pagina zelf gewoon; draai het seed-script opnieuw om het bij te maken.
 */
function ogAfbeelding(cover: ImageAsset) {
  if (/^\/media\/fotos\/[a-z0-9-]+$/.test(cover.src)) {
    const width = Math.min(OG_BREEDTE, cover.width);
    return {
      url: `${cover.src}/og.jpg`,
      width,
      height: Math.round((cover.height * width) / cover.width),
      type: "image/jpeg",
      alt: cover.alt,
    };
  }
  const width = 1080;
  return {
    url: imageLoader({ src: cover.src, width }),
    width,
    height: Math.round((cover.height * width) / cover.width),
    alt: cover.alt,
  };
}

export async function generateMetadata(
  props: PageProps<"/reizen/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const trip = await getTripBySlug(slug);

  if (!trip) {
    return { title: "Reis niet gevonden" };
  }

  const description = `${trip.summary} Vertrek ${formatDateLong(trip.departureDate)} — ${formatPrice(trip.price.amount)} per persoon.`;
  const cover = trip.coverImage;

  return {
    title: `${trip.title} — ${trip.subtitle}`,
    description,
    alternates: { canonical: `/reizen/${trip.slug}` },
    openGraph: {
      type: "article",
      title: `${trip.title} | ${SITE.name}`,
      description,
      url: `${SITE.url}/reizen/${trip.slug}`,
      images: [ogAfbeelding(cover)],
    },
  };
}

export default async function TripDetailPage(
  props: PageProps<"/reizen/[slug]">,
) {
  const { slug } = await props.params;
  const trip = await getTripBySlug(slug);

  if (!trip) {
    notFound();
  }

  return <TripDetail trip={trip} />;
}
