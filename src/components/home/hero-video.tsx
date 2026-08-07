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
 * TODO(content): vervang /videos/hero-compilatie.mp4 en /images/hero-poster.jpg
 * zodra er een nieuwe montage is — beide worden gegenereerd door
 * `npm run hero-video`.
 */
export function HeroVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Autoplay kan geweigerd worden (bv. spaarstand op iOS). Dan blijft het
    // poster-frame gewoon staan.
    void video.play().catch(() => {});
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
        preload="metadata"
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
