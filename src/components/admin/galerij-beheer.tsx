"use client";

import { useEffect, useRef, useState } from "react";

import { GallerySection } from "@/components/trips/gallery-section";
import { Button } from "@/components/ui/button";
import {
  API,
  MEDIA_PAD,
  type AfbeeldingenAntwoord,
  type GalerijAntwoord,
} from "@/lib/api";
import { GALERIJ_AANTAL } from "@/lib/reizen";
import type { ImageAsset } from "@/lib/types";

import { FotoKiezer } from "./foto-kiezer";

/**
 * De zes foto's van de homepagegalerij. De server bepaalt of de keuze geldig
 * is (precies zes, uniek, bestaand); de knop hier voorkomt enkel een zinloze
 * poging. Een 401 gaat via `onUitgelogd` naar het inlogvenster van het paneel,
 * zodat de keuze blijft staan.
 */

type Laden =
  | { soort: "laden" }
  | { soort: "fout"; melding: string }
  | { soort: "klaar" };

type Uitkomst = { soort: "klaar"; ids: string[] } | { soort: "uitgelogd" } | { soort: "fout"; melding: string };

/** Buiten het component: het effect zet zo niets synchroon, alleen in de `then`. */
async function haalGalerij(): Promise<Uitkomst> {
  try {
    const antwoord = await fetch(API.galerij, { headers: { Accept: "application/json" } });
    if (antwoord.status === 401) return { soort: "uitgelogd" };
    if (!antwoord.ok) {
      return { soort: "fout", melding: "De homepagegalerij kon niet geladen worden." };
    }
    const data = (await antwoord.json()) as GalerijAntwoord;
    return { soort: "klaar", ids: data.galerij };
  } catch {
    return { soort: "fout", melding: "Geen verbinding met de server." };
  }
}

type Voorbeeld =
  | { soort: "dicht" }
  | { soort: "laden" }
  | { soort: "fout"; melding: string }
  | { soort: "klaar"; foto: Map<string, ImageAsset> };

/** Haalt de bibliotheek vers op: de keuze kan foto's bevatten die net geüpload zijn. */
async function haalVoorbeeldFotos(): Promise<Voorbeeld | "uitgelogd"> {
  try {
    const antwoord = await fetch(API.afbeeldingen, { headers: { Accept: "application/json" } });
    if (antwoord.status === 401) return "uitgelogd";
    if (!antwoord.ok) return { soort: "fout", melding: "De foto's konden niet geladen worden." };
    const data = (await antwoord.json()) as AfbeeldingenAntwoord;
    const foto = new Map(
      data.afbeeldingen.map((a): [string, ImageAsset] => [
        a.id,
        { src: MEDIA_PAD + a.sleutel, alt: a.alt, width: a.width, height: a.height },
      ]),
    );
    return { soort: "klaar", foto };
  } catch {
    return { soort: "fout", melding: "Geen verbinding met de server." };
  }
}

