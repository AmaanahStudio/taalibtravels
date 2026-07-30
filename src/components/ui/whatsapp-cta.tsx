import type { ReactNode } from "react";

import { WhatsAppIcon } from "@/components/ui/icons";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { cn } from "@/lib/utils";

/**
 * Groot, gecentreerd WhatsApp-blok — de enige manier waarop bezoekers
 * reserveren of een vraag stellen.
 *
 * Wordt zowel onderaan een reispagina gebruikt als op de contactpagina, zodat
 * de belangrijkste actie er overal hetzelfde uitziet.
 */
export function WhatsAppCta({
  eyebrow,
  title,
  description,
  message,
  label = "Reserveer via WhatsApp",
  footnote,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Voorgevuld bericht in WhatsApp. */
  message: string;
  label?: string;
  footnote?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-4xl border border-line bg-surface px-6 py-12 text-center shadow-card sm:px-12 sm:py-14",
        className,
      )}
    >
      {/* Groene gloed achter het icoon, koele gloed rechtsonder voor diepte */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 size-80 -translate-x-1/2 rounded-full bg-whatsapp-500/12 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-32 size-72 rounded-full bg-accent/12 blur-[110px]"
      />

      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-full border border-whatsapp-500/30 bg-whatsapp-500/10 text-whatsapp-500">
          <WhatsAppIcon className="size-8" />
        </span>

        {eyebrow && (
          <span className="text-[0.7rem] font-semibold tracking-[0.28em] text-accent uppercase">
            {eyebrow}
          </span>
        )}

        <h2 className="display-title text-3xl text-heading sm:text-4xl">
          {title}
        </h2>

        {description && (
          <p className="text-base leading-relaxed text-body">{description}</p>
        )}

        <WhatsAppButton label={label} message={message} className="mt-1" />

        {footnote && <p className="text-xs text-muted">{footnote}</p>}
      </div>
    </div>
  );
}
