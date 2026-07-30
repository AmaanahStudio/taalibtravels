import { HeroVideo } from "@/components/home/hero-video";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { Container } from "@/components/ui/section";
import { SITE } from "@/lib/content";
import type { Trip } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

/**
 * Hero van de homepage, gebaseerd op de poster: tagline, een enorme
 * "UMRAH BUDGET"-titel, korte intro en een duidelijke WhatsApp-CTA.
 *
 * De kerncijfers zijn bewust algemeen gehouden — concrete vertrek- en
 * terugkomstdata horen op de detailpagina van een reis, niet op de homepage.
 */
export function Hero({
  trip,
  tripCount,
  startingPrice,
}: {
  /** Uitgelichte campagne — bepaalt de titel in de hero. */
  trip: Trip;
  /** Aantal geplande reizen, voor de kerncijfers. */
  tripCount: number;
  /** Laagste prijs over alle reizen heen. */
  startingPrice: number;
}) {
  const message = `Assalaamu alaykum, ik wil graag meer info over de Umrah-reizen van ${SITE.name}.`;

  const stats = [
    { label: "Bestemming", value: "Makkah & Madinah" },
    { label: "Begeleiding", value: "Nederlandstalig" },
    {
      label: "Vertrekdata",
      value: `${tripCount} ${tripCount === 1 ? "reis" : "reizen"} gepland`,
    },
  ];

  return (
    <section className="relative isolate overflow-hidden pt-24 pb-16 sm:pt-28 lg:pt-32 lg:pb-24">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Tekstkolom */}
          <div className="flex animate-fade-up flex-col gap-7">
            <div className="flex flex-col gap-1">
              <h1 className="display-title text-6xl text-heading sm:text-7xl lg:text-8xl">
                {trip.title.split(" ")[0]}
                <span className="mt-1 block text-4xl text-accent sm:text-5xl lg:text-6xl">
                  {trip.title.split(" ").slice(1).join(" ") || "Reizen"}
                </span>
              </h1>
            </div>

            <p className="max-w-xl text-base leading-relaxed text-body sm:text-lg">
              Vlucht, hotel in Makkah en Madinah, visum en Nederlandstalige
              begeleiding — alles zit erbij. Jij hoeft alleen te kiezen wanneer
              je gaat.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <WhatsAppButton label="WhatsApp" message={message} />
              <Button href="/reizen" variant="outline" size="lg">
                Bekijk alle reizen
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>

            {/* Kerncijfers, met blauwe lijn zoals de bullets op de poster */}
            <dl className="mt-2 grid gap-5 border-t border-line pt-7 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="relative flex flex-col gap-1.5 pl-4"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent-strong"
                  />
                  <dt className="text-[0.65rem] font-semibold tracking-[0.22em] text-accent uppercase">
                    {stat.label}
                  </dt>
                  <dd className="text-sm font-semibold text-heading">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Videocompilatie */}
          <div className="relative animate-fade-in lg:pl-6">
            <HeroVideo />

            {/* Zwevende prijskaart over de video heen */}
            <div className="absolute -bottom-6 -left-2 animate-float rounded-3xl border border-line bg-raised/85 px-6 py-5 backdrop-blur-xl sm:-left-6 sm:px-8 sm:py-6">
              <span className="text-[0.65rem] font-semibold tracking-[0.22em] text-accent uppercase">
                Vanaf
              </span>
              <p className="font-display text-3xl text-heading sm:text-4xl">
                {formatPrice(startingPrice)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Termijnen mogelijk
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
