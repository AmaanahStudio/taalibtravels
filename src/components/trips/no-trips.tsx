import { cn } from "@/lib/utils";

/**
 * Wat een bezoeker ziet als er geen enkele reis gepubliceerd is. Eén component,
 * zodat de homepage en `/reizen` dezelfde belofte doen.
 */
export function NoTrips({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-3xl border border-line bg-surface p-10 text-center text-muted",
        className,
      )}
    >
      Er staan momenteel geen reizen gepland. Stuur ons gerust een bericht —
      we informeren je zodra de nieuwe data bekend zijn.
    </p>
  );
}
