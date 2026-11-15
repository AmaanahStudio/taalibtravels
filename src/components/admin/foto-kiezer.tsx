"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  API,
  MEDIA_PAD,
  type AfbeeldingenAntwoord,
  type AfbeeldingMetGebruik,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { verplaats, VolgordeKnoppen } from "./volgorde-knoppen";

/**
 * Kiest foto's uit de bibliotheek: één (`max = 1`, de omslagfoto) of precies
 * `max` (een galerij). Weet niets van reizen, zodat de homepagegalerij hem ook
 * kan gebruiken.
 *
 * Een id in `waarde` die niet (meer) in de bibliotheek staat — een rij die
 * kapot binnenkwam — blijft zichtbaar als "ontbrekende foto" met een knop om
 * hem weg te halen. Stilletjes laten vallen zou verbergen wat er mis is.
 */

type Bibliotheek =
  | { soort: "laden" }
  | { soort: "fout"; melding: string }
  | { soort: "klaar"; afbeeldingen: AfbeeldingMetGebruik[] };

/** Buiten het component: het effect zet zo niets synchroon, alleen in de `then`. */
async function haalBibliotheek(): Promise<Bibliotheek | "uitgelogd"> {
  try {
    const antwoord = await fetch(API.afbeeldingen, {
      headers: { Accept: "application/json" },
    });
    if (antwoord.status === 401) return "uitgelogd";
    if (!antwoord.ok) {
      return { soort: "fout", melding: "De fotobibliotheek kon niet geladen worden." };
    }
    const data = (await antwoord.json()) as AfbeeldingenAntwoord;
    return { soort: "klaar", afbeeldingen: data.afbeeldingen };
  } catch {
    return { soort: "fout", melding: "Geen verbinding met de server." };
  }
}

/** De kleinste variant uit de ladder volstaat voor een miniatuur. */
function miniatuur(afbeelding: AfbeeldingMetGebruik): string {
  return `${MEDIA_PAD}${afbeelding.sleutel}/256.webp`;
}

/**
 * `decoratief` in een knop die de alt-tekst al als tekst toont: anders leest
 * een schermlezer dezelfde beschrijving twee keer voor.
 */
function Miniatuur({
  afbeelding,
  decoratief = false,
}: {
  afbeelding: AfbeeldingMetGebruik;
  decoratief?: boolean;
}) {
  // De rij staat in D1, maar het bestand in R2 kan ontbreken (mislukte upload,
  // los verwijderd). Dan liever dezelfde waarschuwing dan een kapot icoontje.
  const [kapot, setKapot] = useState(false);
  if (kapot) return <OntbrekendeFoto id={afbeelding.id} />;

  return (
    // Gewone <img>: next/image voegt hier niets toe — de bron ís al de kleine
    // variant, en het beheer hoeft geen srcset.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={miniatuur(afbeelding)}
      alt={decoratief ? "" : afbeelding.alt}
      width={256}
      height={Math.round((256 * afbeelding.height) / afbeelding.width) || 171}
      loading="lazy"
      onError={() => setKapot(true)}
      className="aspect-[3/2] h-auto w-full rounded-xl bg-sunken object-cover"
    />
  );
}

function OntbrekendeFoto({ id }: { id: string }) {
  return (
    <div className="flex aspect-[3/2] items-center justify-center rounded-xl bg-danger-soft px-2 text-center text-xs text-danger">
      Ontbrekende foto ({id})
    </div>
  );
}

