import type { Metadata } from "next";

import { Hero } from "@/components/home/hero";
import { GallerySection } from "@/components/trips/gallery-section";
import { NoTrips } from "@/components/trips/no-trips";
import { TripCard } from "@/components/trips/trip-card";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/section";
import { SITE } from "@/lib/content";
import { getGallery, getNextTrip, getTrips } from "@/lib/trips";

// Leest per verzoek uit D1, zodat een wijziging in het beheer meteen live staat.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE.name} - ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  // `getNextTrip` leest via dezelfde (per verzoek ontdubbelde) lijst als
  // `getTrips`; de galerij is een losse query en loopt parallel mee.
  const [trip, trips, gallery] = await Promise.all([
    getNextTrip(),
    getTrips(),
    getGallery(),
  ]);

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

        {trips.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.slice(0, 3).map((upcoming) => (
              <TripCard key={upcoming.slug} trip={upcoming} />
            ))}
          </div>
        ) : (
          <NoTrips className="mt-10" />
        )}

        {trips.length > 3 && (
          <div className="mt-10 flex justify-center">
            <Button href="/reizen" variant="outline" size="lg">
              Alle {trips.length} reizen bekijken
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </Section>

      {/* Een lege gedeelde galerij (bv. vóór de eerste upload) laat de sectie
          weg in plaats van een kopje boven een leeg raster te tonen. */}
      {gallery.length > 0 && (
        <Section id="fotos" spacing="continue">
          <SectionHeading eyebrow="Beelden" title="Foto's" />
          <GallerySection images={gallery} featureFirst className="mt-10" />
        </Section>
      )}
    </>
  );
}
