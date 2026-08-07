import type { Metadata } from "next";

import { Hero } from "@/components/home/hero";
import { FeatureList } from "@/components/trips/feature-list";
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

      {/* Wat er bij elke reis inbegrepen zit — bewust algemeen, want dit is de
          homepage en geen detailpagina van één reis. */}
      <Section id="inclusief">
        <SectionHeading
          eyebrow="Inclusief"
          title="Wat zit erbij"
          intro="Bij elke reis zit hetzelfde pakket, zonder verrassingen achteraf."
        />
        <FeatureList items={trip.inclusions} className="mt-10" />
      </Section>

      {/* Reisaanbod */}
      <Section id="reizen" spacing="continue">
        <SectionHeading
          eyebrow="Ons aanbod"
          title="Onze reizen"
          intro="Elke reis heeft eigen data en een eigen prijs. Bekijk de details van de reis die bij jou past."
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
          eyebrow="Sfeerbeeld"
          title="Foto's"
          intro="Beelden van eerdere reizen: de rituelen, de lessen en de momenten ertussenin."
        />
        <GallerySection images={gallery} featureFirst className="mt-10" />
      </Section>
    </>
  );
}