export function FotoKiezer({
  waarde,
  max,
  onChange,
  label,
  onUitgelogd,
}: {
  waarde: string[];
  max: number;
  onChange: (ids: string[]) => void;
  /** Toegankelijke naam van de keuzegroep, bv. "Omslagfoto". */
  label?: string;
  onUitgelogd?: () => void;
}) {
  const enkel = max === 1;
  const [bibliotheek, setBibliotheek] = useState<Bibliotheek>({ soort: "laden" });
  const [ronde, setRonde] = useState(0);
  // Open zolang de keuze nog niet compleet is; een volledige keuze eerst
  // dichtgeklapt, zodat het formulier niet vol miniaturen staat.
  const [open, setOpen] = useState(waarde.length !== max);
  const rasterId = useId();

  // In een ref, zodat een nieuwe callback van de ouder geen nieuwe fetch start.
  const uitgelogdRef = useRef(onUitgelogd);
  useEffect(() => {
    uitgelogdRef.current = onUitgelogd;
  });

  useEffect(() => {
    let afgebroken = false;
    void haalBibliotheek().then((uitkomst) => {
      if (afgebroken) return;
      if (uitkomst === "uitgelogd") {
        uitgelogdRef.current?.();
        setBibliotheek({ soort: "fout", melding: "Je bent uitgelogd." });
        return;
      }
      setBibliotheek(uitkomst);
    });
    return () => {
      afgebroken = true;
    };
  }, [ronde]);

  function herlaad() {
    setBibliotheek({ soort: "laden" });
    setRonde((vorige) => vorige + 1);
  }

  const perId = new Map(
    bibliotheek.soort === "klaar"
      ? bibliotheek.afbeeldingen.map((afbeelding) => [afbeelding.id, afbeelding])
      : [],
  );
  const vol = !enkel && waarde.length >= max;

  function kies(id: string) {
    if (enkel) {
      onChange([id]);
      setOpen(false);
    } else if (waarde.includes(id)) {
      onChange(waarde.filter((gekozen) => gekozen !== id));
    } else if (!vol) {
      onChange([...waarde, id]);
    }
  }

  return (
    <div className="flex flex-col gap-4" role="group" aria-label={label}>
      {/* De huidige keuze, in volgorde. */}
      {waarde.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          {enkel ? "Nog geen foto gekozen." : "Nog geen foto's gekozen."}
        </p>
      ) : (
        <ol className={cn("grid gap-3", enkel ? "max-w-56" : "grid-cols-2 sm:grid-cols-3")}>
          {waarde.map((id, index) => {
            const afbeelding = perId.get(id);
            const ontbreekt = bibliotheek.soort === "klaar" && !afbeelding;
            return (
              <li
                key={id}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-2",
                  ontbreekt ? "border-danger bg-danger-soft" : "border-line bg-surface",
                )}
              >
                {afbeelding ? (
                  <Miniatuur afbeelding={afbeelding} />
                ) : ontbreekt ? (
                  <OntbrekendeFoto id={id} />
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center rounded-xl bg-sunken px-2 text-center text-xs text-muted">
                    Laden…
                  </div>
                )}
                {/* `flex-wrap`: in een tegel van een halve telefoonbreedte past
                    "Weghalen" niet naast de pijlen. */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!enkel && (
                    <>
                      <span className="text-xs font-semibold text-muted">{index + 1}</span>
                      <VolgordeKnoppen
                        index={index}
                        aantal={waarde.length}
                        onderwerp="Foto"
                        horizontaal
                        onVerplaats={(naar) => onChange(verplaats(waarde, index, naar))}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(waarde.filter((gekozen) => gekozen !== id))}
                    aria-label={`${afbeelding?.alt || `Foto ${index + 1}`} weghalen`}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-soft"
                  >
                    Weghalen
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((vorige) => !vorige)}
          aria-expanded={open}
          aria-controls={rasterId}
        >
          {open ? "Bibliotheek sluiten" : enkel ? "Andere foto kiezen" : "Foto's kiezen"}
        </Button>
        {!enkel && (
          <p className="text-xs text-muted" aria-live="polite">
            {waarde.length} van {max} gekozen
          </p>
        )}
      </div>

      <div id={rasterId} hidden={!open}>
        {bibliotheek.soort === "laden" && (
          <p className="py-6 text-center text-sm text-muted">Bibliotheek laden…</p>
        )}

        {bibliotheek.soort === "fout" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-danger">{bibliotheek.melding}</p>
            <Button variant="outline" size="sm" onClick={herlaad}>
              Opnieuw proberen
            </Button>
          </div>
        )}

        {bibliotheek.soort === "klaar" && bibliotheek.afbeeldingen.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
            De fotobibliotheek is leeg. Upload eerst foto&apos;s.
          </p>
        )}

        {bibliotheek.soort === "klaar" && bibliotheek.afbeeldingen.length > 0 && (
          <>
            {vol && (
              <p className="mb-3 text-xs text-muted">
                Je hebt er {max}. Haal er eerst één weg om een andere te kiezen.
              </p>
            )}
            {/* Scrollt binnen zichzelf: een bibliotheek van honderd foto's zou
                anders het hele formulier onder zich begraven. */}
            <ul className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto rounded-2xl border border-line bg-sunken p-3 sm:grid-cols-3 lg:grid-cols-4">
              {bibliotheek.afbeeldingen.map((afbeelding) => {
                const gekozen = waarde.includes(afbeelding.id);
                return (
                  <li key={afbeelding.id}>
                    <button
                      type="button"
                      onClick={() => kies(afbeelding.id)}
                      aria-pressed={gekozen}
                      disabled={vol && !gekozen}
                      className={cn(
                        "flex w-full flex-col gap-1.5 rounded-2xl border-2 p-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        gekozen
                          ? "border-accent bg-accent-soft"
                          : "border-transparent bg-surface hover:border-line-strong",
                      )}
                    >
                      <Miniatuur afbeelding={afbeelding} decoratief />
                      <span className="line-clamp-2 px-1 text-xs text-body">
                        {gekozen && <span className="font-semibold text-accent">Gekozen · </span>}
                        {afbeelding.alt || afbeelding.id}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
