"use client";

import Image, { type ImageLoader } from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  API,
  MEDIA_PAD,
  UPLOAD,
  afbeeldingPad,
  type AfbeeldingAntwoord,
  type AfbeeldingMetGebruik,
  type AfbeeldingRecord,
  type AfbeeldingenAntwoord,
} from "@/lib/api";

import { canvasMaaktWebp, maakVarianten, uploadFoto, UploadFout } from "./upload-foto";

/**
 * De fotobibliotheek: uploaden (meerdere tegelijk), alt-tekst wijzigen en
 * verwijderen.
 *
 * Een 401 wordt niet hier afgehandeld maar doorgegeven via `onUitgelogd`: het
 * inlogscherm is van het paneel eromheen, niet van één tabblad.
 */
export function FotosBeheer({ onUitgelogd }: { onUitgelogd?: () => void }) {
  const [status, setStatus] = useState<"laden" | "klaar" | "fout">("laden");
  const [fotos, setFotos] = useState<AfbeeldingMetGebruik[]>([]);
  const [melding, setMelding] = useState<string | null>(null);
  const [ronde, setRonde] = useState(0);

  // Via een ref, zodat een nieuwe callback van de ouder het laden niet opnieuw start.
  const uitgelogdRef = useRef(onUitgelogd);
  useEffect(() => {
    uitgelogdRef.current = onUitgelogd;
  });
  const uitgelogd = () => uitgelogdRef.current?.();

  useEffect(() => {
    let afgebroken = false;

    void haalFotos().then((uitkomst) => {
      if (afgebroken) return;
      if (uitkomst.soort === "uitgelogd") {
        uitgelogdRef.current?.();
        return;
      }
      if (uitkomst.soort === "klaar") {
        setFotos(uitkomst.fotos);
        setStatus("klaar");
      } else {
        setMelding(uitkomst.melding);
        setStatus("fout");
      }
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

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="display-title text-3xl text-heading sm:text-4xl">Foto&apos;s</h2>
        <p className="text-sm text-muted">
          Nieuwe foto&apos;s worden in de browser verkleind en als WebP geüpload. Elke foto
          heeft een alt-tekst nodig: die leest een schermlezer voor.
        </p>
      </div>

      <UploadWachtrij
        onGeupload={(afbeelding) =>
          setFotos((vorige) => [{ ...afbeelding, gebruik: 0 }, ...vorige])
        }
        onUitgelogd={uitgelogd}
      />

      <section aria-labelledby="bibliotheek-titel" className="flex flex-col gap-4">
        <h3 id="bibliotheek-titel" className="text-lg font-semibold text-heading">
          Bibliotheek
          {status === "klaar" && (
            <span className="ml-2 text-sm font-normal text-muted">
              {fotos.length} {fotos.length === 1 ? "foto" : "foto's"}
            </span>
          )}
        </h3>

        {status === "laden" && (
          <p className="py-12 text-center text-sm text-muted">Bezig met laden…</p>
        )}

        {status === "fout" && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p role="alert" className="text-sm text-danger">
              {melding}
            </p>
            <Button variant="outline" size="sm" onClick={herlaad}>
              Opnieuw proberen
            </Button>
          </div>
        )}

        {status === "klaar" && fotos.length === 0 && (
          <p className="rounded-3xl border border-line bg-surface px-6 py-12 text-center text-sm text-muted">
            Er staan nog geen foto&apos;s in de bibliotheek. Upload hierboven je eerste foto.
          </p>
        )}

        {status === "klaar" && fotos.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fotos.map((foto) => (
              <FotoKaart
                key={foto.id}
                foto={foto}
                onGewijzigd={(nieuw) =>
                  setFotos((vorige) =>
                    vorige.map((f) => (f.id === nieuw.id ? { ...f, alt: nieuw.alt } : f)),
                  )
                }
                onVerwijderd={() =>
                  setFotos((vorige) => vorige.filter((f) => f.id !== foto.id))
                }
                onUitgelogd={uitgelogd}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ophalen                                                                    */
/* -------------------------------------------------------------------------- */

type LaadUitkomst =
  | { soort: "klaar"; fotos: AfbeeldingMetGebruik[] }
  | { soort: "uitgelogd" }
  | { soort: "fout"; melding: string };

async function haalFotos(): Promise<LaadUitkomst> {
  try {
    const antwoord = await fetch(API.afbeeldingen, { headers: { Accept: "application/json" } });
    if (antwoord.status === 401) return { soort: "uitgelogd" };
    if (!antwoord.ok) {
      return { soort: "fout", melding: await leesMelding(antwoord, "De foto's konden niet geladen worden.") };
    }
    const data = (await antwoord.json()) as AfbeeldingenAntwoord;
    return { soort: "klaar", fotos: data.afbeeldingen };
  } catch {
    return { soort: "fout", melding: "Geen verbinding met de server." };
  }
}

async function leesMelding(antwoord: Response, standaard: string): Promise<string> {
  const data = (await antwoord.json().catch(() => null)) as { melding?: unknown } | null;
  return typeof data?.melding === "string" ? data.melding : standaard;
}

/* -------------------------------------------------------------------------- */
/* Uploaden                                                                   */
/* -------------------------------------------------------------------------- */

interface WachtrijItem {
  sleutel: string;
  bestand: File;
  /** `blob:`-URL voor het voorbeeld; vrijgeven zodra het item weg is. */
  voorbeeld: string;
  alt: string;
  altFout?: string;
  fase: "wacht" | "verkleinen" | "uploaden" | "fout";
  voortgang: number;
  melding?: string;
}

const TOEGESTANE_TYPES = "image/jpeg,image/png,image/webp";

function UploadWachtrij({
  onGeupload,
  onUitgelogd,
}: {
  onGeupload: (afbeelding: AfbeeldingRecord) => void;
  onUitgelogd: () => void;
}) {
  const [items, setItems] = useState<WachtrijItem[]>([]);
  const [bezig, setBezig] = useState(false);
  const [bevestiging, setBevestiging] = useState<string | null>(null);
  const invoerRef = useRef<HTMLInputElement>(null);
  const teller = useRef(0);

  // Alvast testen of canvas WebP kan coderen; de uitkomst wordt onthouden.
  useEffect(() => {
    void canvasMaaktWebp();
  }, []);

  // Voorbeeld-URL's houden het bestand in het geheugen vast tot ze vrijgegeven zijn.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.voorbeeld)), []);

  function voegToe(bestanden: FileList | null) {
    if (!bestanden || bestanden.length === 0) return;
    setBevestiging(null);
    const nieuw = [...bestanden].map((bestand): WachtrijItem => {
      const fotoType = TOEGESTANE_TYPES.split(",").includes(bestand.type);
      return {
        sleutel: `${Date.now()}-${(teller.current += 1)}`,
        bestand,
        voorbeeld: fotoType ? URL.createObjectURL(bestand) : "",
        alt: "",
        fase: fotoType ? "wacht" : "fout",
        voortgang: 0,
        melding: fotoType ? undefined : "Alleen JPEG, PNG of WebP.",
      };
    });
    setItems((vorige) => [...vorige, ...nieuw]);
    // Leegmaken, zodat hetzelfde bestand nog eens kiezen ook een `change` geeft.
    if (invoerRef.current) invoerRef.current.value = "";
  }

  function wijzig(sleutel: string, wijziging: Partial<WachtrijItem>) {
    setItems((vorige) => vorige.map((item) => (item.sleutel === sleutel ? { ...item, ...wijziging } : item)));
  }

  function haalWeg(sleutel: string) {
    setItems((vorige) => {
      const item = vorige.find((i) => i.sleutel === sleutel);
      if (item?.voorbeeld) URL.revokeObjectURL(item.voorbeeld);
      return vorige.filter((i) => i.sleutel !== sleutel);
    });
  }

  async function uploadAlles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bezig) return;
    setBevestiging(null);

    const teUploaden = items.filter((item) => item.voorbeeld);
    const zonderAlt = teUploaden.filter((item) => !item.alt.trim());
    if (zonderAlt.length > 0) {
      for (const item of zonderAlt) wijzig(item.sleutel, { altFout: "Vul een alt-tekst in." });
      document.getElementById(`alt-${zonderAlt[0].sleutel}`)?.focus();
      return;
    }

    setBezig(true);
    let gelukt = 0;

    /*
     * Eén voor één: een foto van 4000px decoderen kost tientallen MB geheugen, en
     * vijf tegelijk laat een telefoon de tab sluiten. De upload zelf wint er ook
     * niets bij, want de verbinding is de bottleneck.
     */
    for (const item of teUploaden) {
      wijzig(item.sleutel, { fase: "verkleinen", voortgang: 0, melding: undefined, altFout: undefined });
      try {
        const varianten = await maakVarianten(item.bestand);
        wijzig(item.sleutel, { fase: "uploaden" });
        const uitkomst = await uploadFoto(varianten, item.alt.trim(), (deel) =>
          wijzig(item.sleutel, { voortgang: deel }),
        );

        if (uitkomst.soort === "uitgelogd") {
          // Niet op "bezig" laten hangen: na opnieuw inloggen moet dit item opnieuw kunnen.
          wijzig(item.sleutel, { fase: "fout", melding: "Je bent uitgelogd. Log opnieuw in en upload deze foto nog eens." });
          setBezig(false);
          onUitgelogd();
          return;
        }
        if (uitkomst.soort === "fout") {
          wijzig(item.sleutel, { fase: "fout", melding: uitkomst.melding });
          continue;
        }

        onGeupload(uitkomst.afbeelding);
        haalWeg(item.sleutel);
        gelukt += 1;
      } catch (fout) {
        wijzig(item.sleutel, {
          fase: "fout",
          melding: fout instanceof UploadFout ? fout.message : "Deze foto kon niet verwerkt worden.",
        });
      }
    }

    setBezig(false);
    if (gelukt > 0) {
      setBevestiging(gelukt === 1 ? "1 foto geüpload." : `${gelukt} foto's geüpload.`);
    }
  }

  const klaarVoorUpload = items.some((item) => item.voorbeeld);

  return (
    <section aria-labelledby="upload-titel" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="upload-titel" className="text-lg font-semibold text-heading">
          Foto&apos;s toevoegen
        </h3>
        {/* Het echte invoerveld blijft in de DOM en focusbaar; het label is de zichtbare knop. */}
        <div>
          <input
            ref={invoerRef}
            id="foto-bestanden"
            type="file"
            accept={TOEGESTANE_TYPES}
            multiple
            disabled={bezig}
            onChange={(event) => voegToe(event.target.files)}
            className="peer sr-only"
          />
          <label
            htmlFor="foto-bestanden"
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface px-4 py-2 text-xs font-semibold tracking-wide text-heading transition-all hover:border-accent/60 hover:bg-surface-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-60 sm:text-sm"
          >
            Kies foto&apos;s
          </label>
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-accent empty:hidden">
        {bevestiging}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted">
          Kies een of meer JPEG-, PNG- of WebP-bestanden. Je vult daarna per foto een
          alt-tekst in.
        </p>
      ) : (
        <form onSubmit={uploadAlles} noValidate className="flex flex-col gap-4">
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li
                key={item.sleutel}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-page p-4 sm:flex-row"
              >
                <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-xl bg-sunken sm:w-40">
                  {item.voorbeeld && (
                    <Image src={item.voorbeeld} alt="" fill unoptimized className="object-cover" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <p className="truncate text-xs text-muted" title={item.bestand.name}>
                    {item.bestand.name}
                  </p>

                  {item.voorbeeld && (
                    <Field
                      naam={`alt-${item.sleutel}`}
                      label="Alt-tekst"
                      value={item.alt}
                      maxLength={UPLOAD.maxAlt}
                      required
                      disabled={bezig}
                      placeholder="Bijv. pelgrims bij de Kaaba"
                      fout={item.altFout}
                      onChange={(event) =>
                        wijzig(item.sleutel, { alt: event.target.value, altFout: undefined })
                      }
                    />
                  )}

                  <UploadStatus item={item} />

                  <div>
                    <button
                      type="button"
                      onClick={() => haalWeg(item.sleutel)}
                      disabled={bezig && item.fase !== "fout"}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-strong hover:text-heading disabled:opacity-50"
                    >
                      Weghalen
                      <span className="sr-only"> uit de wachtrij: {item.bestand.name}</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <Button type="submit" size="sm" disabled={bezig || !klaarVoorUpload}>
              {bezig ? "Bezig met uploaden…" : "Uploaden"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function UploadStatus({ item }: { item: WachtrijItem }) {
  if (item.fase === "fout") {
    return (
      <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
        {item.melding}
      </p>
    );
  }
  if (item.fase === "wacht") return null;

  const label = item.fase === "verkleinen" ? "Verkleinen…" : `Uploaden… ${Math.round(item.voortgang * 100)}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted" aria-live="polite">
        {label}
      </p>
      <progress
        aria-label={`Voortgang van ${item.bestand.name}`}
        // Zonder `value` toont een browser een bezig-balk: zo is het bij het verkleinen.
        value={item.fase === "uploaden" ? item.voortgang : undefined}
        max={1}
        className="h-1.5 w-full overflow-hidden rounded-full accent-[var(--color-accent)]"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Eén foto in de bibliotheek                                                 */
/* -------------------------------------------------------------------------- */

function FotoKaart({
  foto,
  onGewijzigd,
  onVerwijderd,
  onUitgelogd,
}: {
  foto: AfbeeldingMetGebruik;
  onGewijzigd: (foto: { id: string; alt: string }) => void;
  onVerwijderd: () => void;
  onUitgelogd: () => void;
}) {
  const [bewerken, setBewerken] = useState(false);
  const [alt, setAlt] = useState(foto.alt);
  const [bezig, setBezig] = useState<"opslaan" | "verwijderen" | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const altVeld = `alt-bewerk-${foto.id}`;

  /*
   * Elke breedte uit de ladder staat in R2, dus next/image mag de `srcset` gewoon
   * uit de ingestelde breedtes opbouwen; deze loader wijst ze aan.
   */
  const loader: ImageLoader = ({ width }) => `${MEDIA_PAD}${foto.sleutel}/${width}.webp`;

  async function bewaar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nieuw = alt.trim();
    if (!nieuw) {
      setMelding("Vul een alt-tekst in.");
      return;
    }
    setBezig("opslaan");
    setMelding(null);
    try {
      const antwoord = await fetch(afbeeldingPad(foto.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ alt: nieuw }),
      });
      if (antwoord.status === 401) return onUitgelogd();
      if (!antwoord.ok) {
        setMelding(await leesMelding(antwoord, "Opslaan is niet gelukt."));
        return;
      }
      const data = (await antwoord.json()) as AfbeeldingAntwoord;
      if (data.ok) onGewijzigd(data.afbeelding);
      setBewerken(false);
    } catch {
      setMelding("Geen verbinding met de server.");
    } finally {
      setBezig(null);
    }
  }

  async function verwijder() {
    if (!window.confirm(`De foto "${foto.alt}" definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) {
      return;
    }
    setBezig("verwijderen");
    setMelding(null);
    try {
      const antwoord = await fetch(afbeeldingPad(foto.id), {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      if (antwoord.status === 401) return onUitgelogd();
      // 404: al weg, bv. in een ander tabblad. Uit beeld halen is dan het juiste antwoord.
      if (antwoord.ok || antwoord.status === 404) return onVerwijderd();
      // 409 noemt de reizen of de homepagegalerij waar de foto nog staat.
      setMelding(await leesMelding(antwoord, "Verwijderen is niet gelukt."));
    } catch {
      setMelding("Geen verbinding met de server.");
    } finally {
      setBezig(null);
    }
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="relative aspect-[3/2] bg-sunken">
        <Image
          loader={loader}
          src={`${MEDIA_PAD}${foto.sleutel}`}
          alt={foto.alt}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 30vw, (min-width: 420px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {bewerken ? (
          <form onSubmit={bewaar} noValidate className="flex flex-col gap-3">
            <Field
              naam={altVeld}
              label="Alt-tekst"
              value={alt}
              maxLength={UPLOAD.maxAlt}
              required
              autoFocus
              disabled={bezig !== null}
              onChange={(event) => setAlt(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={bezig !== null}>
                {bezig === "opslaan" ? "Opslaan…" : "Opslaan"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={bezig !== null}
                onClick={() => {
                  setAlt(foto.alt);
                  setMelding(null);
                  setBewerken(false);
                }}
              >
                Annuleren
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm leading-relaxed text-body">{foto.alt}</p>
        )}

        <p className="text-xs text-muted">
          {foto.width} × {foto.height}px ·{" "}
          {foto.gebruik === 0
            ? "niet in gebruik"
            : `in gebruik op ${foto.gebruik} ${foto.gebruik === 1 ? "plek" : "plekken"}`}
        </p>

        {melding && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
            {melding}
          </p>
        )}

        {!bewerken && (
          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAlt(foto.alt);
                setMelding(null);
                setBewerken(true);
              }}
              disabled={bezig !== null}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-heading transition-colors hover:bg-surface-strong disabled:opacity-50"
            >
              Alt-tekst wijzigen
            </button>
            <button
              type="button"
              onClick={() => void verwijder()}
              disabled={bezig !== null}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
            >
              {bezig === "verwijderen" ? "Bezig…" : "Verwijder"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
