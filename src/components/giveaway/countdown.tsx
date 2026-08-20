"use client";

import { useEffect, useState } from "react";

import { cn, formatDateTimeLong } from "@/lib/utils";

/*
 * Een aftelklok kan niet anders dan een client component zijn: de server kent
 * alleen het moment van bouwen, en die pagina wordt statisch gegenereerd.
 * Daarom blijft dit een klein blad — de giveaway-pagina eromheen blijft server.
 *
 * Op de server en bij de eerste render staat er bewust een streepjes-placeholder
 * in plaats van een berekende tijd. Server en browser lezen de klok nooit op
 * exact hetzelfde moment, dus een echte waarde zou daar een hydration-mismatch
 * opleveren. Pas na het monteren begint hij te lopen.
 */

/** Zelfde vorm als de teller, zodat de regel niet verspringt bij de eerste tik. */
const PLACEHOLDER = "--:--:--:--";

/** Twee cijfers, ook onder de tien: "05:23:12:01". */
const pad = (waarde: number) => String(waarde).padStart(2, "0");

/**
 * Resterende tijd als `dagen:uren:minuten:seconden`. Klemt op nul, zodat een
 * verstreken deadline "00:00:00:00" toont en geen negatieve cijfers.
 */
function resterend(deadlineMs: number) {
  const seconden = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));

  const tekst = [
    Math.floor(seconden / 86_400),
    Math.floor(seconden / 3_600) % 24,
    Math.floor(seconden / 60) % 60,
    seconden % 60,
  ]
    .map(pad)
    .join(":");

  return { seconden, tekst };
}

/** Telt per seconde af naar `deadline` (ISO-8601 met tijdzone). */
export function Countdown({
  deadline,
  className,
}: {
  deadline: string;
  className?: string;
}) {
  const [tekst, setTekst] = useState<string | null>(null);

  useEffect(() => {
    const deadlineMs = new Date(deadline).getTime();

    const tik = () => {
      const { seconden, tekst } = resterend(deadlineMs);
      setTekst(tekst);
      return seconden;
    };

    // De deadline kan al voorbij zijn; dan hoeft er niets te lopen.
    if (tik() === 0) return;

    const interval = window.setInterval(() => {
      if (tik() === 0) window.clearInterval(interval);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [deadline]);

  return (
    <p className={cn("flex flex-col gap-1", className)}>
      {/*
        De cijfers veranderen elke seconde. Zonder `aria-hidden` zou een
        schermlezer die stroom voorlezen; de datum eronder zegt in één keer
        hetzelfde, en die blijft dus wél leesbaar.
      */}
      <span
        aria-hidden="true"
        className="text-base font-semibold text-heading tabular-nums"
      >
        {tekst ?? PLACEHOLDER}
      </span>
      <span className="text-sm text-muted">
        {formatDateTimeLong(deadline)}
      </span>
    </p>
  );
}
