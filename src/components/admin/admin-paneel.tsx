"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  API,
  deelnemerPad,
  type Deelnemer,
  type DeelnemersAntwoord,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { DeelnemersTabel } from "./deelnemers-tabel";
import { FotosBeheer } from "./fotos-beheer";
import { GalerijBeheer } from "./galerij-beheer";
import { LoginForm } from "./login-form";
import { ReizenBeheer } from "./reizen-beheer";

/**
 * Het admin-overzicht.
 *
 * De pagina zelf is HTML zonder data erin — alles komt via de
 * geauthenticeerde API binnen. Wie de pagina opvraagt zonder cookie ziet
 * dus enkel een leeg omhulsel, en dat is precies de bedoeling.
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
        melding:
          data.melding ?? "De inschrijvingen konden niet geladen worden.",
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
  { id: "fotos", label: "Foto's" },
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
  /**
   * Een 401 terwijl de panelen al open staan. Die blijven dan gemonteerd onder
   * een inlogvenster, zodat een half ingevuld formulier het verlopen van de
   * sessie overleeft. Alleen de allereerste lading valt terug op het kale
   * inlogscherm: dan staat er nog niets om te bewaren.
   */
  const [sessieVerlopen, setSessieVerlopen] = useState(false);
  /** Gemeld door het reisformulier en de galerijkeuze; uitloggen gooit die wijzigingen weg. */
  const [formulierGewijzigd, setFormulierGewijzigd] = useState(false);
  const [galerijGewijzigd, setGalerijGewijzigd] = useState(false);
  /**
   * Ophogen bij een upload of verwijdering, en na het opslaan van een reis of de
   * homepagegalerij: de keuzelijsten halen de bibliotheek dan opnieuw op en de
   * fotokaarten tonen weer waar een foto staat.
   */
  const [bibliotheekVersie, setBibliotheekVersie] = useState(0);
  const verversBibliotheek = () => setBibliotheekVersie((vorige) => vorige + 1);

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
        setSessieVerlopen(true);
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

  /**
   * Na het opnieuw inloggen via het venster: de deelnemers stil verversen, in
   * plaats van via `herlaad` — die zet de status op "laden" en zou daarmee de
   * panelen, en dus het formulier, alsnog weggooien. Een opslaan dat op de 401
   * stuitte, wordt niet automatisch herhaald: de beheerder klikt zelf opnieuw.
   */
  async function naHerlogin() {
    setSessieVerlopen(false);
    const uitkomst = await haalDeelnemers();
    if (uitkomst.soort === "klaar") {
      setDeelnemers(uitkomst.deelnemers);
      setTotaal(uitkomst.totaal);
      setMelding(null);
    } else if (uitkomst.soort === "fout") {
      setMelding(uitkomst.melding);
    } else {
      setSessieVerlopen(true);
    }
  }

  async function uitloggen() {
    if (
      (formulierGewijzigd || galerijGewijzigd) &&
      !window.confirm(
        "Er zijn niet-opgeslagen wijzigingen (reisformulier of homepagegalerij). Toch uitloggen?",
      )
    ) {
      return;
    }

    try {
      await fetch(API.logout, { method: "POST" });
    } catch {
      // Lukt het uitloggen niet, dan wissen we hier hoe dan ook alles uit beeld.
    }

    setDeelnemers([]);
    setTotaal(0);
    setMelding(null);
    setSessieVerlopen(false);
    setFormulierGewijzigd(false);
    setGalerijGewijzigd(false);
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
            onUitgelogd={() => setSessieVerlopen(true)}
            onUitloggen={() => void uitloggen()}
            onFormulierGewijzigd={setFormulierGewijzigd}
            onReizenGewijzigd={verversBibliotheek}
          />
        );
      case "fotos":
        return (
          <div className="flex flex-col gap-12">
            <FotosBeheer
              onUitgelogd={() => setSessieVerlopen(true)}
              onBibliotheekGewijzigd={verversBibliotheek}
              versie={bibliotheekVersie}
            />
            <GalerijBeheer
              bibliotheekVersie={bibliotheekVersie}
              onUitgelogd={() => setSessieVerlopen(true)}
              onGewijzigd={setGalerijGewijzigd}
              onOpgeslagen={verversBibliotheek}
            />
          </div>
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
      {/* `inert` houdt focus en klikken uit de panelen zolang het inlogvenster
          openstaat, zonder ze uit de DOM te halen. */}
      <div inert={sessieVerlopen}>
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
      </div>

      {sessieVerlopen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-page/85 px-4 py-16 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="herlogin-uitleg"
            className="flex w-full max-w-sm flex-col gap-4"
          >
            <p
              id="herlogin-uitleg"
              className="rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-heading"
            >
              Je sessie is verlopen. Log opnieuw in; wat je hebt ingevuld,
              blijft staan.
            </p>
            <LoginForm onIngelogd={() => void naHerlogin()} />
          </div>
        </div>
      )}
    </>
  );
}
