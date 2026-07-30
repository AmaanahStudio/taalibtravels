/**
 * Decoratieve achtergrondlaag voor de hele site: de paginakleur met twee zachte
 * gloeden in de accentkleur (ijsblauw in dark, goud in light). Staat vast achter
 * de content (`fixed`) zodat het scrollen rustig aanvoelt.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-page"
    >
      {/* Accentgloed rechtsboven, in de hoek van de hero */}
      <div className="absolute -top-40 -right-32 size-[42rem] rounded-full bg-accent/18 blur-[140px]" />

      {/* Tweede, diepere gloed links en iets lager */}
      <div className="absolute top-1/4 -left-40 size-[34rem] rounded-full bg-accent-strong/14 blur-[130px]" />

      {/* Val terug naar de paginakleur onderaan */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-page to-transparent" />

      {/* Zeer subtiel raster voor textuur. De lijnkleur volgt het thema. */}
      <div
        className="absolute inset-0 text-line-strong opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
    </div>
  );
}
