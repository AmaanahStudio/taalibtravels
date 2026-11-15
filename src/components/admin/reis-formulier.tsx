"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, TextArea } from "@/components/ui/field";
import { INCLUSION_ICONS } from "@/components/ui/icons";
/*
 * Uitzondering op "nooit rechtstreeks uit src/data": de vroegere gedeelde
 * inclusies leven alleen nog als snelkeuze in dit formulier (zie het ontwerp).
 * Ze gaan via content.ts nergens anders meer heen.
 */
import inclusieVoorstellen from "@/data/inclusions.json";
import { API, reisPad, type ReisAntwoord, type ReisRecord } from "@/lib/api";
import {
  GALERIJ_AANTAL,
  ICON_KEYS,
  maakSlug,
  valideerReis,
  type ReisFouten,
} from "@/lib/reizen";
import type { IconKey, TripAudience, TripStatus } from "@/lib/types";

import { FotoKiezer } from "./foto-kiezer";
import { verplaats, VolgordeKnoppen } from "./volgorde-knoppen";

/**
 * Aanmaken en bewerken van één reis, met elk veld uit de tabel "Reispagina
 * volledig bewerkbaar" in het ontwerp.
 *
 * Het formulier houdt een eigen concept bij met tekst voor de getallen: een
 * half getypt bedrag ("1499,") moet kunnen bestaan zonder dat het veld zichzelf
 * corrigeert. Pas bij het opslaan wordt het een `ReisInvoer`, die door
 * dezelfde `valideerReis` gaat als in de Worker. De browser waarschuwt vroeg,
 * de Worker oordeelt.
 */

export const DOELGROEPEN: Record<TripAudience, string> = {
  brothers: "Broeders",
  sisters: "Zusters",
  mixed: "Gemengd",
  families: "Families",
};

export const STATUSSEN: Record<TripStatus, string> = {
  draft: "Verborgen (concept)",
  published: "Gepubliceerd",
  "sold-out": "Uitverkocht",
};

const ICOON_NAMEN: Record<IconKey, string> = {
  plane: "Vliegtuig",
  hotel: "Hotel",
  passport: "Paspoort",
  guide: "Begeleiding",
  activities: "Activiteiten",
  education: "Opleiding",
  meals: "Maaltijden",
  transport: "Vervoer",
};

const VOORSTELLEN = Object.values(inclusieVoorstellen) as {
  label: string;
  description?: string;
  icon: IconKey;
}[];

interface AlineaRij {
  sleutel: number;
  tekst: string;
}

interface InclusieRij {
  sleutel: number;
  label: string;
  description: string;
  icon: IconKey | "";
}

interface Concept {
  /** Alleen gebruikt als de beheerder hem zelf invult; anders volgt hij de titel. */
  slug: string;
  slugHandmatig: boolean;
  title: string;
  subtitle: string;
  summary: string;
  description: AlineaRij[];
  departureDate: string;
  returnDate: string;
  prijs: string;
  prijsNotitie: string;
  termijnen: boolean;
  inclusions: InclusieRij[];
  coverImage: string;
  eigenGalerij: boolean;
  gallery: string[];
  audience: TripAudience | "";
  status: TripStatus;
  spotsTotal: string;
  spotsLeft: string;
}

/** De velden van het concept die gewone tekst zijn, en dus één-op-één een invoerveld. */
type TekstSleutel = {
  [K in keyof Concept]: Concept[K] extends string ? K : never;
}[keyof Concept];

/*
 * Sleutels voor React, los van de index: de foutpaden van `valideerReis`
 * gebruiken wél de index (`inclusions.2.label`), en die is altijd de huidige
 * positie in de lijst — precies wat er op het scherm staat.
 */
let laatsteSleutel = 0;
const nieuweSleutel = () => ++laatsteSleutel;

/** "1499.99" → "1499,99": zo typt een Belg een bedrag. */
function bedragAlsTekst(bedrag: number): string {
  return String(bedrag).replace(".", ",");
}

/**
 * "1.499,99", "1499,99" en "1499.99" worden allemaal 1499.99. Staat er een
 * komma, dan zijn punten duizendtallen; anders is de punt het decimaalteken.
 */