function gelijk(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function GalerijBeheer({
  onUitgelogd,
  onGewijzigd,
  onOpgeslagen,
  bibliotheekVersie = 0,
}: {
  /** Verandert na een upload of verwijdering; de keuzelijst haalt dan de bibliotheek opnieuw op. */
  bibliotheekVersie?: number;
  onUitgelogd?: () => void;
  /** Meldt of er niet-opgeslagen wijzigingen zijn; het paneel vraagt dan bevestiging bij uitloggen. */
  onGewijzigd?: (gewijzigd: boolean) => void;
  /** Na een geslaagd opslaan: de fotobibliotheek toont dan ander gebruik. */
  onOpgeslagen?: () => void;
}) {
  const [laden, setLaden] = useState<Laden>({ soort: "laden" });
  const [opgeslagen, setOpgeslagen] = useState<string[]>([]);
  const [keuze, setKeuze] = useState<string[]>([]);
  const [ronde, setRonde] = useState(0);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [bewaard, setBewaard] = useState(false);
  const [voorbeeld, setVoorbeeld] = useState<Voorbeeld>({ soort: "dicht" });

  // Via een ref, zodat een nieuwe callback van de ouder het laden niet opnieuw start.
  const uitgelogdRef = useRef(onUitgelogd);
  useEffect(() => {
    uitgelogdRef.current = onUitgelogd;
  });

  useEffect(() => {
    let afgebroken = false;
    void haalGalerij().then((uitkomst) => {
      if (afgebroken) return;
      if (uitkomst.soort === "uitgelogd") {
        uitgelogdRef.current?.();
        setLaden({ soort: "fout", melding: "Je bent uitgelogd." });
      } else if (uitkomst.soort === "fout") {
        setLaden(uitkomst);
      } else {
        setOpgeslagen(uitkomst.ids);
        setKeuze(uitkomst.ids);
        setLaden({ soort: "klaar" });
      }
    });
    return () => {
      afgebroken = true;
    };
  }, [ronde]);

  const gewijzigd = laden.soort === "klaar" && !gelijk(keuze, opgeslagen);
  const compleet = keuze.length === GALERIJ_AANTAL;

  useEffect(() => {
    onGewijzigd?.(gewijzigd);
  }, [gewijzigd, onGewijzigd]);

  // Niet waarschuwen tijdens het opslaan.
  const waarschuw = gewijzigd && !bezig;
  useEffect(() => {
    if (!waarschuw) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Oudere browsers tonen de vraag pas als `returnValue` gezet is.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [waarschuw]);

  function herlaad() {
    setLaden({ soort: "laden" });
    setRonde((vorige) => vorige + 1);
  }

  function wijzig(ids: string[]) {
    setKeuze(ids);
    setBewaard(false);
    setMelding(null);
  }

  async function toonVoorbeeld() {
    setVoorbeeld({ soort: "laden" });
    const uitkomst = await haalVoorbeeldFotos();
    if (uitkomst === "uitgelogd") {
      setVoorbeeld({ soort: "dicht" });
      uitgelogdRef.current?.();
    } else {
      setVoorbeeld(uitkomst);
    }
  }

  // Alleen bestaande foto's; een ontbrekende id staat al rood in de kiezer.
  const voorbeeldFotos =
    voorbeeld.soort === "klaar"
      ? keuze.flatMap((id) => voorbeeld.foto.get(id) ?? [])
      : [];

  async function bewaar() {
    setBezig(true);
    setMelding(null);
    setBewaard(false);
    try {
      const antwoord = await fetch(API.galerij, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids: keuze }),
      });
      if (antwoord.status === 401) {
        uitgelogdRef.current?.();
        return;
      }
      if (!antwoord.ok) {
        const data = (await antwoord.json().catch(() => ({}))) as { melding?: string };
        setMelding(data.melding ?? "Opslaan is niet gelukt.");
        return;
      }
      const data = (await antwoord.json()) as GalerijAntwoord;
      setOpgeslagen(data.galerij);
      setKeuze(data.galerij);
      setBewaard(true);
      onOpgeslagen?.();
    } catch {
      setMelding("Geen verbinding met de server.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <section aria-labelledby="galerij-titel" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="galerij-titel" className="text-lg font-semibold text-heading">
          Homepagegalerij
        </h3>
        <p className="text-sm text-muted">
          Kies precies {GALERIJ_AANTAL} foto&apos;s. De volgorde bepaalt de plek in het raster. Een
          reis zonder eigen galerij gebruikt deze foto&apos;s ook.
        </p>
      </div>

      {laden.soort === "laden" && (
        <p className="py-8 text-center text-sm text-muted">Bezig met laden…</p>
      )}

      {laden.soort === "fout" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p role="alert" className="text-sm text-danger">
            {laden.melding}
          </p>
          <Button variant="outline" size="sm" onClick={herlaad}>
            Opnieuw proberen
          </Button>
        </div>
      )}

      {laden.soort === "klaar" && (
        <>
          <FotoKiezer
            key={bibliotheekVersie}
            waarde={keuze}
            max={GALERIJ_AANTAL}
            onChange={wijzig}
            label="Homepagegalerij"
            onUitgelogd={onUitgelogd}
          />

          {melding && (
            <p
              role="alert"
              className="rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {melding}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void bewaar()} disabled={!compleet || !gewijzigd || bezig}>
              {bezig ? "Bezig met opslaan…" : "Galerij opslaan"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                voorbeeld.soort === "dicht" ? void toonVoorbeeld() : setVoorbeeld({ soort: "dicht" })
              }
              disabled={keuze.length === 0 || voorbeeld.soort === "laden"}
            >
              {voorbeeld.soort === "dicht" ? "Voorbeeld bekijken" : "Voorbeeld sluiten"}
            </Button>
            <p role="status" className="text-sm text-muted">
              {bewaard && !gewijzigd
                ? "Opgeslagen."
                : !compleet
                  ? `Kies er nog ${GALERIJ_AANTAL - keuze.length} om op te slaan.`
                  : ""}
            </p>
          </div>

          {voorbeeld.soort !== "dicht" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-page p-4 sm:p-6">
              <p className="text-sm text-muted">
                Zo ziet de galerij op de homepagina eruit
                {gewijzigd ? ", met je niet-opgeslagen wijzigingen" : ""}.
              </p>
              {voorbeeld.soort === "laden" && (
                <p className="py-6 text-center text-sm text-muted">Voorbeeld laden…</p>
              )}
              {voorbeeld.soort === "fout" && (
                <p role="alert" className="text-sm text-danger">
                  {voorbeeld.melding}
                </p>
              )}
              {voorbeeld.soort === "klaar" && (
                <GallerySection images={voorbeeldFotos} featureFirst />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
