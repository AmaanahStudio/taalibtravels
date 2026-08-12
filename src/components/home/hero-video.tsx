"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Videocompilatie in de hero. Speelt automatisch, zonder geluid en in een lus —
 * de audiotrack is er bij het encoderen uitgehaald, dus er valt niets te horen.
 *
 * Het afspelen gebeurt in een effect en niet met het `autoPlay`-attribuut, zodat
 * we `prefers-reduced-motion` kunnen respecteren: wie beweging heeft uitgezet
 * krijgt het poster-frame te zien in plaats van een lus van ruim een minuut.
 *
 * Het starten wacht bewust op een rustig moment. Met `preload="none"` gebeurt
 * er niets tot `play()`, en dat gebeurt pas als de browser klaar is met de
 * belangrijke dingen. Zo vecht een bestand van ruim twee megabyte niet meer met
 * de tekst en de hero-foto om de eerste seconde — precies waar Google de LCP op
 * meet. Het poster-frame staat er ondertussen gewoon.
 *
 * TODO(content): vervang /videos/hero-compilatie.mp4 en /images/hero-poster.jpg
 * zodra er een nieuwe montage is — beide worden gegenereerd door
 * `npm run hero-video`.
 */
export function HeroVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = () => {
      // Autoplay kan geweigerd worden (bv. spaarstand op iOS). Dan blijft het
      // poster-frame gewoon staan.
      void videoRef.current?.play().catch(() => {});
    };

    // `requestIdleCallback` ontbreekt op Safari; daar is een korte timeout de
    // gangbare terugval.
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(start, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = window.setTimeout(start, 1200);
    return () => window.clearTimeout(handle);
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-4xl border border-line bg-sunken shadow-media",
        className,
      )}
    >
      <video
        ref={videoRef}
        className="aspect-[4/5] w-full object-cover"
        poster="/images/hero-poster.jpg"
        preload="none"
        muted
        loop
        playsInline
        aria-label="Beelden van eerdere Umrah-reizen met TaalibTravels"
      >
        <source src="/videos/hero-compilatie.mp4" type="video/mp4" />
      </video>

      {/* Donkere gradient onderaan, zodat de zwevende prijskaart leesbaar blijft */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page via-page/20 to-transparent"
      />
    </div>
  );
}
