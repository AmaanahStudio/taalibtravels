import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripDetail } from "@/components/trips/trip-detail";
import { SITE } from "@/lib/content";
import imageLoader from "@/lib/image-loader";
import { getTripBySlug } from "@/lib/trips";
import { formatDateLong, formatPrice } from "@/lib/utils";

// Leest per verzoek uit D1: een nieuwe of gewijzigde reis staat meteen live, en
// een onbekende slug of een concept geeft de 404-pagina.
export const dynamic = "force-dynamic";

/**
 * Breedte van het deelbeeld (WhatsApp, Facebook). Een vaste variant uit de
 * ladder, omdat een beheerde foto zonder breedte geen bestand is.
 */
const OG_WIDTH = 1080;

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
      images: [
        {
          url: imageLoader({ src: cover.src, width: OG_WIDTH }),
          width: OG_WIDTH,
          height: Math.round((cover.height * OG_WIDTH) / cover.width),
          alt: cover.alt,
        },
      ],
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
