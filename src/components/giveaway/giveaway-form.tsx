"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field } from "@/components/ui/field";
import { CheckIcon } from "@/components/ui/icons";
import { API, type InschrijfAntwoord } from "@/lib/api";
import {
  LEEG_FORMULIER,
  controleerVeld,
  valideerLead,
  type LeadFouten,
  type LeadInvoer,
  type LeadVeld,
} from "@/lib/leads";

import { useTurnstile } from "./use-turnstile";

/*
 * Eén van de weinige client components van de site, en bewust een blad: alleen
 * dit formulier is interactief, de pagina eromheen blijft een server component.
 *
 * De validatieregels komen uit `lib/leads.ts` en worden gedeeld met de Worker.
 * Wat hier gebeurt is er voor het gemak — direct kunnen zeggen wat er mis is —
 * en niet voor de veiligheid: de Worker keurt elke inzending zelf opnieuw.
 */

type Status = "invoeren" | "versturen" | "gelukt";

type TekstVeld = "voornaam" | "achternaam" | "email" | "telefoon";
type VinkVeld = "voorwaarden" | "consent";

export function GiveawayForm({
  sitekey,
  labels,
  bevestiging,
}: {
  sitekey: string;
  labels: { voorwaarden: string; consent: string };
  bevestiging: { title: string; tekst: string };
}) {
  const [invoer, setInvoer] = useState<LeadInvoer>(LEEG_FORMULIER);
  const [fouten, setFouten] = useState<LeadFouten>({});
  const [status, setStatus] = useState<Status>("invoeren");
  const [melding, setMelding] = useState<string | null>(null);
  /** Het honeypot-veld; hoort altijd leeg te blijven. */
  const [website, setWebsite] = useState("");

  // Uitgepakt en niet als object bewaard: `ref={turnstile.houderRef}` leest voor
  // de react-hooks-regel als het aanspreken van een ref tijdens het renderen.
  const {
    houderRef,
    token,
    mislukt: turnstileMislukt,
    herstel: herstelTurnstile,
  } = useTurnstile(sitekey);

  function wisFout(veld: LeadVeld) {
    setMelding(null);
    setFouten((vorige) => {
      if (!vorige[veld]) return vorige;
      const volgende = { ...vorige };
      delete volgende[veld];
      return volgende;
    });
  }

  function wijzigTekst(veld: TekstVeld, waarde: string) {
    setInvoer((vorige) => ({ ...vorige, [veld]: waarde }));
    wisFout(veld);
  }

  function wijzigVink(veld: VinkVeld, aangevinkt: boolean) {
    setInvoer((vorige) => ({ ...vorige, [veld]: aangevinkt }));
    wisFout(veld);
  }

  /** Bij `blur`, zodat je niet pas bij het versturen hoort dat er iets mis is. */
  function controleerNu(veld: LeadVeld) {
    const fout = controleerVeld(veld, invoer);
    setFouten((vorige) => ({ ...vorige, [veld]: fout ?? undefined }));
  }

  async function verstuur(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "versturen") return;

    const resultaat = valideerLead(invoer);
    if (!resultaat.ok) {
      setFouten(resultaat.fouten);
      setMelding(null);
      return;
    }

    if (token.length === 0) {
      setMelding(
        turnstileMislukt
          ? "De beveiligingscontrole kon niet laden. Zet een adblocker uit of stuur ons een bericht via WhatsApp."
          : "De beveiligingscontrole loopt nog. Probeer het over een paar tellen opnieuw.",
      );
      return;
    }

    setStatus("versturen");
    setMelding(null);

    try {
      const antwoord = await fetch(API.inschrijven, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // De ruwe invoer, niet de opgeschoonde versie: de Worker hoort te
        // oordelen over wat de bezoeker echt heeft ingetypt.
        body: JSON.stringify({ ...invoer, website, turnstile: token }),
      });

      const data = (await antwoord.json()) as InschrijfAntwoord;

      if (data.ok) {
        setStatus("gelukt");
        return;
      }

      setFouten(data.fouten ?? {});
      setMelding(data.melding);
      setStatus("invoeren");
      // Een Turnstile-token is eenmalig; zonder deze reset wordt elke volgende
      // poging geweigerd, ook als de bezoeker zijn fout heeft verbeterd.
      herstelTurnstile();
    } catch {
      setMelding(
        "We konden je inschrijving niet versturen. Controleer je verbinding en probeer het opnieuw.",
      );
      setStatus("invoeren");
      herstelTurnstile();
    }
  }

  if (status === "gelukt") {
    return (
      <div className="flex flex-col items-center gap-5 rounded-4xl border border-accent/30 bg-accent-soft px-6 py-14 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface text-accent">
          <CheckIcon className="size-7" />
        </span>

        <h2 className="display-title text-3xl text-heading sm:text-4xl">
          {bevestiging.title}
        </h2>

        <p className="max-w-md text-sm leading-relaxed text-body">
          {bevestiging.tekst}
        </p>

        <Button href="/reizen" size="lg" className="mt-2">
          Bekijk de reizen
        </Button>
      </div>
    );
  }

  const bezig = status === "versturen";

  return (
    <form
      onSubmit={verstuur}
      // `noValidate`: de meldingen van de browser staan in de taal van het
      // besturingssysteem en negeren onze opmaak. We doen het zelf.
      noValidate
      className="relative flex flex-col gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          naam="voornaam"
          label="Voornaam"
          autoComplete="given-name"
          value={invoer.voornaam}
          onChange={(event) => wijzigTekst("voornaam", event.target.value)}
          onBlur={() => controleerNu("voornaam")}
          fout={fouten.voornaam}
          disabled={bezig}
        />

        <Field
          naam="achternaam"
          label="Achternaam"
          autoComplete="family-name"
          value={invoer.achternaam}
          onChange={(event) => wijzigTekst("achternaam", event.target.value)}
          onBlur={() => controleerNu("achternaam")}
          fout={fouten.achternaam}
          disabled={bezig}
        />
      </div>

      <Field
        naam="email"
        label="E-mailadres"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="naam@voorbeeld.be"
        value={invoer.email}
        onChange={(event) => wijzigTekst("email", event.target.value)}
        onBlur={() => controleerNu("email")}
        fout={fouten.email}
        disabled={bezig}
      />

      <Field
        naam="telefoon"
        label="Telefoon"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        optioneel
        placeholder="0489 28 94 90"
        value={invoer.telefoon}
        onChange={(event) => wijzigTekst("telefoon", event.target.value)}
        onBlur={() => controleerNu("telefoon")}
        fout={fouten.telefoon}
        disabled={bezig}
      />

      {/*
        Honeypot. Staat buiten beeld in plaats van op `display: none`, want een
        eenvoudige bot slaat verborgen velden soms over maar vult wat hij in de
        HTML vindt. Blijft dit leeg, dan is het waarschijnlijk een mens.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] size-px overflow-hidden opacity-0"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface px-5 py-5">
        <Checkbox
          naam="voorwaarden"
          label={labels.voorwaarden}
          checked={invoer.voorwaarden}
          onChange={(event) => wijzigVink("voorwaarden", event.target.checked)}
          fout={fouten.voorwaarden}
          disabled={bezig}
        />

        <Checkbox
          naam="consent"
          label={
            <>
              {labels.consent}. Lees in de{" "}
              <Link
                href="/privacy"
                className="font-medium text-accent underline underline-offset-4"
              >
                privacyverklaring
              </Link>{" "}
              wat we bewaren; uitschrijven kan altijd.
            </>
          }
          checked={invoer.consent}
          onChange={(event) => wijzigVink("consent", event.target.checked)}
          fout={fouten.consent}
          disabled={bezig}
        />
      </div>

      {/* Vaste hoogte, zodat de knop niet verspringt zodra de widget inlaadt. */}
      <div ref={houderRef} className="min-h-[70px]" />

      {melding && <Waarschuwing>{melding}</Waarschuwing>}

      <Button
        type="submit"
        size="lg"
        disabled={bezig}
        className="w-full sm:w-auto sm:self-start"
      >
        {bezig ? "Bezig met versturen…" : "Doe mee"}
      </Button>
    </form>
  );
}

function Waarschuwing({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger"
    >
      {children}
    </p>
  );
}
