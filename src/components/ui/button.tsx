import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "whatsapp" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

// `whitespace-nowrap`: een knoplabel over twee regels laten breken ziet er
// altijd verkeerd uit — de knop hoort mee te groeien met zijn tekst.
const BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-full font-semibold tracking-wide whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-btn text-on-btn shadow-btn hover:opacity-90 active:scale-[0.98]",
  whatsapp:
    "bg-whatsapp-500 text-on-whatsapp shadow-whatsapp hover:bg-whatsapp-400 active:scale-[0.98]",
  outline:
    "border border-line-strong bg-surface text-heading hover:border-accent/60 hover:bg-surface-strong active:scale-[0.98]",
  ghost: "text-body hover:bg-surface-strong hover:text-heading",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs sm:text-sm",
  md: "px-5 py-2.5 text-sm sm:px-6 sm:py-3",
  lg: "px-6 py-3.5 text-sm sm:px-8 sm:py-4 sm:text-base",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

export type ButtonProps = ButtonAsLink | ButtonAsButton;

/**
 * Rendert een `<button>`, of een `<Link>` / `<a>` zodra er een `href` is.
 * Externe links (http, mailto, tel) omzeilen de client-side router.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (typeof props.href === "string") {
    const { href, ...rest } = props as ButtonAsLink;
    const isExternal = /^(https?:|mailto:|tel:)/.test(href);

    if (isExternal) {
      return (
        <a
          href={href}
          className={classes}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          {...rest}
        >
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...rest } = props as ButtonAsButton;

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
