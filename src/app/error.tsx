"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { SITE } from "@/lib/content";

/**
 * Foutpagina voor als een pagina niet kan renderen — in de praktijk: D1 is
 * even onbereikbaar. De bezoeker moet dan nog altijd bij ons terechtkunnen,
 * vandaar de WhatsApp-knop naast "Probeer opnieuw".
 *
 * Bewust geen logging hier: de fout staat al in de Worker-logs, en in de
 * browser hoort geen interne foutmelding of digest te belanden.
 *
 * `reset` alleen rendert de client opnieuw met dezelfde (mislukte) serverdata;
 * `router.refresh()` haalt de pagina echt opnieuw op bij de server.
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <Section spacing="none" className="pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="display-title text-4xl text-heading sm:text-5xl">
          Er ging iets mis
        </h1>

        <p className="max-w-md text-base leading-relaxed text-body">
          Deze pagina kon even niet geladen worden. Probeer het zo opnieuw, of
          stuur ons meteen een bericht, we helpen je graag verder.
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={retry} disabled={isPending}>
            {isPending ? "Bezig…" : "Probeer opnieuw"}
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
