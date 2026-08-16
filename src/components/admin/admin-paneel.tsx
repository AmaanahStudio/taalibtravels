"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  API,
  deelnemerPad,
  type Deelnemer,
  type DeelnemersAntwoord,
} from "@/lib/api";

import { DeelnemersTabel } from "./deelnemers-tabel";
import { LoginForm } from "./login-form";

/**
 * Het admin-overzicht.
 *
 * De pagina zelf is statische HTML zonder data erin — alles komt via de
 * geauthenticeerde API binnen. Wie het HTML-bestand opvraagt zonder cookie ziet
 * dus enkel een leeg omhulsel, en dat is precies de bedoeling: bij een statische
 * export staat elk gegenereerd bestand publiek op het netwerk.
 *
 * Of je ingelogd bent, wordt niet apart bijgehouden: de sessiecookie is
 * `HttpOnly` en dus onzichtbaar voor JavaScript. Een 401 op het ophalen ís het
 * antwoord op die vraag.
 */

/** Wat het ophalen opleverde. Losgekoppeld van React, zodat het te lezen blijft. */
type Uitkomst =
  | { soort: "klaar"; deelnemers: Deelnemer[]; totaal: number }
  | { soort: "uitgelogd" }
  | { soort: "fout"; melding: string };

/**
 * Staat buiten het component en raakt bewust geen state aan: het effect
 * hieronder mag niets synchroon zetten, anders volgt er een extra renderronde
 * bij elke keer laden. De uitkomst wordt in de `then`-callback verwerkt.
 */
async function haalDeelnemers(): Promise<Uitkomst> {
  try {
    const antwoord = await fetch(API.deelnemers, {
      headers: { Accept: "application/json" },
    });

    if (antwoord.status === 401) return { soort: "uitgelogd" };

    if (!antwoord.ok) {
      const data = (await antwoord.json().catch(() => ({}))) as {
        melding?: string;
      };
      return {
        soort: "fout",
        melding: data.melding ?? "De inschrijvingen konden niet geladen worden.",
      };
    }

    const data = (await antwoord.json()) as DeelnemersAntwoord;
    return { soort: "klaar", deelnemers: data.deelnemers, totaal: data.totaal };
  } catch {
    return { soort: "fout", melding: "Geen verbinding met de server." };
  }
}

type Status = "laden" | "uitgelogd" | "klaar" | "fout";

export function AdminPaneel() {
  const [status, setStatus] = useState<Status>("laden");
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [totaal, setTotaal] = useState(0);
  const [melding, setMelding] = useState<string | null>(null);
  /** Ophogen vraagt een nieuwe ronde aan: na inloggen en bij "opnieuw proberen". */
  const [ronde, setRonde] = useState(0);

  useEffect(() => {
    let afgebroken = false;

    void haalDeelnemers().then((uitkomst) => {
      if (afgebroken) return;

      if (uitkomst.soort === "klaar") {
        setDeelnemers(uitkomst.deelnemers);
        setTotaal(uitkomst.totaal);
        setMelding(null);
      } else if (uitkomst.soort === "fout") {
        setMelding(uitkomst.melding);
      }

      setStatus(uitkomst.soort);
    });

    return () => {
      afgebroken = true;
    };
  }, [ronde]);

  function herlaad() {
    setStatus("laden");
    setMelding(null);
    setRonde((vorige) => vorige + 1);
  }

  async function verwijder(id: number) {
    setMelding(null);

    try {
      const antwoord = await fetch(deelnemerPad(id), { method: "DELETE" });

      if (antwoord.status === 401) {
        setStatus("uitgelogd");
        return;
      }

      if (!antwoord.ok) {
        setMelding("Verwijderen is niet gelukt.");
        return;
      }

      // Lokaal bijwerken in plaats van de hele lijst opnieuw ophalen: het
      // resultaat is hetzelfde en de tabel knippert niet.
      setDeelnemers((vorige) =>
        vorige.filter((deelnemer) => deelnemer.id !== id),
      );
      setTotaal((vorige) => Math.max(0, vorige - 1));
    } catch {
      setMelding("Geen verbinding met de server.");
    }
  }

  async function uitloggen() {
    try {
      await fetch(API.logout, { method: "POST" });
    } catch {
      // Lukt het uitloggen niet, dan wissen we hier hoe dan ook alles uit beeld.
    }

    setDeelnemers([]);
    setTotaal(0);
    setMelding(null);
    setStatus("uitgelogd");
  }

  if (status === "laden") {
    return (
      <p className="py-20 text-center text-sm text-muted">Bezig met laden…</p>
    );
  }

  if (status === "uitgelogd") {
    return <LoginForm onIngelogd={herlaad} />;
  }

  if (status === "fout") {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-danger">{melding}</p>
        <Button variant="outline" size="sm" onClick={herlaad}>
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  return (
    <>
      {melding && (
        <p
          role="alert"
          className="mb-6 rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {melding}
        </p>
      )}

      <DeelnemersTabel
        deelnemers={deelnemers}
        totaal={totaal}
        onVerwijder={verwijder}
        onUitloggen={() => void uitloggen()}
      />
    </>
  );
}
