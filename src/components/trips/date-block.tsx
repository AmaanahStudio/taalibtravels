import { PlaneIcon } from "@/components/ui/icons";
import { cn, nightsBetween, splitDate } from "@/lib/utils";

function DateCard({ iso, label }: { iso: string; label: string }) {
  const { day, month, year } = splitDate(iso);

  return (
    <div className="relative flex-1 overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <span className="text-[0.7rem] font-semibold tracking-[0.24em] text-accent uppercase">
        {label}
      </span>

      <div className="mt-5 flex items-end gap-3">
        <span className="display-title text-6xl text-heading sm:text-7xl">
          {day}
        </span>
        <span className="flex flex-col pb-1.5 leading-tight">
          <span className="font-display text-2xl tracking-wide text-body uppercase sm:text-3xl">
            {month}
          </span>
          <span className="text-sm text-muted">{year}</span>
        </span>
      </div>
    </div>
  );
}

/** Vertrek- en terugkomstdatum groot naast elkaar, met het aantal nachten ertussen. */
export function DateBlock({
  departureDate,
  returnDate,
  className,
}: {
  departureDate: string;
  returnDate: string;
  className?: string;
}) {
  const nights = nightsBetween(departureDate, returnDate);

  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <DateCard iso={departureDate} label="Vertrek" />

      <div
        className="flex shrink-0 items-center justify-center gap-3 sm:flex-col sm:gap-2"
        aria-hidden="true"
      >
        <span className="h-px w-10 bg-gradient-to-r from-transparent via-accent/60 to-transparent sm:h-10 sm:w-px sm:bg-gradient-to-b" />
        <span className="flex size-11 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
          <PlaneIcon className="size-5" />
        </span>
        <span className="h-px w-10 bg-gradient-to-r from-transparent via-accent/60 to-transparent sm:h-10 sm:w-px sm:bg-gradient-to-b" />
      </div>

      <DateCard iso={returnDate} label="Terugkomst" />

      <span className="sr-only">{nights} nachten</span>
    </div>
  );
}

/** Compacte variant voor in een card of hero-balk. */
export function DateRange({
  departureDate,
  returnDate,
  className,
}: {
  departureDate: string;
  returnDate: string;
  className?: string;
}) {
  const from = splitDate(departureDate);
  const to = splitDate(returnDate);
  const nights = nightsBetween(departureDate, returnDate);

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className="font-semibold text-heading">
        {from.day} {from.month} — {to.day} {to.month} {to.year}
      </span>
      <span className="text-muted">·</span>
      <span className="text-muted">{nights} nachten</span>
    </span>
  );
}