function leesBedrag(tekst: string): number {
  const t = tekst.trim().replace(/\s|€/g, "");
  if (!t) return Number.NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

/** Leeg betekent "niet tonen"; al het andere moet een getal zijn. */
function leesAantal(tekst: string): number | undefined {
  const t = tekst.trim();
  return t ? Number(t) : undefined;
}

function naarConcept(reis?: ReisRecord): Concept {
  if (!reis) {
    return {
      slug: "",
      slugHandmatig: false,
      title: "",
      subtitle: "",
      summary: "",
      description: [{ sleutel: nieuweSleutel(), tekst: "" }],
      departureDate: "",
      returnDate: "",
      prijs: "",
      prijsNotitie: "",
      termijnen: false,
      inclusions: [],
      coverImage: "",
      eigenGalerij: false,
      gallery: [],
      audience: "",
      // Een nieuwe reis staat pas online als de beheerder dat zelf kiest.
      status: "draft",
      spotsTotal: "",
      spotsLeft: "",
    };
  }

  return {
    slug: reis.slug,
    slugHandmatig: true,
    title: reis.title,
    subtitle: reis.subtitle,
    summary: reis.summary,
    description: (reis.description.length > 0 ? reis.description : [""]).map((tekst) => ({
      sleutel: nieuweSleutel(),
      tekst,
    })),
    departureDate: reis.departureDate,
    returnDate: reis.returnDate,
    prijs: bedragAlsTekst(reis.price.amount),
    prijsNotitie: reis.price.note ?? "",
    termijnen: reis.price.installmentsAvailable,
    inclusions: reis.inclusions.map((inclusie) => ({
      sleutel: nieuweSleutel(),
      label: inclusie.label,
      description: inclusie.description ?? "",
      icon: inclusie.icon,
    })),
    coverImage: reis.coverImage,
    // Een kapotte rij (minder dan zes id's) blijft een eigen galerij, zodat de
    // beheerder ziet wat er ontbreekt in plaats van stil de gedeelde te krijgen.
    eigenGalerij: reis.gallery !== null,
    gallery: reis.gallery ?? [],
    audience: reis.audience,
    status: reis.status,
    spotsTotal: reis.spotsTotal === undefined ? "" : String(reis.spotsTotal),
    spotsLeft: reis.spotsLeft === undefined ? "" : String(reis.spotsLeft),
  };
}

/**
 * Het concept als ruwe invoer voor `valideerReis`. Bewust niet het opgeschoonde
 * resultaat versturen: dat laat lege alinea's weg, en dan wijzen de
 * foutindexen van de Worker naar een andere rij dan op het scherm.
 */
function naarInvoer(concept: Concept, slug: string) {
  const notitie = concept.prijsNotitie.trim();
  return {
    slug,
    title: concept.title,
    subtitle: concept.subtitle,
    summary: concept.summary,
    description: concept.description.map((rij) => rij.tekst),
    departureDate: concept.departureDate,
    returnDate: concept.returnDate,
    price: {
      amount: leesBedrag(concept.prijs),
      installmentsAvailable: concept.termijnen,
      ...(notitie ? { note: notitie } : {}),
    },
    inclusions: concept.inclusions.map((rij) => ({
      label: rij.label,
      ...(rij.description.trim() ? { description: rij.description } : {}),
      icon: rij.icon,
    })),
    coverImage: concept.coverImage,
    gallery: concept.eigenGalerij ? concept.gallery : null,
    audience: concept.audience,
    status: concept.status,
    spotsTotal: leesAantal(concept.spotsTotal),
    spotsLeft: leesAantal(concept.spotsLeft),
  };
}

/** Het id van het element bij een foutpad; zie `veld` hieronder. */
const veldId = (pad: string) => `reis-${pad}`;

/** Focus op het eerste veld met een fout, in de volgorde van de pagina. */
function focusEersteFout(fouten: ReisFouten) {
  const elementen = Object.keys(fouten)
    .map((pad) => document.getElementById(veldId(pad)))
    .filter((element): element is HTMLElement => element !== null)
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  elementen[0]?.focus();
}

/** Verwijdert de serverfouten van een veld en alles eronder (`inclusions` → `inclusions.2.label`). */
function zonderPaden(fouten: ReisFouten, paden: string[]): ReisFouten {
  return Object.fromEntries(
    Object.entries(fouten).filter(
      ([pad]) => !paden.some((weg) => pad === weg || pad.startsWith(`${weg}.`)),
    ),
  );
}

/** Een groep velden met een kop. `id` maakt hem focusbaar voor een groepsfout. */
function Groep({
  titel,
  uitleg,
  id,
  fout,
  children,
}: {
  titel: string;
  uitleg?: string;
  id?: string;
  fout?: string;
  children: ReactNode;
}) {
  // Een kop en geen <legend>: een legend zit vast op de rand van de fieldset,
  // en een kop is bovendien te vinden via de kopnavigatie van een schermlezer.
  const kopId = useId();
  return (
    <fieldset
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={kopId}
      aria-describedby={id && fout ? `${id}-fout` : undefined}
      className="flex min-w-0 flex-col gap-5 rounded-3xl border border-line bg-surface p-5 sm:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id={kopId} className="text-lg font-semibold text-heading">
          {titel}
        </h2>
        {uitleg && <p className="text-sm leading-relaxed text-muted">{uitleg}</p>}
      </div>
      {fout && id && (
        <p id={`${id}-fout`} className="text-sm text-danger">
          {fout}
        </p>
      )}
      {children}
    </fieldset>
  );
}

const WEGHALEN_STIJL =
  "rounded-full px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-soft";

export function ReisFormulier({
  reis,
  onKlaar,
  onUitgelogd,
}: {
  /** Ontbreekt bij een nieuwe reis. */
  reis?: ReisRecord;
  /** Met de opgeslagen reis na opslaan, zonder argument bij annuleren. */
  onKlaar: (opgeslagen?: ReisRecord) => void;
  onUitgelogd: () => void;
}) {
  const bewerken = reis !== undefined;
  const [concept, setConcept] = useState<Concept>(() => naarConcept(reis));
  const [gewijzigd, setGewijzigd] = useState(false);
  /** Na de eerste poging tot opslaan valideert het formulier bij elke wijziging. */
  const [poging, setPoging] = useState(false);
  const [serverFouten, setServerFouten] = useState<ReisFouten>({});
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const slug = bewerken
    ? reis.slug
    : concept.slugHandmatig
      ? concept.slug
      : maakSlug(concept.title, concept.subtitle);

  // `maakSlug` geeft "" bij een titel zonder Latijnse letters (bv. alleen
  // Arabisch). Dat is geen geldige slug, en dat moet meteen te zien zijn.
  const slugFout =
    !bewerken && !concept.slugHandmatig && !slug && concept.title.trim()
      ? "Uit deze titel valt geen adres te maken. Vul zelf een slug in, bv. umrah-ramadan."
      : undefined;

  const invoer = naarInvoer(concept, slug);
  const controle = poging ? valideerReis(invoer) : null;
  const clientFouten = controle && !controle.ok ? controle.fouten : {};
  const fouten: ReisFouten = {
    ...serverFouten,
    ...clientFouten,
    ...(slugFout ? { slug: slugFout } : {}),
  };

  /**
   * Past het concept aan en wist de serverfouten van de genoemde velden: die
   * gingen over de oude waarde. De rest blijft staan tot de volgende poging.
   */
  function pas(wijziging: (vorig: Concept) => Partial<Concept>, ...paden: string[]) {
    setConcept((vorig) => ({ ...vorig, ...wijziging(vorig) }));
    setGewijzigd(true);
    if (paden.length > 0) setServerFouten((vorige) => zonderPaden(vorige, paden));
  }

  /** De gedeelde props van een veld: naam/id en de bijbehorende melding. */
  function veld(pad: string) {
    return { naam: veldId(pad), fout: fouten[pad] };
  }

  function tekstVeld(pad: TekstSleutel) {
    return {
      ...veld(pad),
      value: concept[pad],
      onChange: (event: { target: { value: string } }) => {
        const waarde = event.target.value;
        pas(() => ({ [pad]: waarde }), pad);
      },
    };
  }

  async function opslaan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bezig) return;

    setPoging(true);
    setMelding(null);

    const resultaat = valideerReis(invoer);
    if (!resultaat.ok || slugFout) {
      setMelding("Controleer de gemarkeerde velden.");
      focusEersteFout({
        ...(resultaat.ok ? {} : resultaat.fouten),
        ...(slugFout ? { slug: slugFout } : {}),
      });
      return;
    }

    setBezig(true);
    try {
      const antwoord = await fetch(bewerken ? reisPad(reis.slug) : API.reizen, {
        method: bewerken ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(invoer),
      });

      if (antwoord.status === 401) {
        onUitgelogd();
        return;
      }

      const data = (await antwoord.json().catch(() => null)) as ReisAntwoord | null;

      if (antwoord.ok && data?.ok) {
        onKlaar(data.reis);
        return;
      }

      const nieuweFouten = data && !data.ok ? (data.fouten ?? {}) : {};
      setServerFouten(nieuweFouten);
      setMelding(data && !data.ok ? data.melding : "Opslaan is niet gelukt.");
      focusEersteFout(nieuweFouten);
    } catch {
      setMelding("Geen verbinding met de server. Je wijzigingen staan nog in het formulier.");
    } finally {
      setBezig(false);
    }
  }

  function annuleer() {
    if (gewijzigd && !window.confirm("Je wijzigingen zijn nog niet opgeslagen. Weggooien?")) {
      return;
    }
    onKlaar();
  }

  /* ---------------------------- lijsten --------------------------------- */

  function wijzigAlinea(sleutel: number, tekst: string) {
    pas(
      (vorig) => ({
        description: vorig.description.map((rij) =>
          rij.sleutel === sleutel ? { ...rij, tekst } : rij,
        ),
      }),
      "description",
    );
  }

  function wijzigInclusie(sleutel: number, wijziging: Partial<InclusieRij>) {
    pas(
      (vorig) => ({
        inclusions: vorig.inclusions.map((rij) =>
          rij.sleutel === sleutel ? { ...rij, ...wijziging } : rij,
        ),
      }),
      "inclusions",
    );
  }

  function voegInclusieToe(voorstel?: (typeof VOORSTELLEN)[number]) {
    pas(
      (vorig) => ({
        inclusions: [
          ...vorig.inclusions,
          {
            sleutel: nieuweSleutel(),
            label: voorstel?.label ?? "",
            description: voorstel?.description ?? "",
            icon: voorstel?.icon ?? "",
          },
        ],
      }),
      "inclusions",
    );
  }

  const gebruikteLabels = new Set(concept.inclusions.map((rij) => rij.label.trim()));
  const openVoorstellen = VOORSTELLEN.filter((voorstel) => !gebruikteLabels.has(voorstel.label));

  return (
    <form onSubmit={opslaan} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="display-title text-3xl text-heading sm:text-4xl">
          {bewerken ? "Reis bewerken" : "Nieuwe reis"}
        </h1>
        {bewerken && <p className="text-sm text-muted">{reis.title}</p>}
      </div>

      {melding && (
        <p
          role="alert"
          className="rounded-2xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {melding}
        </p>
      )}

      <Groep titel="Basis" uitleg="Titel en ondertitel staan op de kaart en bovenaan de reispagina.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field {...tekstVeld("title")} label="Titel" placeholder="Umrah" />
          <Field {...tekstVeld("subtitle")} label="Ondertitel" placeholder="Budget" />
        </div>

        <div className="flex flex-col gap-2">
          <Field
            {...veld("slug")}
            label="Slug (adres)"
            value={slug}
            readOnly={bewerken}
            onChange={(event) => {
              const waarde = event.target.value;
              pas(() => ({ slug: waarde, slugHandmatig: true }), "slug");
            }}
          />
          <p className="text-xs text-muted">
            {bewerken
              ? "Het adres van een bestaande reis ligt vast: anders werken gedeelde links niet meer."
              : `Wordt /reizen/${slug || "…"}. Na het aanmaken kan dit niet meer wijzigen.`}
          </p>
          {!bewerken && concept.slugHandmatig && (
            <button
              type="button"
              onClick={() => pas(() => ({ slug: "", slugHandmatig: false }), "slug")}
              className="self-start text-xs font-semibold text-accent underline-offset-4 hover:underline"
            >
              Opnieuw uit de titel maken
            </button>
          )}
        </div>

        <TextArea {...tekstVeld("summary")} label="Samenvatting" rows={3} />
      </Groep>

      <Groep titel="Datums">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field {...tekstVeld("departureDate")} type="date" label="Vertrek" />
          <Field {...tekstVeld("returnDate")} type="date" label="Terugkeer" />
        </div>
      </Groep>

      <Groep titel="Prijs">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            {...veld("price.amount")}
            label="Bedrag in euro"
            inputMode="decimal"
            placeholder="1499,99"
            value={concept.prijs}
            onChange={(event) => {
              const waarde = event.target.value;
              pas(() => ({ prijs: waarde }), "price.amount");
            }}
          />
          <Field
            {...veld("price.note")}
            label="Notitie onder de prijs"
            optioneel
            placeholder="p.p. op basis van een 4-persoonskamer"
            value={concept.prijsNotitie}
            onChange={(event) => {
              const waarde = event.target.value;
              pas(() => ({ prijsNotitie: waarde }), "price.note");
            }}
          />
        </div>
        <Checkbox
          {...veld("price.installmentsAvailable")}
          label="Betalen in termijnen is mogelijk"
          checked={concept.termijnen}
          onChange={(event) => {
            const waarde = event.target.checked;
            pas(() => ({ termijnen: waarde }), "price.installmentsAvailable");
          }}
        />
      </Groep>

      <Groep
        titel="Over deze reis"
        uitleg="Het programma op de reispagina, alinea per alinea. Lege alinea's worden weggelaten."
        id={veldId("description")}
        fout={fouten.description}
      >
        <ol className="flex flex-col gap-4">
          {concept.description.map((rij, index) => (
            <li key={rij.sleutel} className="flex flex-col gap-2">
              <TextArea
                {...veld(`description.${index}`)}
                label={`Alinea ${index + 1}`}
                value={rij.tekst}
                onChange={(event) => wijzigAlinea(rij.sleutel, event.target.value)}
              />
              <div className="flex items-center justify-end gap-2">
                <VolgordeKnoppen
                  index={index}
                  aantal={concept.description.length}
                  onderwerp="Alinea"
                  onVerplaats={(naar) =>
                    pas(
                      (vorig) => ({ description: verplaats(vorig.description, index, naar) }),
                      "description",
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    pas(
                      (vorig) => ({
                        description: vorig.description.filter((r) => r.sleutel !== rij.sleutel),
                      }),
                      "description",
                    )
                  }
                  aria-label={`Alinea ${index + 1} weghalen`}
                  className={WEGHALEN_STIJL}
                >
                  Weghalen
                </button>
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            pas(
              (vorig) => ({
                description: [...vorig.description, { sleutel: nieuweSleutel(), tekst: "" }],
              }),
              "description",
            )
          }
        >
          Alinea toevoegen
        </Button>
      </Groep>

      <Groep
        titel="Wat zit erbij"
        uitleg="De inclusief-regels op de reispagina, in deze volgorde."
        id={veldId("inclusions")}
        fout={fouten.inclusions}
      >
        {concept.inclusions.length === 0 ? (
          <p className="text-sm text-muted">Nog geen regels. Kies er hieronder een of voeg een lege toe.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {concept.inclusions.map((rij, index) => {
              const Icoon = rij.icon ? INCLUSION_ICONS[rij.icon] : null;
              return (
                <li
                  key={rij.sleutel}
                  className="flex flex-col gap-4 rounded-2xl border border-line bg-page p-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      {...veld(`inclusions.${index}.label`)}
                      label={`Regel ${index + 1}: label`}
                      value={rij.label}
                      onChange={(event) => wijzigInclusie(rij.sleutel, { label: event.target.value })}
                    />
                    <div className="flex items-end gap-3">
                      <Select
                        {...veld(`inclusions.${index}.icon`)}
                        label="Icoon"
                        className="flex-1"
                        value={rij.icon}
                        onChange={(event) =>
                          wijzigInclusie(rij.sleutel, { icon: event.target.value as IconKey | "" })
                        }
                      >
                        <option value="">Kies…</option>
                        {ICON_KEYS.map((sleutel) => (
                          <option key={sleutel} value={sleutel}>
                            {ICOON_NAMEN[sleutel]}
                          </option>
                        ))}
                      </Select>
                      <span
                        className="mb-1 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-accent"
                        aria-hidden="true"
                      >
                        {Icoon && <Icoon className="size-5" />}
                      </span>
                    </div>
                  </div>
                  <Field
                    {...veld(`inclusions.${index}.description`)}
                    label="Toelichting"
                    optioneel
                    value={rij.description}
                    onChange={(event) =>
                      wijzigInclusie(rij.sleutel, { description: event.target.value })
                    }
                  />
                  <div className="flex items-center justify-end gap-2">
                    <VolgordeKnoppen
                      index={index}
                      aantal={concept.inclusions.length}
                      onderwerp="Regel"
                      onVerplaats={(naar) =>
                        pas(
                          (vorig) => ({ inclusions: verplaats(vorig.inclusions, index, naar) }),
                          "inclusions",
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        pas(
                          (vorig) => ({
                            inclusions: vorig.inclusions.filter((r) => r.sleutel !== rij.sleutel),
                          }),
                          "inclusions",
                        )
                      }
                      aria-label={`Regel ${index + 1} weghalen`}
                      className={WEGHALEN_STIJL}
                    >
                      Weghalen
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-3">
          {openVoorstellen.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-[0.14em] text-heading uppercase">
                Snelkeuze
              </p>
              <ul className="flex flex-wrap gap-2">
                {openVoorstellen.map((voorstel) => (
                  <li key={voorstel.label}>
                    <button
                      type="button"
                      onClick={() => voegInclusieToe(voorstel)}
                      className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-heading transition-colors hover:border-accent/60 hover:bg-surface-strong"
                    >
                      <span aria-hidden="true">+ </span>
                      {voorstel.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => voegInclusieToe()}
          >
            Lege regel toevoegen
          </Button>
        </div>
      </Groep>

      <Groep titel="Omslagfoto" id={veldId("coverImage")} fout={fouten.coverImage}>
        <FotoKiezer
          label="Omslagfoto"
          max={1}
          waarde={concept.coverImage ? [concept.coverImage] : []}
          onChange={(ids) => pas(() => ({ coverImage: ids[0] ?? "" }), "coverImage")}
          onUitgelogd={onUitgelogd}
        />
      </Groep>

      <Groep
        titel="Fotogalerij"
        uitleg={`De gedeelde galerij van de homepage, of ${GALERIJ_AANTAL} eigen foto's. De eerste wordt op grote schermen de grote tegel.`}
        id={veldId("gallery")}
        fout={fouten.gallery}
      >
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Welke galerij">
          {[
            { eigen: false, label: "Gebruik de gedeelde galerij" },
            { eigen: true, label: `Eigen galerij van ${GALERIJ_AANTAL} foto's` },
          ].map((optie) => (
            <label
              key={String(optie.eigen)}
              className="flex cursor-pointer items-center gap-3 text-sm text-body"
            >
              <input
                type="radio"
                name="reis-galerij-keuze"
                checked={concept.eigenGalerij === optie.eigen}
                onChange={() => pas(() => ({ eigenGalerij: optie.eigen }), "gallery")}
                className="size-5 shrink-0 cursor-pointer accent-[var(--color-accent)]"
              />
              {optie.label}
            </label>
          ))}
        </div>

        {concept.eigenGalerij && (
          <FotoKiezer
            label="Galerijfoto's"
            max={GALERIJ_AANTAL}
            waarde={concept.gallery}
            onChange={(ids) => pas(() => ({ gallery: ids }), "gallery")}
            onUitgelogd={onUitgelogd}
          />
        )}
      </Groep>

      <Groep
        titel="Plekken en zichtbaarheid"
        uitleg={'Laat de plekken leeg om op de kaart geen "Nog X plekken" te tonen.'}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            {...tekstVeld("spotsTotal")}
            label="Plekken in totaal"
            optioneel
            inputMode="numeric"
          />
          <Field
            {...tekstVeld("spotsLeft")}
            label="Plekken vrij"
            optioneel
            inputMode="numeric"
          />
          <Select {...tekstVeld("audience")} label="Voor wie">
            <option value="">Kies…</option>
            {Object.entries(DOELGROEPEN).map(([waarde, label]) => (
              <option key={waarde} value={waarde}>
                {label}
              </option>
            ))}
          </Select>
          <Select {...tekstVeld("status")} label="Status">
            {Object.entries(STATUSSEN).map(([waarde, label]) => (
              <option key={waarde} value={waarde}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Groep>

      {/* Plakt onderaan, zodat opslaan ook halverwege een lang formulier binnen bereik is. */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-3xl border border-line bg-page/95 px-4 py-3 shadow-card backdrop-blur">
        <Button variant="ghost" size="sm" onClick={annuleer} disabled={bezig}>
          Annuleren
        </Button>
        <Button type="submit" size="sm" disabled={bezig}>
          {bezig ? "Bezig met opslaan…" : bewerken ? "Wijzigingen opslaan" : "Reis aanmaken"}
        </Button>
      </div>
    </form>
  );
}
