import Image from "next/image";
import Link from "next/link";

import { DateBlock } from "@/components/trips/date-block";
import { FeatureList } from "@/components/trips/feature-list";
import { GallerySection } from "@/components/trips/gallery-section";
import { PriceBlock } from "@/components/trips/price-block";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container, Section, SectionHeading } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { WhatsAppCta } from "@/components/ui/whatsapp-cta";
import type { Trip } from "@/lib/types";
import { formatDateLong, tripFullTitle, tripTitleParts } from "@/lib/utils";

/** Doorverwijzingen onder aan de reis, voor wie nog aan het oriënteren is. */
const RELATED = [
  {
    href: "/umrah",
    title: "Wat is een Umrah?",
    body: "De rituelen stap voor stap, de beste periode en wat je nodig hebt aan visum en documenten.",
  },
  {
    href: "/veelgestelde-vragen",
    title: "Veelgestelde vragen",
    body: "Over betalen in termijnen, kamers delen, reizen zonder mahram en wat er in de prijs zit.",
  },
] as const;

/** Volledige detailweergave van één reis: alle info van de poster plus het aanmeldformulier. */
export function TripDetail({ trip }: { trip: Trip }) {
  const titleParts = tripTitleParts(trip);
  const message = `Assalaamu alaykum, ik heb een vraag over "${trip.title}" (${formatDateLong(trip.departureDate)}).`;
  const reservationMessage = `Assalaamu alaykum, ik wil graag een plek reserveren voor "${trip.title}" (${trip.subtitle}).`;

  return (
    <>
      {/* Kop met cover-afbeelding */}
      <section className="relative isolate overflow-hidden pt-28 pb-4 sm:pt-36">
        <Container>
          <Breadcrumbs
            trail={[
              { name: "Home", path: "/" },
              { name: "Reizen", path: "/reizen" },
              { name: tripFullTitle(trip), path: `/reizen/${trip.slug}` },
            ]}
          />

          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="flex flex-col gap-6">
              {/* De periode hoort in de `<h1>`: "Umrah September 2026" is waar
                  mensen op zoeken, "Umrah September" niet. `tripTitleParts`
                  houdt de maand eruit als de titel hem al draagt. */}
              <h1 className="display-title text-5xl text-heading sm:text-6xl lg:text-7xl">
                {titleParts.title}
                {titleParts.rest && (
                  <>
                    {" "}
                    <span className="mt-1 block text-3xl text-accent sm:text-4xl lg:text-5xl">
                      {titleParts.rest}
                    </span>
                  </>
                )}
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
        <SectionHeading eyebrow="Datum" title="Vertrek & terugkomst" />
        <DateBlock
          departureDate={trip.departureDate}
          returnDate={trip.returnDate}
          className="mt-10"
        />
      </Section>

      {/* Inclusief */}
      <Section id="inclusief" spacing="continue">
        <SectionHeading
          eyebrow="Inclusief"
          title="Wat zit erbij"
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
        <SectionHeading eyebrow="Prijs" title="Wat kost het" />
        <PriceBlock trip={trip} className="mt-10" />
      </Section>

      {/* Fotogalerij */}
      <Section id="fotos" spacing="continue">
        <SectionHeading
          eyebrow="BeeldEN"
          title="Foto's"
        />
        <GallerySection images={trip.gallery} featureFirst className="mt-10" />
      </Section>

      {/* Doorverwijzingen voor wie nog twijfelt. Ze houden bezoekers op de site
          in plaats van terug naar de zoekresultaten, en ze geven de gids- en
          FAQ-pagina interne links vanaf elke reis. */}
      <Section id="meer-weten" spacing="continue">
        <SectionHeading eyebrow="Meer weten" title="Voor je boekt" />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {RELATED.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex h-full flex-col gap-3 rounded-3xl border border-line bg-surface p-6 transition-all hover:border-accent/40 hover:bg-surface-strong sm:p-7"
              >
                <span className="font-display text-lg tracking-[0.06em] text-heading uppercase transition-colors group-hover:text-accent">
                  {item.title}
                </span>
                <span className="text-sm leading-relaxed text-body">
                  {item.body}
                </span>
                <span className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold text-accent">
                  Lees verder
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
