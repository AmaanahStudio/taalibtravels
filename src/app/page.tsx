import type { Metadata } from "next";

import { Hero } from "@/components/home/hero";
import { GallerySection } from "@/components/trips/gallery-section";
import { TripCard } from "@/components/trips/trip-card";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/section";
import { SITE, getGallery, getNextTrip, getTrips } from "@/lib/content";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const trip = getNextTrip();
  const trips = getTrips();
  const gallery = getGallery();

  return (
    <>
      <Hero trip={trip} />

      {/* Reisaanbod. "Wat zit erbij" staat bewust alleen op de detailpagina van
          een reis, niet hier. */}
      <Section id="reizen" spacing="continue">
        <SectionHeading
          eyebrow="Ons aanbod"
          title="Onze reizen"
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.slice(0, 3).map((upcoming) => (
            <TripCard key={upcoming.slug} trip={upcoming} />
          ))}
        </div>

        {trips.length > 3 && (
          <div className="mt-10 flex justify-center">
            <Button href="/reizen" variant="outline" size="lg">
              Alle {trips.length} reizen bekijken
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </Section>

      <Section id="fotos" spacing="continue">
        <SectionHeading
          eyebrow="Beelden"
          title="Foto's"
        />
        <GallerySection images={gallery} featureFirst className="mt-10" />
      </Section>
    </>
  );
}
