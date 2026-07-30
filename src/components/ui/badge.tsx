import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "muted" | "alert";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line-strong bg-surface-strong text-heading",
  accent: "border-accent/40 bg-accent-soft text-accent",
  muted: "border-line bg-surface-strong text-body",
  alert: "border-accent/50 bg-accent-soft text-accent",
};

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] font-semibold tracking-[0.16em] uppercase sm:text-xs",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
