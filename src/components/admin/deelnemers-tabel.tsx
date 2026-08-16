"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { API, type Deelnemer } from "@/lib/api";
import { formatDateNumeric } from "@/lib/utils";

/**
 * Het overzicht zelf: zoeken, exporteren en verwijderen.
 *
 * Het filteren gebeurt in de browser en niet in de database. Bij de omvang die
 * een giveaway oplevert (honderden tot enkele duizenden rijen) is dat direct,
 * en het scheelt een ronde naar de server bij elke toetsaanslag.
 */
export function DeelnemersTabel({
  deelnemers,
  totaal,
  onVerwijder,
  onUitloggen,
}: {
  deelnemers: Deelnemer[];
  totaal: number;
  onVerwijder: (id: number) => Promise<void>;
  onUitloggen: () => void;
}) {
  const [zoekterm, setZoekterm] = useState("");
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bezigMet, setBezigMet] = useState<number | null>(null);

  const gefilterd = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    if (term.length === 0) return deelnemers;

    return deelnemers.filter((deelnemer) =>
      `${deelnemer.voornaam} ${deelnemer.achternaam} ${deelnemer.email}`
        .toLowerCase()
        .includes(term),
    );
  }, [deelnemers, zoekterm]);

  async function kopieerAdressen() {
    try {
      await navigator.clipboard.writeText(
        gefilterd.map((deelnemer) => deelnemer.email).join(", "),
      );
      setGekopieerd(true);
      window.setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // Het klembord kan geweigerd worden (geen https, of geen toestemming).
      // De CSV-export blijft dan de weg om de adressen eruit te krijgen.
      setGekopieerd(false);
    }
  }

  async function verwijder(deelnemer: Deelnemer) {
    const bevestigd = window.confirm(
      `${deelnemer.voornaam} ${deelnemer.achternaam} (${deelnemer.email}) definitief verwijderen?`,
    );
    if (!bevestigd) return;

    setBezigMet(deelnemer.id);
    try {
      await onVerwijder(deelnemer.id);
    } finally {
      setBezigMet(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="display-title text-3xl text-heading sm:text-4xl">
            Inschrijvingen
          </h1>
          <p className="text-sm text-muted">
            {totaal} {totaal === 1 ? "deelnemer" : "deelnemers"}
            {gefilterd.length !== deelnemers.length &&
              ` — ${gefilterd.length} getoond`}
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={onUitloggen}>
          Uitloggen
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={zoekterm}
          onChange={(event) => setZoekterm(event.target.value)}
          placeholder="Zoek op naam of e-mail"
          aria-label="Zoek op naam of e-mail"
          className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-heading transition-colors placeholder:text-muted/60 focus:border-accent sm:max-w-xs"
        />

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={kopieerAdressen}
            disabled={gefilterd.length === 0}
          >
            {gekopieerd ? "Gekopieerd" : "Kopieer e-mailadressen"}
          </Button>

          {/* Gewone link: de sessiecookie gaat automatisch mee, en de Worker
              zet de Content-Disposition die de download start. */}
          <Button variant="outline" size="sm" href={API.export}>
            Download CSV
          </Button>
        </div>
      </div>

      {gefilterd.length === 0 ? (
        <p className="rounded-3xl border border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          {deelnemers.length === 0
            ? "Er zijn nog geen inschrijvingen."
            : "Geen deelnemer gevonden met deze zoekterm."}
        </p>
      ) : (
        // Een tabel van vijf kolommen past niet op een telefoon; hem hier laten
        // schuiven is beter dan de pagina zelf breed maken.
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs tracking-[0.14em] text-accent uppercase">
                <th className="px-5 py-4 font-semibold">Naam</th>
                <th className="px-5 py-4 font-semibold">E-mail</th>
                <th className="px-5 py-4 font-semibold">Telefoon</th>
                <th className="px-5 py-4 font-semibold">Datum</th>
                <th className="px-5 py-4 font-semibold">
                  <span className="sr-only">Acties</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {gefilterd.map((deelnemer) => (
                <tr
                  key={deelnemer.id}
                  className="border-b border-line last:border-0 hover:bg-surface-strong"
                >
                  <td className="px-5 py-3.5 font-medium text-heading">
                    {deelnemer.voornaam} {deelnemer.achternaam}
                  </td>

                  <td className="px-5 py-3.5 text-body">
                    <a
                      href={`mailto:${deelnemer.email}`}
                      className="underline-offset-4 hover:text-accent hover:underline"
                    >
                      {deelnemer.email}
                    </a>
                  </td>

                  {/* Een streepje en geen lege cel: leeg leest als een fout. */}
                  <td className="px-5 py-3.5 text-body">
                    {deelnemer.telefoon ?? (
                      <span className="text-muted">—</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                    {formatDateNumeric(deelnemer.aangemaaktOp)}
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => verwijder(deelnemer)}
                      disabled={bezigMet === deelnemer.id}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
                    >
                      {bezigMet === deelnemer.id ? "Bezig…" : "Verwijder"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
