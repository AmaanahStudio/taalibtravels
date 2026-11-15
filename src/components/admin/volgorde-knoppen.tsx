"use client";

import { useEffect, useRef } from "react";

/** Een nieuwe lijst waarin het element op `van` naar `naar` is geschoven. */
export function verplaats<T>(lijst: readonly T[], van: number, naar: number): T[] {
  const kopie = [...lijst];
  const [element] = kopie.splice(van, 1);
  if (element !== undefined) kopie.splice(naar, 0, element);
  return kopie;
}

type Knop = "terug" | "verder";

const KNOP_STIJL =
  "inline-flex size-9 items-center justify-center rounded-full border border-line text-sm text-heading transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Twee knoppen om een element in een lijst één plek op te schuiven: het
 * toetsenbordalternatief voor slepen.
 *
 * Na het schuiven houdt de focus bij het verschoven element. React verplaatst
 * daarvoor de DOM-knoop, en een verplaatste knoop verliest in sommige browsers
 * zijn focus; vandaar het herstellen na de render. Staat het element daarna
 * aan de rand, dan is die knop uitgeschakeld en gaat de focus naar de andere.
 * Het label noemt de positie, zodat een schermlezer na het schuiven de nieuwe
 * plek voorleest.
 */
export function VolgordeKnoppen({
  index,
  aantal,
  onderwerp,
  onVerplaats,
  horizontaal = false,
}: {
  index: number;
  aantal: number;
  /** Bv. "Alinea" — wordt "Alinea 2 van 5 omhoog". */
  onderwerp: string;
  onVerplaats: (naar: number) => void;
  /** Pijlen naar links/rechts in plaats van omhoog/omlaag, voor een rij foto's. */
  horizontaal?: boolean;
}) {
  const terugRef = useRef<HTMLButtonElement>(null);
  const verderRef = useRef<HTMLButtonElement>(null);
  const focusNa = useRef<Knop | null>(null);

  const kanTerug = index > 0;
  const kanVerder = index < aantal - 1;

  useEffect(() => {
    if (!focusNa.current) return;
    const gewenst = focusNa.current === "terug" ? kanTerug : kanVerder;
    const doel = focusNa.current === "terug" ? terugRef : verderRef;
    const ander = focusNa.current === "terug" ? verderRef : terugRef;
    (gewenst ? doel : ander).current?.focus();
    focusNa.current = null;
  });

  function schuif(knop: Knop) {
    focusNa.current = knop;
    onVerplaats(knop === "terug" ? index - 1 : index + 1);
  }

  const positie = `${onderwerp} ${index + 1} van ${aantal}`;

  return (
    <div className="flex shrink-0 gap-1.5">
      <button
        ref={terugRef}
        type="button"
        onClick={() => schuif("terug")}
        disabled={!kanTerug}
        aria-label={`${positie} ${horizontaal ? "naar voren" : "omhoog"}`}
        className={KNOP_STIJL}
      >
        <span aria-hidden="true">{horizontaal ? "←" : "↑"}</span>
      </button>
      <button
        ref={verderRef}
        type="button"
        onClick={() => schuif("verder")}
        disabled={!kanVerder}
        aria-label={`${positie} ${horizontaal ? "naar achteren" : "omlaag"}`}
        className={KNOP_STIJL}
      >
        <span aria-hidden="true">{horizontaal ? "→" : "↓"}</span>
      </button>
    </div>
  );
}
