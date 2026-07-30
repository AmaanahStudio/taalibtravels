import { Badge } from "@/components/ui/badge";
import { CheckIcon } from "@/components/ui/icons";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import type { Trip } from "@/lib/types";
import { cn, formatAmount } from "@/lib/utils";

/**
 * Prijs groot weergegeven, met de "termijnen mogelijk"-vermelding en een
 * directe WhatsApp-CTA — precies zoals op de poster.
 */
export function PriceBlock({
  trip,
  className,
}: {
  trip: Trip;
  className?: string;
}) {
  const message = `Assalaamu alaykum, ik wil graag een plek reserveren voor "${trip.title}" (${trip.subtitle}).`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface-strong to-transparent p-7 sm:p-10",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-accent/15 blur-[80px]"
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4">
          <span className="text-[0.7rem] font-semibold tracking-[0.28em] text-accent uppercase">
            Totaalprijs
          </span>

          {/* `flex-nowrap` houdt het euroteken op dezelfde regel als het
              bedrag, ook wanneer de kolom smal wordt. */}
          <p className="flex flex-nowrap items-start gap-2">
            <span className="mt-3 font-display text-2xl text-body sm:mt-4 sm:text-3xl">
              €
            </span>
            <span className="display-title text-6xl whitespace-nowrap text-heading sm:text-7xl lg:text-8xl">
              {formatAmount(trip.price.amount)}
            </span>
          </p>

          {trip.price.note && (
            <p className="text-sm text-muted">{trip.price.note}</p>
          )}

          {trip.price.installmentsAvailable && (
            <Badge tone="accent" className="w-fit">
              <CheckIcon className="size-3.5" />
              Betalen in termijnen mogelijk
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <WhatsAppButton
            label="Reserveer je plek"
            message={message}
            className="w-full lg:w-auto"
          />
          <p className="text-xs text-muted lg:text-right">
            Nog {trip.spotsLeft} van {trip.spotsTotal} plaatsen beschikbaar
          </p>
        </div>
      </div>
    </div>
  );
}
