import Image from "next/image";
import Link from "next/link";

import { DateRange } from "@/components/trips/date-block";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { Trip } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

/** Card voor het reisoverzicht: cover, datum, korte beschrijving en prijs. */
export function TripCard({
  trip,
  className,
  priority = false,
}: {
  trip: Trip;
  className?: string;
  /** Zet `priority` op de eerste card zodat de cover niet lazy laadt. */
  priority?: boolean;
}) {
  const almostFull = trip.spotsLeft <= 5;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-all duration-300 hover:border-accent/30 hover:bg-surface-strong",
        className,
      )}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-sunken">
        <Image
          src={trip.coverImage.src}
          alt={trip.coverImage.alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 384px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {(trip.status === "sold-out" || almostFull) && (
          <div className="absolute inset-x-4 top-4 flex flex-wrap gap-2">
            {trip.status === "sold-out" ? (
              <Badge tone="alert">Volzet</Badge>
            ) : (
              <Badge tone="alert">Nog {trip.spotsLeft} plekken</Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-7">
        <div className="flex flex-col gap-2">
          <h3 className="display-title text-3xl text-heading sm:text-4xl">
            {trip.title}
          </h3>
          <DateRange
            departureDate={trip.departureDate}
            returnDate={trip.returnDate}
          />
        </div>

        <p className="flex-1 text-sm leading-relaxed text-muted">
          {trip.summary}
        </p>

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-5 border-t border-line pt-5">
          <div className="flex flex-col">
            <span className="text-[0.65rem] font-semibold tracking-[0.22em] text-accent uppercase">
              Vanaf
            </span>
            {/* `whitespace-nowrap` houdt het euroteken bij het bedrag, ook in
                een smalle kolom. */}
            <span className="font-display text-2xl whitespace-nowrap text-heading sm:text-3xl">
              {formatPrice(trip.price.amount)}
            </span>
            {trip.price.installmentsAvailable && (
              <span className="text-xs text-muted">Termijnen mogelijk</span>
            )}
          </div>

          {/* De hele card is klikbaar dankzij de stretched link hieronder. */}
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-heading transition-all group-hover:border-accent/60 group-hover:bg-accent/10 group-hover:text-accent">
            Bekijk details
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>

      <Link
        href={`/reizen/${trip.slug}`}
        className="absolute inset-0 rounded-3xl"
      >
        <span className="sr-only">Bekijk details van {trip.title}</span>
      </Link>
    </article>
  );
}
