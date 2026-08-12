import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { TripDetail } from "@/components/trips/trip-detail";
import { getTripBySlug, getTripSlugs } from "@/lib/content";
import { graph, tripSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";
import { formatDateLong, formatPrice, tripFullTitle } from "@/lib/utils";

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

  return pageMetadata({
    title: tripFullTitle(trip),
    description,
    path: `/reizen/${trip.slug}`,
    image: trip.coverImage,
    type: "article",
    modifiedTime: trip.updatedAt,
  });
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

  return (
    <>
      {/* Prijs en beschikbaarheid, zodat Google ze in het zoekresultaat kan
          tonen. Het kruimelpad-schema zit in de Breadcrumbs-component. */}
      <JsonLd data={graph(tripSchema(trip))} />
      <TripDetail trip={trip} />
    </>
  );
}
