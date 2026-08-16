"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Koppeling met Cloudflare Turnstile — de captcha die controleert dat er een
 * mens achter het formulier zit.
 *
 * Twee dingen die deze hook regelt en die makkelijk misgaan:
 *
 * 1. Het script komt pas binnen wanneer het formulier in beeld komt. Wie de
 *    giveaway-pagina alleen leest, haalt die 60 kB dus nooit op — hetzelfde
 *    uitgangspunt als bij de hero-video.
 * 2. Een token is éénmalig. Na een mislukte inzending moet de widget opnieuw,
 *    anders wordt de tweede poging altijd geweigerd. Vandaar `herstel`.
 */

interface TurnstileOpties {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  theme: "light" | "dark";
  language: string;
}

interface TurnstileApi {
  render: (element: HTMLElement, opties: TurnstileOpties) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/*
 * Op moduleniveau, zodat het script bij een tweede aanroep of bij React's
 * dubbele effect in ontwikkelmodus niet nog eens wordt ingeladen.
 */
let laden: Promise<void> | null = null;

function laadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  laden ??= new Promise<void>((klaar, mislukt) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => klaar();
    script.onerror = () => {
      // De volgende poging mag opnieuw proberen in plaats van vast te zitten
      // op een afgewezen promise.
      laden = null;
      mislukt(new Error("Turnstile kon niet laden."));
    };
    document.head.appendChild(script);
  });

  return laden;
}

export interface Turnstile {
  /** Zet dit op het element waar de widget moet komen. */
  houderRef: React.RefObject<HTMLDivElement | null>;
  /** Leeg zolang er geen geldig token is. */
  token: string;
  /** Het script kwam niet binnen — bv. een adblocker of geen verbinding. */
  mislukt: boolean;
  /** Vraagt een vers token aan na een afgewezen inzending. */
  herstel: () => void;
}

export function useTurnstile(sitekey: string): Turnstile {
  const houderRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [zichtbaar, setZichtbaar] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [mislukt, setMislukt] = useState(false);

  useEffect(() => {
    const houder = houderRef.current;
    if (!houder) return;

    // De marge geeft het script een voorsprong, zodat het token er meestal al
    // is tegen de tijd dat iemand de velden heeft ingevuld.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setZichtbaar(true);
      },
      { rootMargin: "300px" },
    );

    observer.observe(houder);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!zichtbaar) return;

    let afgebroken = false;

    laadScript()
      .then(() => {
        if (!afgebroken) setGeladen(true);
      })
      .catch(() => {
        if (!afgebroken) setMislukt(true);
      });

    return () => {
      afgebroken = true;
    };
  }, [zichtbaar]);

  useEffect(() => {
    const api = window.turnstile;
    const houder = houderRef.current;
    if (!geladen || !api || !houder || widgetRef.current !== null) return;

    /*
     * De site schakelt van thema via `data-theme` op <html>, niet via de
     * voorkeur van het besturingssysteem. Turnstile's "auto" kijkt naar dat
     * laatste en zou dus een lichte widget op een donkere pagina kunnen zetten.
     */
    const donker = document.documentElement.dataset.theme !== "light";

    widgetRef.current = api.render(houder, {
      sitekey,
      callback: setToken,
      "error-callback": () => setToken(""),
      "expired-callback": () => setToken(""),
      theme: donker ? "dark" : "light",
      language: "nl",
    });

    return () => {
      const id = widgetRef.current;
      widgetRef.current = null;
      if (id) api.remove(id);
    };
  }, [geladen, sitekey]);

  const herstel = useCallback(() => {
    const id = widgetRef.current;
    if (!id || !window.turnstile) return;
    window.turnstile.reset(id);
    setToken("");
  }, []);

  return { houderRef, token, mislukt, herstel };
}
