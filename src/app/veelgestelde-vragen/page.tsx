import type { Metadata } from "next";

import { FaqList } from "@/components/content/faq-list";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Section, SectionHeading } from "@/components/ui/section";
import { WhatsAppCta } from "@/components/ui/whatsapp-cta";
import { FAQ, SITE, getFaqByCategory } from "@/lib/content";
import { faqSchema, graph } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Veelgestelde vragen over Umrah";
const DESCRIPTION =
  "Antwoorden op de vragen die we het vaakst krijgen: wat een Umrah inhoudt, wat er in de prijs zit, betalen in termijnen, reizen zonder mahram, het visum en je paspoort.";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/veelgestelde-vragen",
});

export default function FaqPage() {
  const groups = getFaqByCategory();

  return (
    <>
      {/* Het FAQPage-schema staat alleen hier: het hoort op de pagina die de
          vragen volledig beantwoordt, niet op elk fragment elders op de site. */}
      <JsonLd data={graph(faqSchema(FAQ))} />

      <Section spacing="none" className="pt-24 pb-16 sm:pt-28 sm:pb-20">
        <Breadcrumbs
          trail={[
            { name: "Home", path: "/" },
            { name: "Veelgestelde vragen", path: "/veelgestelde-vragen" },
          ]}
          className="mb-8"
        />

        <SectionHeading
          as="h1"
          eyebrow="Vragen"
          title={TITLE}
          intro="Staat je vraag er niet bij? Stuur ons een bericht via WhatsApp — we antwoorden meestal binnen enkele uren."
        />

        <div className="mt-14 flex flex-col gap-14">
          {groups.map((group) => (
            <section key={group.category}>
              <h2 className="display-title text-2xl text-heading sm:text-3xl">
                {group.category}
              </h2>
              <FaqList items={group.items} className="mt-8" />
            </section>
          ))}
        </div>
      </Section>

      <Section spacing="none" className="pb-20 sm:pb-24">
        <WhatsAppCta
          eyebrow="Contact"
          title="Je vraag staat er niet bij"
          description="Geen probleem. App ons gerust — ook als je nog niets wil vastleggen."
          label="Stel je vraag via WhatsApp"
          message={`Assalaamu alaykum, ik heb een vraag over de Umrah-reizen van ${SITE.name}.`}
        />
      </Section>
    </>
  );
}
