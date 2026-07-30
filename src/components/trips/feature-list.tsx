import { INCLUSION_ICONS } from "@/components/ui/icons";
import type { TripInclusion } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * De "Inclusief?"-lijst van de poster: twee kolommen met een icoon, een
 * uppercase label en een korte toelichting.
 */
export function FeatureList({
  items,
  className,
  columns = 2,
}: {
  items: TripInclusion[];
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <ul
      className={cn(
        "grid gap-x-8 gap-y-3",
        columns === 2 && "sm:grid-cols-2",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = INCLUSION_ICONS[item.icon];

        return (
          <li
            key={item.id}
            className="group relative flex gap-4 rounded-2xl border border-transparent px-4 py-4 transition-colors hover:border-line hover:bg-surface"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent-strong"
            />

            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-accent transition-colors group-hover:border-accent/40 group-hover:text-accent">
              <Icon className="size-5" />
            </span>

            <span className="flex flex-col gap-1 pt-0.5">
              <span className="font-display text-base tracking-[0.06em] text-heading uppercase sm:text-lg">
                {item.label}
              </span>
              {item.description && (
                <span className="text-sm leading-relaxed text-muted">
                  {item.description}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
