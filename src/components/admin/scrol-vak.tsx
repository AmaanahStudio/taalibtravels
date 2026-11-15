"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Een raster dat hoogstens twee rijen tegelijk toont en daarna scrolt.
 *
 * "Twee rijen" is alleen echt als de rijhoogte vastligt: `grid-auto-rows` zet elke
 * rij op `rijHoogte`, en de maximale hoogte van het vak is twee rijen plus de
 * tussenruimte, de binnenmarge en de rand. De tegels vullen hun rij (`h-full`).
 *
 * De naam komt van een kop die al op de pagina staat (`labelId`), niet van een
 * eigen `aria-label`: de omringende sectie of groep is al een landmark met die
 * naam. Dit vak is daarom een `group` en geen tweede `region` met dezelfde naam.
 * `tabIndex={0}` maakt het met het toetsenbord scrolbaar; de focusring komt uit de
 * globale `:focus-visible`-regel.
 */
const RIJEN = 2;
const RAND_PX = 2;

export function ScrolVak({
  rijHoogte,
  labelId,
  kolommen,
  children,
}: {
  /** CSS-lengte van één rij, bv. "18rem". */
  rijHoogte: string;
  /** Id van het element dat dit vak een naam geeft. */
  labelId: string;
  /** Tailwind-klassen voor het aantal kolommen. */
  kolommen: string;
  children: ReactNode;
}) {
  const vakRef = useRef<HTMLDivElement>(null);
  const [meer, setMeer] = useState(false);
  const hintId = `${labelId}-scrolhint`;

  // Alleen een hint als er iets onder de rand valt; onderaan is er niets meer.
  useEffect(() => {
    const vak = vakRef.current;
    if (!vak) return;
    const meet = () => setMeer(vak.scrollHeight - vak.clientHeight - vak.scrollTop > 2);
    const waarnemer = new ResizeObserver(meet);
    waarnemer.observe(vak);
    if (vak.firstElementChild) waarnemer.observe(vak.firstElementChild);
    vak.addEventListener("scroll", meet, { passive: true });
    return () => {
      waarnemer.disconnect();
      vak.removeEventListener("scroll", meet);
    };
  }, []);

  const stijl = {
    "--rij": rijHoogte,
    "--tussen": "0.75rem",
    maxHeight: `calc(${RIJEN} * var(--rij) + (${RIJEN} - 1) * var(--tussen) + 2 * var(--tussen) + ${RAND_PX}px)`,
    scrollPaddingBlock: "var(--tussen)",
  } as CSSProperties;

  return (
    <div className="relative">
      <div
        ref={vakRef}
        role="group"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-describedby={meer ? hintId : undefined}
        style={stijl}
        className="snap-y snap-proximity overflow-y-auto overscroll-contain rounded-2xl border border-line bg-sunken p-3"
      >
        <ul
          className={cn("grid auto-rows-[var(--rij)] gap-3 *:snap-start *:h-full", kolommen)}
        >
          {children}
        </ul>
      </div>
      <span id={hintId} className="sr-only">
        Scrol voor meer foto&apos;s.
      </span>
      {meer && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-px bottom-px flex h-12 items-end justify-center rounded-b-2xl bg-linear-to-t from-sunken to-transparent pb-1.5"
        >
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-muted shadow-card">
            Scrol voor meer
          </span>
        </div>
      )}
    </div>
  );
}
