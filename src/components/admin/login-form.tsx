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
  const [gebruiker, setGebruiker] = useState("");
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
        body: JSON.stringify({ gebruiker, wachtwoord }),
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

      {/*
        Een gebruikersnaamveld met `autoComplete="username"` boven het
        wachtwoord is wat een wachtwoordmanager nodig heeft om de inlog te
        kunnen opslaan; met alleen een wachtwoordveld lukt hem dat niet.
      */}
      <Field
        naam="gebruiker"
        label="Gebruikersnaam of e-mail"
        type="text"
        autoComplete="username"
        value={gebruiker}
        onChange={(event) => setGebruiker(event.target.value)}
        disabled={bezig}
        autoFocus
      />

      <Field
        naam="wachtwoord"
        label="Wachtwoord"
        type="password"
        autoComplete="current-password"
        value={wachtwoord}
        onChange={(event) => setWachtwoord(event.target.value)}
        // De melding hangt bewust onder het wachtwoord en niet onder het veld
        // dat fout was: de server vertelt niet welke van de twee het betrof, en
        // dat mag dit scherm dan ook niet suggereren.
        fout={melding ?? undefined}
        disabled={bezig}
      />

      <Button
        type="submit"
        size="lg"
        disabled={bezig || gebruiker.length === 0 || wachtwoord.length === 0}
      >
        {bezig ? "Bezig…" : "Inloggen"}
      </Button>
    </form>
  );
}
