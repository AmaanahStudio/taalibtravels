import type { Metadata } from "next";

import { FaqList } from "@/components/content/faq-list";
import { Hero } from "@/components/home/hero";
import { StepList } from "@/components/home/step-list";
import { UspGrid } from "@/components/home/usp-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { GallerySection } from "@/components/trips/gallery-section";
import { TripCard } from "@/components/trips/trip-card";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Section, SectionHeading } from "@/components/ui/section";
import {
  HOME,
  SITE,
  getFeaturedFaq,
  getGallery,
  getNextTrip,
  getTrips,
} from "@/lib/content";
import { graph, heroVideoSchema, tripListSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    path: "/",
  }),
  // De homepage draagt de volledige naam zelf; het `%s | naam`-template zou
  // hem anders verdubbelen.
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
};

export default function HomePage() {
  const trip = getNextTrip();
  const trips = getTrips();
  const gallery = getGallery();
  const faq = getFeaturedFaq();

  return (
    <>
      <JsonLd data={graph(heroVideoSchema(), tripListSchema(trips))} />

      <Hero trip={trip} />

      {/* Introtekst. De hero is kort en visueel; hier staat in gewone zinnen
          wat we doen en voor wie — de eerste substantiële tekst op de site. */}
      <Section spacing="continue">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <SectionHeading
            eyebrow={HOME.intro.eyebrow}
            title={HOME.intro.heading}
          />
          <div className="flex flex-col gap-4">
            {HOME.intro.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="text-base leading-relaxed text-body"
              >
                {paragraph}
              </p>
            ))}
            <Button
              href="/umrah"
              variant="outline"
              size="lg"
              className="mt-2 w-fit"
            >
              Lees wat een Umrah inhoudt
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </Section>

      {/* Reisaanbod. "Wat zit erbij" staat bewust alleen op de detailpagina van
          een reis, niet hier. */}
      <Section id="reizen" spacing="continue">
        <SectionHeading eyebrow="Ons aanbod" title="Onze reizen" />

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

      <Section id="waarom" spacing="continue">
        <SectionHeading
          eyebrow={HOME.usps.eyebrow}
          title={HOME.usps.heading}
        />
        <UspGrid items={HOME.usps.items} className="mt-10" />
      </Section>

      <Section id="zo-werkt-het" spacing="continue">
        <SectionHeading
          eyebrow={HOME.steps.eyebrow}
          title={HOME.steps.heading}
        />
        <StepList items={HOME.steps.items} className="mt-12" />
      </Section>

      <Section id="fotos" spacing="continue">
        <SectionHeading eyebrow="Beelden" title="Foto's" />
        <GallerySection images={gallery} featureFirst className="mt-10" />
      </Section>

      {/* De meestgestelde vragen alvast op de homepage; de rest staat op de
          eigen FAQ-pagina, die het FAQPage-schema draagt. */}
      <Section id="vragen" spacing="continue">
        <SectionHeading eyebrow={HOME.faq.eyebrow} title={HOME.faq.heading} />
        <FaqList items={faq} className="mt-10" />
        <div className="mt-10">
          <Button href="/veelgestelde-vragen" variant="outline" size="lg">
            Alle veelgestelde vragen
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </Section>
    </>
  );
}
