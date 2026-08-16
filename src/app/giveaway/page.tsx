import type { Metadata } from "next";

import { GiveawayForm } from "@/components/giveaway/giveaway-form";
import { Section, SectionHeading } from "@/components/ui/section";
import { GIVEAWAY, SITE, TURNSTILE_TESTSLEUTEL } from "@/lib/content";
import { formatDateLong } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Giveaway",
  description:
    "Doe mee aan de giveaway van TaalibTravels. Vul het formulier in om officieel deel te nemen en maak kans.",
  alternates: { canonical: "/giveaway" },
  openGraph: {
    title: `Giveaway | ${SITE.name}`,
    description: "Vul het formulier in en doe mee aan onze giveaway.",
    url: `${SITE.url}/giveaway`,
  },
};

export default function GiveawayPage() {
  /*
   * Turnstile's testsleutel laat élke inzending door, ook die van bots. Hem per
   * ongeluk laten staan is het soort fout dat je pas merkt als de lijst vol
   * rommel zit — vandaar dat de pagina er zichtbaar over klaagt in plaats van
   * het in een logregel te verstoppen.
   */
  const testsleutelActief = GIVEAWAY.turnstileSiteKey === TURNSTILE_TESTSLEUTEL;

  return (
    <Section spacing="none" className="pt-24 pb-20 sm:pt-28 sm:pb-24">
      <SectionHeading
        as="h1"
        align="center"
        eyebrow={GIVEAWAY.eyebrow}
        title={GIVEAWAY.title}
        intro={GIVEAWAY.intro}
      />

      {testsleutelActief && (
        <p className="mx-auto mt-8 max-w-2xl rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger">
          <strong className="font-semibold">Nog niet klaar voor publiek:</strong>{" "}
          er staat een Turnstile-testsleutel in <code>giveaway.json</code>. Die
          laat bots gewoon door. Vervang <code>turnstileSiteKey</code> door de
          site key van je eigen widget voordat je de giveaway deelt.
        </p>
      )}

      {/*
        De smalle kolom houdt nu alleen nog de prijs en de einddatum vast; de
        deelnamevoorwaarden zelf staan op Instagram. Vandaar dat het formulier
        de ruimere helft krijgt, en `lg:items-start` zodat het kaartje kort
        blijft in plaats van mee te rekken met het formulier ernaast.
      */}
      <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[0.65fr_1.35fr] lg:items-start lg:gap-14">
        <aside className="flex flex-col gap-6 rounded-4xl border border-line bg-surface px-6 py-8 shadow-card sm:px-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-[0.24em] text-accent uppercase">
              Te winnen
            </h2>
            <p className="text-base leading-relaxed text-heading">
              {GIVEAWAY.prijs}
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-6">
            <h2 className="text-xs font-semibold tracking-[0.24em] text-accent uppercase">
              Deelnemen kan tot
            </h2>
            <p className="text-base font-semibold text-heading">
              {formatDateLong(GIVEAWAY.einddatum)}
            </p>
          </div>
        </aside>

        <div className="flex flex-col gap-6">
          <h2 className="display-title text-2xl text-heading sm:text-3xl">
            Vul je gegevens in
          </h2>

          <GiveawayForm
            sitekey={GIVEAWAY.turnstileSiteKey}
            labels={GIVEAWAY.vinkjes}
            bevestiging={GIVEAWAY.bevestiging}
          />
        </div>
      </div>
    </Section>
  );
}
