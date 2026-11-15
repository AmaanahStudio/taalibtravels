"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API, reisPad, type ReisAntwoord, type ReisRecord, type ReizenAntwoord } from "@/lib/api";
import { GALERIJ_AANTAL } from "@/lib/reizen";
import type { TripStatus } from "@/lib/types";
import { formatDateNumeric, formatPrice } from "@/lib/utils";

import { DOELGROEPEN, ReisFormulier, STATUSSEN } from "./reis-formulier";

/**
 * Het tabblad Reizen: de lijst, en het formulier zodra er een reis open staat.
 *
 * Na opslaan, verbergen of verwijderen wordt de lijst lokaal bijgewerkt met wat
 * de Worker terugstuurde, in plaats van alles opnieuw op te halen: hetzelfde
 * resultaat, zonder dat de lijst knippert.
 */

type Uitkomst =
  | { soort: "klaar"; reizen: ReisRecord[] }
  | { soort: "uitgelogd" }
  | { soort: "fout"; melding: string };

async function haalReizen(): Promise<Uitkomst> {
  try {
    const antwoord = await fetch(API.reizen, { headers: { Accept: "application/json" } });
    if (antwoord.status === 401) return { soort: "uitgelogd" };
    if (!antwoord.ok) return { soort: "fout", melding: "De reizen konden niet geladen worden." };
    const data = (await antwoord.json()) as ReizenAntwoord;
    return { soort: "klaar", reizen: data.reizen };
  } catch {
    return { soort: "fout", melding: "Geen verbinding met de server." };
  }
}

/** Dezelfde volgorde als de Worker: op vertrekdatum, dan slug. */
function sorteer(reizen: ReisRecord[]): ReisRecord[] {
  return [...reizen].sort(
    (a, b) =>
      a.departureDate.localeCompare(b.departureDate) || a.slug.localeCompare(b.slug),
  );
}

/**
 * Wat er aan een reis ontbreekt om getoond te kunnen worden. Zo'n rij kan uit
 * de import of een verwijderde foto komen; de publieke pagina slaat hem over,
 * dus hier moet het zichtbaar zijn.
 */
function gebreken(reis: ReisRecord): string[] {
  const lijst: string[] = [];
  if (!reis.coverImage) lijst.push("geen omslagfoto");
  if (reis.gallery !== null && reis.gallery.length !== GALERIJ_AANTAL) {
    lijst.push(`galerij heeft ${reis.gallery.length} van ${GALERIJ_AANTAL} foto's`);
  }
  return lijst;
}

const STATUS_TOON: Record<TripStatus, "accent" | "muted" | "neutral"> = {
  published: "accent",
  draft: "muted",
  "sold-out": "neutral",
};

type Open = { soort: "lijst" } | { soort: "nieuw" } | { soort: "bewerk"; reis: ReisRecord };

