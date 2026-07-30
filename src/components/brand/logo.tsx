import { cn } from "@/lib/utils";
import { SITE } from "@/lib/content";

/**
 * Het TaalibTravels-beeldmerk: een minaret links, een hoekige koepelvorm
 * rechts, en een crescent-swoosh die eronderdoor loopt en rechtsboven eindigt
 * in een vliegtuig.
 *
 * Nagetekend als SVG in plaats van het aangeleverde PNG in te laden: zo is het
 * logo scherp op elk formaat, heeft het geen eigen achtergrond en volgt het
 * automatisch de tekstkleur — dus ook in het lichte thema.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 116"
      fill="currentColor"
      className={cn("size-10", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* Minaret: spits, koepeltje, balkon en schacht */}
      <path d="M30.6 26.1c0-2.6 2.4-4.2 3.7-7.3 1.3 3.1 3.7 4.7 3.7 7.3 0 2.2-1.6 3.8-3.7 3.8s-3.7-1.6-3.7-3.8Z" />
      <path d="M31.4 31.9h5.8c.6 0 1.1.5 1.1 1.1v1.6c0 .6-.5 1.1-1.1 1.1h-5.8c-.6 0-1.1-.5-1.1-1.1v-1.6c0-.6.5-1.1 1.1-1.1Z" />
      <path d="M28.2 43.6c0-3.2 2-6 5-7.2h2.2c3 1.2 5 4 5 7.2 0 .8-.6 1.4-1.4 1.4H29.6c-.8 0-1.4-.6-1.4-1.4Z" />
      <path d="M29.4 47.9h10c.6 0 1.1.5 1.1 1.1v2c0 .6-.5 1.1-1.1 1.1h-.7v40.5h-8.6V52.1h-.7c-.6 0-1.1-.5-1.1-1.1v-2c0-.6.5-1.1 1.1-1.1Z" />

      {/* Koepelvorm: hoekige buitenboog met een open kern */}
      <path d="M72.9 30.4c.9-.8 2.3-.8 3.2 0l25.6 21.7c.5.4.8 1 .8 1.7v10.4c0 1.9-2.2 2.8-3.5 1.6L74.5 44.2 50 65.8c-1.3 1.2-3.5.3-3.5-1.6V53.8c0-.7.3-1.3.8-1.7l25.6-21.7Z" />
      <path d="M72.9 57c.9-.8 2.3-.8 3.2 0l20.5 17.4c.5.4.8 1 .8 1.7v16.5H85.1V80.5c0-.6-.3-1.2-.8-1.6l-7.2-6.1c-.9-.8-2.3-.8-3.2 0l-7.2 6.1c-.5.4-.8 1-.8 1.6v12.1H52.4V76.1c0-.7.3-1.3.8-1.7L72.9 57Z" />

      {/* Crescent-swoosh die onder het gebouw doorloopt */}
      <path d="M119.9 40.4c.7-.2 1.3.5 1 1.1-5.4 12.8-14.6 23.8-26.4 31.4-13.8 8.9-30.4 12.4-46.6 9.8-8.9-1.4-17.4-4.5-25.1-9.2-.8-.5-.2-1.7.7-1.4 8.4 3.1 17.3 4.6 26.2 4.3 15.2-.5 29.9-6.2 41.5-16 8.6-7.2 15.3-16.4 19.5-26.8.2-.5.7-.8 1.2-.6l7.5 2.6c-.2 1.6-.5 3.2-.9 4.8h1.4Z" />

      {/* Vliegtuig aan het uiteinde van de swoosh */}
      <path d="M98.8 21.4c.3-.4.9-.5 1.3-.2l17.3 12.1c.6.4.5 1.4-.2 1.7l-19 8.3c-.5.2-1.1-.1-1.2-.7l-1.1-9.1c0-.4.2-.8.6-.9l5.4-2.2-4.5-2.9c-.4-.3-.5-.8-.3-1.2l1.7-4.9Z" />
    </svg>
  );
}

/** Logo met woordmerk. `compact` laat het woordmerk weg (bv. in de mobiele nav). */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5 text-heading", className)}>
      <LogoMark className="size-9 shrink-0 sm:size-10" />
      {!compact && (
        <span className="font-display text-lg tracking-[0.22em] uppercase sm:text-xl">
          {SITE.name}
        </span>
      )}
    </span>
  );
}
