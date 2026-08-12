import { INCLUSION_ICONS } from "@/components/ui/icons";
import type { HomeUsp } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Waarom TaalibTravels": vier redenen als kaarten met een icoon.
 *
 * Hergebruikt de `IconKey`-map van de inclusies, zodat er geen tweede
 * icoonregister ontstaat dat uit de pas kan lopen.
 */
export function UspGrid({
  items,
  className,
}: {
  items: HomeUsp[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-5 sm:grid-cols-2", className)}>
      {items.map((item) => {
        const Icon = INCLUSION_ICONS[item.icon];

        return (
          <li
            key={item.title}
            className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-accent/30 hover:bg-surface-strong sm:p-7"
          >
            <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface-strong text-accent">
              <Icon className="size-5" />
            </span>

            <h3 className="font-display text-lg tracking-[0.06em] text-heading uppercase">
              {item.title}
            </h3>

            <p className="text-sm leading-relaxed text-body">{item.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
