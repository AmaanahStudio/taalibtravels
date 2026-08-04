import { cn } from "@/lib/utils";
import { SITE } from "@/lib/content";

/**
 * Het aangeleverde logo (public/images/logo.png), inclusief woordmerk.
 *
 * Het wordt als masker getoond via de klasse `.brand-logo` in globals.css.
 * Daardoor neemt het de huidige tekstkleur over: zwart in het lichte thema,
 * gebroken wit in het donkere — zonder dat er een tweede bestand nodig is.
 */
export function Logo({
  className,
  label = SITE.name,
}: {
  className?: string;
  /** Toegankelijke naam. Zet op `null` als er vlakbij al tekst staat. */
  label?: string | null;
}) {
  return (
    <span
      className={cn("brand-logo h-11 text-heading sm:h-12", className)}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
