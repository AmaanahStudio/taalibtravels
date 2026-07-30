import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Section } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Pagina niet gevonden",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Section spacing="none" className="pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="display-title text-7xl text-accent sm:text-8xl">
          404
        </span>

        <h1 className="display-title text-4xl text-heading sm:text-5xl">
          Deze pagina bestaat niet
        </h1>

        <p className="max-w-md text-base leading-relaxed text-body">
          Mogelijk is de reis intussen vertrokken of volzet. Bekijk het huidige
          aanbod, of stuur ons een bericht.
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button href="/reizen" size="lg">
            Bekijk alle reizen
            <ArrowRightIcon className="size-4" />
          </Button>
          <WhatsAppButton
            label="Stel je vraag"
            variant="outline"
            message={`Assalaamu alaykum, ik heb een vraag over de reizen van ${SITE.name}.`}
          />
        </div>
      </div>
    </Section>
  );
}
