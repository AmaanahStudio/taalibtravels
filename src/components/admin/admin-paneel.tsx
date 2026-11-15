"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  API,
  deelnemerPad,
  type Deelnemer,
  type DeelnemersAntwoord,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { DeelnemersTabel } from "./deelnemers-tabel";
import { LoginForm } from "./login-form";
import { ReizenBeheer } from "./reizen-beheer";

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

/** Een tabblad erbij is één regel hier en één `case` in `paneelInhoud`. */
const TABBLADEN = [
  { id: "deelnemers", label: "Deelnemers" },
  { id: "reizen", label: "Reizen" },
] as const;

type TabId = (typeof TABBLADEN)[number]["id"];

export function AdminPaneel() {
  const [status, setStatus] = useState<Status>("laden");
  const [deelnemers, setDeelnemers] = useState<Deelnemer[]>([]);
  const [totaal, setTotaal] = useState(0);
  const [melding, setMelding] = useState<string | null>(null);
  /** Ophogen vraagt een nieuwe ronde aan: na inloggen en bij "opnieuw proberen". */
  const [ronde, setRonde] = useState(0);
  // Blijft staan over een herlogin heen: wie midden in Reizen uitgelogd raakt,
  // komt daar na het inloggen weer terug.
  const [actief, setActief] = useState<TabId>("deelnemers");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

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

  /**
   * Pijltjestoetsen, Home en End volgens het WAI-ARIA-patroon voor tabs: de
   * tabrij is één tabstop, met de pijlen kies je binnen de rij. Selecteren
   * gebeurt meteen bij het verplaatsen — er zijn er maar een paar.
   */
  function tabToets(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const laatste = TABBLADEN.length - 1;
    const naar =
      event.key === "ArrowRight"
        ? (index + 1) % TABBLADEN.length
        : event.key === "ArrowLeft"
          ? (index - 1 + TABBLADEN.length) % TABBLADEN.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? laatste
              : null;
    if (naar === null) return;

    event.preventDefault();
    const doel = TABBLADEN[naar].id;
    setActief(doel);
    tabRefs.current[doel]?.focus();
  }

  function paneelInhoud(id: TabId): ReactNode {
    switch (id) {
      case "deelnemers":
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
      case "reizen":
        return (
          <ReizenBeheer
            onUitgelogd={() => setStatus("uitgelogd")}
            onUitloggen={() => void uitloggen()}
          />
        );
    }
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
      <div
        role="tablist"
        aria-label="Beheer"
        className="mb-8 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABBLADEN.map((tab, index) => {
          const gekozen = tab.id === actief;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[tab.id] = element;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={gekozen}
              aria-controls={`paneel-${tab.id}`}
              tabIndex={gekozen ? 0 : -1}
              onClick={() => setActief(tab.id)}
              onKeyDown={(event) => tabToets(event, index)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors",
                gekozen
                  ? "border-accent text-heading"
                  : "border-transparent text-muted hover:text-heading",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Alle panelen blijven gemonteerd en worden alleen verborgen: wie even
          naar Deelnemers kijkt, verliest zo geen half ingevuld reisformulier. */}
      {TABBLADEN.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`paneel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== actief}
        >
          {paneelInhoud(tab.id)}
        </div>
      ))}
    </>
  );
}
