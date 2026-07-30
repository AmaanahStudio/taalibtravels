import type { Metadata } from "next";

import { TripCard } from "@/components/trips/trip-card";
import { Section, SectionHeading } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { SITE, getTrips } from "@/lib/content";

export const metadata: Metadata = {
  title: "Onze Umrah-reizen",
  description:
    "Bekijk alle Umrah-reizen van TaalibTravels: data, prijzen en wat er inbegrepen is. Van de budgetreis in november tot de laatste tien nachten van Ramadan.",
  alternates: { canonical: "/reizen" },
  openGraph: {
    title: `Onze Umrah-reizen | ${SITE.name}`,
    description:
      "Alle Umrah-reizen van TaalibTravels met data, prijzen en inbegrepen diensten.",
    url: `${SITE.url}/reizen`,
  },
};

export default function TripsPage() {
  const trips = getTrips();

  return (
    <Section spacing="none" className="pt-24 pb-16 sm:pt-28 sm:pb-20 lg:pb-28">
      {/* TODO(content): laat de klant deze belofte nalezen — het is de eerste
          zin die een bezoeker op deze pagina leest. */}
      <SectionHeading
        as="h1"
        eyebrow="Ons aanbod"
        title="Kies je reis"
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
