import Image from "next/image";
import Link from "next/link";

import { DateBlock } from "@/components/trips/date-block";
import { FeatureList } from "@/components/trips/feature-list";
import { GallerySection } from "@/components/trips/gallery-section";
import { PriceBlock } from "@/components/trips/price-block";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container, Section, SectionHeading } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { WhatsAppCta } from "@/components/ui/whatsapp-cta";
import type { Trip } from "@/lib/types";
import { formatDateLong, nightsBetween } from "@/lib/utils";

const AUDIENCE_LABEL: Record<Trip["audience"], string> = {
  brothers: "Enkel broeders",
  sisters: "Enkel zusters",
  mixed: "Broeders & zusters",
  families: "Families",
};

/** Volledige detailweergave van één reis: alle info van de poster plus het aanmeldformulier. */
export function TripDetail({ trip }: { trip: Trip }) {
  const nights = nightsBetween(trip.departureDate, trip.returnDate);
  const message = `Assalaamu alaykum, ik heb een vraag over "${trip.title}" (${formatDateLong(trip.departureDate)}).`;
  const reservationMessage = `Assalaamu alaykum, ik wil graag een plek reserveren voor "${trip.title}" (${trip.subtitle}).`;

  return (
    <>
      {/* Kop met cover-afbeelding */}
      <section className="relative isolate overflow-hidden pt-28 pb-4 sm:pt-36">
        <Container>
          <Link
            href="/reizen"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-heading"
          >
            <ArrowRightIcon className="size-4 rotate-180" />
            Alle reizen
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{trip.subtitle}</Badge>
                <Badge tone="muted">{AUDIENCE_LABEL[trip.audience]}</Badge>
                {trip.spotsLeft <= 5 && (
                  <Badge tone="alert">Nog {trip.spotsLeft} plekken</Badge>
                )}
              </div>

              <h1 className="display-title text-5xl text-heading sm:text-6xl lg:text-7xl">
                {trip.title}
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-body sm:text-lg">
                {trip.summary}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <WhatsAppButton label="Reserveer je plek" message={message} />
                <a
                  href="#programma"
                  className="inline-flex items-center justify-center gap-2.5 rounded-full border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold whitespace-nowrap text-heading transition-all hover:border-accent/60 hover:bg-surface-strong sm:px-8 sm:py-4 sm:text-base"
                >
                  Bekijk het programma
                  <ArrowRightIcon className="size-4" />
                </a>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-4xl border border-line bg-sunken shadow-media">
              <Image
                src={trip.coverImage.src}
                alt={trip.coverImage.alt}
                width={trip.coverImage.width}
                height={trip.coverImage.height}
                priority
                sizes="(max-width: 1024px) 100vw, 520px"
                className="aspect-[4/3] w-full object-cover"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page/70 via-transparent to-transparent"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Datum */}
      <Section id="datum">
        <SectionHeading
          eyebrow="Datum?"
          title="Vertrek & terugkomst"
          intro={`${nights} dagen, van ${formatDateLong(trip.departureDate)} tot ${formatDateLong(trip.returnDate)}.`}
        />
        <DateBlock
          departureDate={trip.departureDate}
          returnDate={trip.returnDate}
          className="mt-10"
        />
      </Section>

      {/* Inclusief */}
      <Section id="inclusief" spacing="continue">
        <SectionHeading
          eyebrow="Inclusief?"
          title="Wat zit erbij"
          intro="Dit zit allemaal in de prijs."
        />
        <FeatureList items={trip.inclusions} className="mt-10" />
      </Section>

      {/* Beschrijving */}
      <Section id="programma" spacing="continue">
        <SectionHeading eyebrow="Programma" title="Over deze reis" />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {trip.description.map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="text-base leading-relaxed text-body"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </Section>

      {/* Prijs */}
      <Section id="prijs" spacing="continue">
        <SectionHeading eyebrow="Prijs?" title="Wat kost het" />
        <PriceBlock trip={trip} className="mt-10" />
      </Section>

      {/* Fotogalerij */}
      <Section id="fotos" spacing="continue">
        <SectionHeading
          eyebrow="Sfeerbeeld"
          title="Foto's"
          intro="Beelden van eerdere reizen: de rituelen, de lessen en de momenten ertussenin."
        />
        <GallerySection images={trip.gallery} featureFirst className="mt-10" />
      </Section>

      {/* Afsluitende oproep: wie helemaal doorscrolt hoeft niet terug omhoog. */}
      <Section id="reserveren" spacing="continue">
        <WhatsAppCta
          eyebrow="Reserveren"
          title="Klaar om te vertrekken?"
          description={
            trip.price.installmentsAvailable
              ? `Stuur ons een bericht en we bevestigen je plek voor ${trip.title}. Wil je in termijnen betalen? Laat het weten, dan stellen we samen een plan op.`
              : `Stuur ons een bericht en we bevestigen je plek voor ${trip.title}.`
          }
          message={reservationMessage}
        />
      </Section>
    </>
  );
}
