import type { Metadata } from "next";

import { Section, SectionHeading } from "@/components/ui/section";
import { PRIVACY, SITE } from "@/lib/content";
import { formatDateLong } from "@/lib/utils";

export const metadata: Metadata = {
  title: PRIVACY.title,
  description:
    "Welke gegevens TaalibTravels bijhoudt, waarom, hoe lang, en hoe je ze laat verwijderen.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Section spacing="none" className="pt-24 pb-20 sm:pt-28 sm:pb-24">
      <SectionHeading
        as="h1"
        eyebrow="Privacy"
        title={PRIVACY.title}
        intro={PRIVACY.intro}
      />

      <p className="mt-4 text-xs text-muted">
        Laatst bijgewerkt op {formatDateLong(PRIVACY.bijgewerkt)}.
      </p>

      <div className="mt-12 flex max-w-2xl flex-col gap-10">
        {PRIVACY.secties.map((sectie) => (
          <section key={sectie.kop} className="flex flex-col gap-3">
            <h2 className="font-display text-lg tracking-[0.06em] text-heading uppercase">
              {sectie.kop}
            </h2>

            {sectie.tekst.map((alinea) => (
              <p key={alinea} className="text-sm leading-relaxed text-body">
                {alinea}
              </p>
            ))}
          </section>
        ))}

        <section className="flex flex-col gap-3 border-t border-line pt-8">
          <h2 className="font-display text-lg tracking-[0.06em] text-heading uppercase">
            Contact
          </h2>
          <p className="text-sm leading-relaxed text-body">
            Vragen over je gegevens, of wil je ze laten verwijderen? Mail naar{" "}
            <a
              href={`mailto:${SITE.email}`}
              className="font-medium text-accent underline underline-offset-4"
            >
              {SITE.email}
            </a>{" "}
            of stuur ons een bericht op {SITE.whatsapp.display}.
          </p>
        </section>
      </div>
    </Section>
  );
}
