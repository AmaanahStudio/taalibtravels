"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/*
 * Het thema leeft buiten React: het staat als `data-theme` op <html> en wordt
 * al vóór de eerste paint gezet door een script in de root layout. We lezen die
 * waarde met `useSyncExternalStore` in plaats van hem in een effect naar state
 * te kopiëren — dat laatste veroorzaakt een extra render en is precies wat de
 * react-hooks regels afraden.
 */
let listeners: Array<() => void> = [];

function subscribe(onChange: () => void) {
  listeners = [...listeners, onChange];
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Op de server bestaat er geen DOM; daar geldt de standaard. */
function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode of geblokkeerde storage: de keuze geldt dan enkel nu.
  }
  for (const listener of listeners) listener();
}

/** Wisselt tussen het donkere (standaard) en het lichte uiterlijk. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-label={
        isLight
          ? "Overschakelen naar donker thema"
          : "Overschakelen naar licht thema"
      }
      title={isLight ? "Donker thema" : "Licht thema"}
      className={cn(
        "flex size-11 items-center justify-center rounded-full border border-line bg-surface text-heading transition-colors hover:border-accent/50 hover:bg-surface-strong",
        className,
      )}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      className="size-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
