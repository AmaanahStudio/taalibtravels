import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Vaste maximale breedte + horizontale padding voor de hele site. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/**
 * Verticale ruimte rond een sectie.
 *
 * Kies hier een waarde in plaats van de padding via `className` te overschrijven:
 * de standaard bevat een `lg:`-variant, en die wint in de cascade altijd van een
 * losse `pt-0` of `pb-0` zonder breakpoint. Dat leverde eerder onbedoeld dubbele
 * witruimte op grote schermen op.
 */
type SectionSpacing =
  /** Volledige ruimte boven en onder. */
  | "default"
  /** Sluit aan op de vorige sectie: alleen ruimte onder. */
  | "continue"
  /** Compacte ruimte, bv. wanneer twee blokken bij elkaar horen. */
  | "tight"
  /** Geen ruimte — de aanroeper bepaalt alles zelf via `className`. */
  | "none";

const SPACING: Record<SectionSpacing, string> = {
  default: "py-16 sm:py-20 lg:py-28",
  continue: "pb-16 sm:pb-20 lg:pb-28",
  tight: "py-10 sm:py-12",
  none: "",
};

/** Sectie-wrapper met consistente verticale ritmiek. */
export function Section({
  children,
  className,
  id,
  spacing = "default",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  spacing?: SectionSpacing;
  as?: ElementType;
}) {
  return (
    <Tag id={id} className={cn("scroll-mt-24", SPACING[spacing], className)}>
      <Container>{children}</Container>
    </Tag>
  );
}

/**
 * Kop in de stijl van de poster: een klein blauw label, daaronder een grote
 * uppercase display-kop en optioneel een korte intro.
 */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  className,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  className?: string;
  /** Zet op "h1" wanneer dit de hoofdkop van de pagina is. */
  as?: "h1" | "h2" | "h3";
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        centered && "items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <span className="flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.28em] text-accent uppercase">
          <span
            aria-hidden="true"
            className="h-px w-8 bg-gradient-to-r from-accent-strong to-accent"
          />
          {eyebrow}
        </span>
      )}

      <Heading className="display-title text-4xl text-heading sm:text-5xl lg:text-6xl">
        {title}
      </Heading>

      {intro && (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed text-body sm:text-lg",
            centered && "mx-auto",
          )}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