export function ReizenBeheer({
  onUitgelogd,
  onUitloggen,
  onFormulierGewijzigd,
}: {
  onUitgelogd: () => void;
  onUitloggen: () => void;
  /** Doorgegeven aan het formulier, zodat het paneel weet of uitloggen iets weggooit. */
  onFormulierGewijzigd?: (gewijzigd: boolean) => void;
}) {
  const [status, setStatus] = useState<"laden" | "klaar" | "fout">("laden");
  const [reizen, setReizen] = useState<ReisRecord[]>([]);
  const [open, setOpen] = useState<Open>({ soort: "lijst" });
  const [melding, setMelding] = useState<string | null>(null);
  const [succes, setSucces] = useState<{ tekst: string; slug?: string } | null>(null);
  const [bezigMet, setBezigMet] = useState<string | null>(null);
  const [ronde, setRonde] = useState(0);
  const lijstKop = useRef<HTMLHeadingElement>(null);
  /** Na terugkeer uit het formulier de focus op de lijst zetten, niet bovenaan de pagina laten vallen. */
  const focusOpLijst = useRef(false);

  const uitgelogdRef = useRef(onUitgelogd);
  useEffect(() => {
    uitgelogdRef.current = onUitgelogd;
  });

  useEffect(() => {
    let afgebroken = false;
    void haalReizen().then((uitkomst) => {
      if (afgebroken) return;
      if (uitkomst.soort === "uitgelogd") {
        uitgelogdRef.current();
        // Na het opnieuw inloggen staat hier een knop om de lijst alsnog te laden.
        setMelding("Je bent uitgelogd.");
        setStatus("fout");
        return;
      }
      if (uitkomst.soort === "klaar") setReizen(uitkomst.reizen);
      else setMelding(uitkomst.melding);
      setStatus(uitkomst.soort);
    });
    return () => {
      afgebroken = true;
    };
  }, [ronde]);

  useEffect(() => {
    if (open.soort === "lijst" && focusOpLijst.current) {
      lijstKop.current?.focus();
      focusOpLijst.current = false;
    }
  });

  function herlaad() {
    setStatus("laden");
    setMelding(null);
    setRonde((vorige) => vorige + 1);
  }

  function openFormulier(nieuw: Open) {
    setMelding(null);
    setSucces(null);
    setOpen(nieuw);
    window.scrollTo({ top: 0 });
  }

  function formulierKlaar(opgeslagen?: ReisRecord) {
    if (opgeslagen) {
      setReizen((vorige) =>
        sorteer([...vorige.filter((r) => r.slug !== opgeslagen.slug), opgeslagen]),
      );
      setSucces({
        tekst: `"${opgeslagen.title} — ${opgeslagen.subtitle}" is opgeslagen.`,
        slug: opgeslagen.status === "draft" ? undefined : opgeslagen.slug,
      });
    }
    focusOpLijst.current = true;
    onFormulierGewijzigd?.(false);
    setOpen({ soort: "lijst" });
  }

  async function wisselZichtbaarheid(reis: ReisRecord) {
    const nieuweStatus: TripStatus = reis.status === "draft" ? "published" : "draft";
    setMelding(null);
    setSucces(null);
    setBezigMet(reis.slug);

    try {
      // De hele reis gaat mee: PUT vervangt, en de Worker valideert alles opnieuw.
      const antwoord = await fetch(reisPad(reis.slug), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...reis, status: nieuweStatus }),
      });
      if (antwoord.status === 401) {
        onUitgelogd();
        return;
      }
      const data = (await antwoord.json().catch(() => null)) as ReisAntwoord | null;
      if (antwoord.ok && data?.ok) {
        setReizen((vorige) => vorige.map((r) => (r.slug === reis.slug ? data.reis : r)));
        setSucces({
          tekst: `"${reis.title} — ${reis.subtitle}" is ${nieuweStatus === "draft" ? "verborgen" : "zichtbaar"}.`,
          slug: nieuweStatus === "draft" ? undefined : reis.slug,
        });
        return;
      }
      // Bv. een kapotte rij: de Worker weigert hem tot de foto's in orde zijn.
      const velden = data && !data.ok && data.fouten ? Object.values(data.fouten).join(" ") : "";
      setMelding(
        `${data && !data.ok ? data.melding : "Wijzigen is niet gelukt."}${velden ? ` ${velden}` : ""} Open de reis via Bewerken om het te herstellen.`,
      );
    } catch {
      setMelding("Geen verbinding met de server.");
    } finally {
      setBezigMet(null);
    }
  }

  async function verwijder(reis: ReisRecord) {
    const bevestigd = window.confirm(
      `De reis "${reis.title} — ${reis.subtitle}" (/reizen/${reis.slug}) definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    );
    if (!bevestigd) return;

    setMelding(null);
    setSucces(null);
    setBezigMet(reis.slug);
    try {
      const antwoord = await fetch(reisPad(reis.slug), {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (antwoord.status === 401) {
        onUitgelogd();
        return;
      }
      if (antwoord.ok || antwoord.status === 404) {
        // 404: al weg (bv. in een ander tabblad). Het resultaat is hetzelfde.
        setReizen((vorige) => vorige.filter((r) => r.slug !== reis.slug));
        setSucces({ tekst: `"${reis.title} — ${reis.subtitle}" is verwijderd.` });
        // De knop waar de focus op stond, is met de rij verdwenen.
        lijstKop.current?.focus();
        return;
      }
      const data = (await antwoord.json().catch(() => null)) as { melding?: string } | null;
      setMelding(data?.melding ?? "Verwijderen is niet gelukt.");
    } catch {
      setMelding("Geen verbinding met de server.");
    } finally {
      setBezigMet(null);
    }
  }

  if (open.soort !== "lijst") {
    return (
      <ReisFormulier
        // Een andere reis openen is een nieuw formulier, niet het oude met andere props.
        key={open.soort === "bewerk" ? open.reis.slug : "nieuw"}
        reis={open.soort === "bewerk" ? open.reis : undefined}
        onKlaar={formulierKlaar}
        onUitgelogd={onUitgelogd}
        onGewijzigd={onFormulierGewijzigd}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            ref={lijstKop}
            tabIndex={-1}
            className="display-title text-3xl text-heading sm:text-4xl"
          >
            Reizen
          </h1>
          {status === "klaar" && (
            <p className="text-sm text-muted">
              {reizen.length} {reizen.length === 1 ? "reis" : "reizen"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" onClick={() => openFormulier({ soort: "nieuw" })}>
            Nieuwe reis
          </Button>
          <Button variant="ghost" size="sm" onClick={onUitloggen}>
            Uitloggen
          </Button>
        </div>
      </div>

      {succes && (
        <p
          role="status"
          className="rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-heading"
        >
          {succes.tekst}{" "}
          {succes.slug && (
            <a
              href={`/reizen/${succes.slug}`}
              target="_blank"
              rel="noopener"
              className="font-semibold text-accent underline underline-offset-4"
            >
              Bekijk op de site
            </a>
          )}
        </p>
      )}

      {melding && status !== "fout" && (
        <p
          role="alert"
          className="rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {melding}
        </p>
      )}

      {status === "laden" && (
        <p className="py-12 text-center text-sm text-muted">Reizen laden…</p>
      )}

      {status === "fout" && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-danger">{melding}</p>
          <Button variant="outline" size="sm" onClick={herlaad}>
            Opnieuw proberen
          </Button>
        </div>
      )}

      {status === "klaar" && reizen.length === 0 && (
        <p className="rounded-3xl border border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Er zijn nog geen reizen. Maak er een aan met &quot;Nieuwe reis&quot;.
        </p>
      )}

      {status === "klaar" && reizen.length > 0 && (
        <ul className="flex flex-col gap-3">
          {reizen.map((reis) => {
            const mist = gebreken(reis);
            const bezig = bezigMet === reis.slug;
            const naam = `${reis.title} — ${reis.subtitle}`;
            return (
              <li
                key={reis.slug}
                className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-heading">{naam}</h2>
                    <Badge tone={STATUS_TOON[reis.status]}>{STATUSSEN[reis.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {formatDateNumeric(reis.departureDate)} – {formatDateNumeric(reis.returnDate)}
                    {" · "}
                    {formatPrice(reis.price.amount)}
                    {" · "}
                    {DOELGROEPEN[reis.audience]}
                    {reis.spotsLeft !== undefined && ` · ${reis.spotsLeft} plekken vrij`}
                  </p>
                  <p className="truncate text-xs text-muted">/reizen/{reis.slug}</p>
                  {mist.length > 0 && (
                    <p className="text-sm text-danger">
                      Onvolledig: {mist.join(", ")}. Kies via Bewerken nieuwe foto&apos;s; tot dan
                      staat deze reis niet goed op de site.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFormulier({ soort: "bewerk", reis })}
                    disabled={bezig}
                    aria-label={`${naam} bewerken`}
                  >
                    Bewerken
                  </Button>
                  {/* Niet bij een uitverkochte reis: tonen zet terug op
                      "gepubliceerd", en dan was "uitverkocht" stil weg. Die
                      status wijzig je in het formulier. */}
                  {reis.status !== "sold-out" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void wisselZichtbaarheid(reis)}
                      disabled={bezig}
                      aria-label={`${naam} ${reis.status === "draft" ? "tonen" : "verbergen"}`}
                    >
                      {reis.status === "draft" ? "Tonen" : "Verbergen"}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => void verwijder(reis)}
                    disabled={bezig}
                    aria-label={`${naam} verwijderen`}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50 sm:text-sm"
                  >
                    {bezig ? "Bezig…" : "Verwijderen"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
