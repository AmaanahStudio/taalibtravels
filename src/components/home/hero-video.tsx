"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Videocompilatie in de hero. Speelt automatisch, zonder geluid en in een lus —
 * de audiotrack is er bij het encoderen uitgehaald, dus er valt niets te horen.
 *
 * De bron wordt bewust pas gerenderd zodra we besloten hebben te laden. Zolang
 * `<video>` geen `<source>` heeft, toont de browser alleen het poster-frame en
 * haalt hij geen byte van de compilatie op. Dat scheelt op de eerste weergave
 * ruim 2 MB, want de video is met afstand het zwaarste onderdeel van de pagina
 * en staat op mobiel onder de tekstkolom — decoratief, niet wat de bezoeker
 * eerst wil zien.
 *
 * `preload="none"` alleen zou niet volstaan: Cloudflare beantwoordt een
 * `Range`-request met het hele bestand, dus zodra er een bron staat komt de
 * volledige compilatie binnen. Vandaar dat de bron zelf wacht.
 *
 * TODO(content): vervang /videos/hero-compilatie.mp4 en /images/hero-poster.jpg
 * zodra er een nieuwe montage is — die twee maakt `npm run hero-video`. Draai
 * daarna `npm run hero-video:web`, want dat leidt de WebM en het WebP-poster
 * die hieronder staan uit die bestanden af.
 */
export function HeroVideo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Wie beweging heeft uitgezet krijgt het poster-frame in plaats van een lus
    // van ruim een halve minuut — en dus ook de download niet.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Op een trage of gelimiteerde verbinding weegt een decoratieve video niet
    // op tegen de kosten. `connection` bestaat niet in elke browser; ontbreekt
    // het, dan gaan we gewoon door.
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;

    if (
      connection?.saveData === true ||
      (connection?.effectiveType !== undefined &&
        connection.effectiveType !== "4g")
    ) {
      return;
    }

    // Pas laden wanneer de video in de buurt van het scherm komt. De marge geeft
    // de download een voorsprong, zodat er bij het scrollen al beeld staat.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setShouldLoad(true);
      },
      { rootMargin: "200px" },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Zodra de bron staat moet het afspelen expliciet starten: `autoPlay` zou al
  // bij de eerste render tellen, en dan is er nog geen bron. Autoplay kan
  // geweigerd worden (bv. spaarstand op iOS); dan blijft het poster staan.
  useEffect(() => {
    if (!shouldLoad) return;
    const video = videoRef.current;
    if (!video) return;

    video.load();
    void video.play().catch(() => {});
  }, [shouldLoad]);

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
        poster="/images/hero-poster.webp"
        preload="none"
        muted
        loop
        playsInline
        aria-label="Beelden van eerdere Umrah-reizen met TaalibTravels"
      >
        {shouldLoad && (
          <>
            {/* WebM staat vooraan: ruim de helft kleiner dan de MP4 bij
                gelijke kwaliteit. Safari valt terug op de MP4. */}
            <source src="/videos/hero-compilatie.webm" type="video/webm" />
            <source src="/videos/hero-compilatie.mp4" type="video/mp4" />
          </>
        )}
      </video>

      {/* Donkere gradient onderaan, zodat de zwevende prijskaart leesbaar blijft */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-page via-page/20 to-transparent"
      />
    </div>
  );
}
