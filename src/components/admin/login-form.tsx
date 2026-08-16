"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { API } from "@/lib/api";

/**
 * Inlogscherm van het admin-overzicht.
 *
 * Het wachtwoord gaat één keer naar de Worker en wordt daar in constante tijd
 * vergeleken; wat terugkomt is een `HttpOnly`-cookie die JavaScript niet kan
 * lezen. Er blijft hier dus niets van over — vandaar dat het veld na een
 * geslaagde login gewist wordt.
 */
export function LoginForm({ onIngelogd }: { onIngelogd: () => void }) {
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  async function verstuur(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bezig) return;

    setBezig(true);
    setMelding(null);

    try {
      const antwoord = await fetch(API.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wachtwoord }),
      });

      if (antwoord.ok) {
        setWachtwoord("");
        onIngelogd();
        return;
      }

      const data = (await antwoord.json()) as { melding?: string };
      setMelding(data.melding ?? "Inloggen is niet gelukt.");
    } catch {
      setMelding("Geen verbinding met de server.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <form
      onSubmit={verstuur}
      noValidate
      className="mx-auto flex w-full max-w-sm flex-col gap-5 rounded-4xl border border-line bg-surface px-6 py-8 shadow-card sm:px-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="display-title text-2xl text-heading">Beheer</h1>
        <p className="text-sm leading-relaxed text-muted">
          Log in om de inschrijvingen te bekijken.
        </p>
      </div>

      <Field
        naam="wachtwoord"
        label="Wachtwoord"
        type="password"
        autoComplete="current-password"
        value={wachtwoord}
        onChange={(event) => setWachtwoord(event.target.value)}
        fout={melding ?? undefined}
        disabled={bezig}
        autoFocus
      />

      <Button type="submit" size="lg" disabled={bezig || wachtwoord.length === 0}>
        {bezig ? "Bezig…" : "Inloggen"}
      </Button>
    </form>
  );
}
