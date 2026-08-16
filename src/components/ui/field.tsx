import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * De focus-ring komt uit de globale `:focus-visible`-regel in globals.css. Hier
 * dus geen eigen ring: twee ringen over elkaar zien er rommelig uit. Wat deze
 * velden wél doen bij focus is de rand op accent zetten.
 */
const VELD_BASIS =
  "w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-heading transition-colors placeholder:text-muted/60 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60";

type InputEigen = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "name" | "className"
>;

type FieldProps = InputEigen & {
  /** Ook de `name` en het `id` — één naam per veld, geen tweede bron van waarheid. */
  naam: string;
  label: string;
  /** Melding onder het veld; de rand kleurt dan mee. */
  fout?: string;
  /** Zet "optioneel" in het label. Een optioneel veld dat verplicht lijkt, kost inzendingen. */
  optioneel?: boolean;
  className?: string;
};

/** Eén tekstveld: label, invoer en de foutmelding die erbij hoort. */
export function Field({
  naam,
  label,
  fout,
  optioneel,
  className,
  ...props
}: FieldProps) {
  const foutId = `${naam}-fout`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={naam}
        className="flex items-baseline gap-2 text-xs font-semibold tracking-[0.14em] text-heading uppercase"
      >
        {label}
        {optioneel && (
          <span className="text-[0.65rem] font-medium tracking-normal text-muted normal-case">
            optioneel
          </span>
        )}
      </label>

      <input
        id={naam}
        name={naam}
        // `aria-invalid` en `aria-describedby` koppelen de melding aan het veld,
        // zodat een schermlezer hem voorleest zodra de focus er staat.
        aria-invalid={fout ? true : undefined}
        aria-describedby={fout ? foutId : undefined}
        className={cn(VELD_BASIS, fout ? "border-danger" : "border-line")}
        {...props}
      />

      {fout && (
        <p id={foutId} className="text-xs leading-relaxed text-danger">
          {fout}
        </p>
      )}
    </div>
  );
}

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "name" | "className" | "type"
> & {
  naam: string;
  /** Mag opmaak bevatten, bv. een link naar de privacyverklaring. */
  label: ReactNode;
  fout?: string;
  className?: string;
};

/** Vinkje met het label ernaast; het hele blok is aanklikbaar. */
export function Checkbox({
  naam,
  label,
  fout,
  className,
  ...props
}: CheckboxProps) {
  const foutId = `${naam}-fout`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={naam}
        className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-body"
      >
        <input
          id={naam}
          name={naam}
          type="checkbox"
          aria-invalid={fout ? true : undefined}
          aria-describedby={fout ? foutId : undefined}
          // `accent-color` laat de browser zijn eigen vinkje in onze accentkleur
          // tekenen — dat blijft toegankelijker dan een nagebouwd vierkantje.
          className={cn(
            "mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border accent-[var(--color-accent)]",
            fout ? "border-danger" : "border-line-strong",
          )}
          {...props}
        />
        <span>{label}</span>
      </label>

      {fout && (
        <p id={foutId} className="pl-8 text-xs leading-relaxed text-danger">
          {fout}
        </p>
      )}
    </div>
  );
}
