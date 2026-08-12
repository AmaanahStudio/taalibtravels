import type { HomeStep } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Zo werkt het": een genummerde lijst van vraag tot vertrek.
 *
 * Bewust een `<ol>` en niet een raster van `<div>`'s — de volgorde is de
 * inhoud, en dat hoort in de opmaak te staan, niet alleen in het cijfer ernaast.
 */
export function StepList({
  items,
  className,
}: {
  items: HomeStep[];
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item, index) => (
        <li key={item.title} className="relative flex flex-col gap-3 pt-6">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent to-transparent"
          />

          <span className="font-display text-3xl text-accent tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>

          <h3 className="font-display text-lg tracking-[0.06em] text-heading uppercase">
            {item.title}
          </h3>

          <p className="text-sm leading-relaxed text-body">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}
