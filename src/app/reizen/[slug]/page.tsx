import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripDetail } from "@/components/trips/trip-detail";
import { SITE, getTripBySlug, getTripSlugs } from "@/lib/content";
import { formatDateLong, formatPrice } from "@/lib/utils";

/** Bouwt alle detailpagina's statisch tijdens de build. */
export function generateStaticParams() {
  return getTripSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/reizen/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const trip = getTripBySlug(slug);

  if (!trip) {
    return { title: "Reis niet gevonden" };
  }

  const description = `${trip.summary} Vertrek ${formatDateLong(trip.departureDate)} — ${formatPrice(trip.price.amount)} per persoon.`;

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
          url: trip.coverImage.src,
          width: trip.coverImage.width,
          height: trip.coverImage.height,
          alt: trip.coverImage.alt,
        },
      ],
    },
  };
}

export default async function TripDetailPage(
  props: PageProps<"/reizen/[slug]">,
) {
  // `params` is in Next.js 16 een Promise; de content zelf komt synchroon uit
  // het JSON-bestand.
  const { slug } = await props.params;
  const trip = getTripBySlug(slug);

  if (!trip) {
    notFound();
  }

  return <TripDetail trip={trip} />;
}
