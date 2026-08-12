import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { TripCard } from "@/components/trips/trip-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Section, SectionHeading } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { SITE, getTrips } from "@/lib/content";
import { collectionPageSchema, graph, tripListSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Umrah reizen 2026 — data en prijzen";
const DESCRIPTION =
  "Alle Umrah-reizen van TaalibTravels op een rij: vertrekdata, prijzen en wat er inbegrepen is. Kleine groepen, Nederlandstalige begeleiding en vertrek vanuit België en Nederland.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/reizen",
});

export default function TripsPage() {
  const trips = getTrips();

  return (
    <Section spacing="none" className="pt-24 pb-16 sm:pt-28 sm:pb-20 lg:pb-28">
      <JsonLd
        data={graph(
          collectionPageSchema("/reizen", TITLE, DESCRIPTION),
          tripListSchema(trips),
        )}
      />

      <Breadcrumbs
        trail={[
          { name: "Home", path: "/" },
          { name: "Reizen", path: "/reizen" },
        ]}
        className="mb-8"
      />

      {/* TODO(content): laat de klant deze belofte nalezen — het is de eerste
          zin die een bezoeker op deze pagina leest. */}
      <SectionHeading
        as="h1"
        eyebrow="Ons aanbod"
        title={TITLE}
        intro="Elke reis gaat met een kleine groep en is compleet: vlucht, hotel in Makkah en Madinah, visum en Nederlandstalige begeleiding. Kies de datum die je past — de rest regelen wij."
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip, index) => (
          <TripCard key={trip.slug} trip={trip} priority={index === 0} />
        ))}
      </div>

      {trips.length === 0 && (
        <p className="mt-12 rounded-3xl border border-line bg-surface p-10 text-center text-muted">
          Er staan momenteel geen reizen gepland. Stuur ons gerust een bericht —
          we informeren je zodra de nieuwe data bekend zijn.
        </p>
      )}

      <div className="mt-14 flex flex-col items-center gap-4 rounded-4xl border border-line bg-surface p-8 text-center sm:p-12">
        <h2 className="display-title text-3xl text-heading sm:text-4xl">
          Niet gevonden wat je zocht?
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-body sm:text-base">
          Stuur ons een bericht via WhatsApp. We plannen regelmatig extra
          vertrekdata en denken graag mee over wat voor jou past.
        </p>
        <WhatsAppButton
          label="Stel je vraag via WhatsApp"
          message={`Assalaamu alaykum, ik heb een vraag over de reizen van ${SITE.name}.`}
        />
      </div>
    </Section>
  );
}
