/**
 * Validatie van een inschrijving, gedeeld door het formulier en de Worker.
 *
 * Het formulier gebruikt deze regels om direct te kunnen zeggen wat er mis is;
 * de Worker gebruikt exact dezelfde regels als het echte oordeel. Een bezoeker
 * kan de browsercontrole immers overslaan — die kant is er voor het gemak, niet
 * voor de veiligheid.
 *
 * BELANGRIJK: dit bestand mag geen enkele import hebben. Wrangler bundelt de
 * Worker met esbuild en past de `@/*`-alias uit tsconfig.json daarbij niet toe,
 * dus een alias-import hierin breekt de Worker-build. Houd het zelfstandig.
 */

/** Wat de browser instuurt: alle tekstvelden als string, de vinkjes als boolean. */
export interface LeadInvoer {
  voornaam: string;
  achternaam: string;
  email: string;
  /** Optioneel — een lege string is een geldige invoer. */
  telefoon: string;
  voorwaarden: boolean;
  consent: boolean;
}

/** Wat er na validatie de database in gaat: opgeschoond en genormaliseerd. */
export interface Lead {
  voornaam: string;
  achternaam: string;
  /** Altijd lowercase en getrimd, zodat de unieke index echt uniek is. */
  email: string;
  /** `null` wanneer het veld leeg bleef — nooit een lege string. */
  telefoon: string | null;
  voorwaarden: boolean;
  consent: boolean;
}

export type LeadVeld = keyof LeadInvoer;

/** Per veld hoogstens één melding; ontbreekt een sleutel, dan is dat veld goed. */
export type LeadFouten = Partial<Record<LeadVeld, string>>;

export type LeadResultaat =
  | { ok: true; lead: Lead }
  | { ok: false; fouten: LeadFouten };

/** Beginwaarde voor het formulier, en meteen de volgorde van de velden. */
export const LEEG_FORMULIER: LeadInvoer = {
  voornaam: "",
  achternaam: "",
  email: "",
  telefoon: "",
  voorwaarden: false,
  consent: false,
};

const NAAM_MIN = 2;
const NAAM_MAX = 60;

/** De limiet uit RFC 5321 voor een volledig adres. */
const EMAIL_MAX = 254;

/*
 * Bewust niet de "volledige" RFC-regex: die accepteert adressen die geen enkele
 * mailserver aanneemt en is onleesbaar. Deze variant eist een lokaal deel zonder
 * witruimte of leestekens die in de praktijk niet voorkomen, een domein met
 * minstens één punt, en labels die niet met een streepje beginnen of eindigen.
 */
const EMAIL_PATROON =
  /^[^\s@,;:<>"'()[\]\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/** Opmaaktekens die mensen in een telefoonnummer zetten. */
const TELEFOON_OPMAAK = /[\s.\-()  /]/g;

/*
 * Na het strippen van de opmaak blijft een landcode plus 8 tot 15 cijfers over.
 * Vijftien is het maximum uit E.164; alles daarboven is geen telefoonnummer meer
 * maar een typefout of een bot die het veld volgooit.
 */
const TELEFOON_PATROON = /^\+?[0-9]{8,15}$/;

/** Minstens één letter — zo vallen "123" en "!!!" af zonder echte namen te weren. */
const BEVAT_LETTER = /\p{L}/u;

function leesTekst(waarde: unknown): string {
  return typeof waarde === "string" ? waarde.trim() : "";
}

function controleerNaam(waarde: string, label: string): string | null {
  if (waarde.length === 0) return `Vul je ${label} in.`;
  if (waarde.length < NAAM_MIN) return `Dat lijkt te kort voor een ${label}.`;
  if (waarde.length > NAAM_MAX) return `Maximaal ${NAAM_MAX} tekens.`;
  if (!BEVAT_LETTER.test(waarde)) return `Vul een echte ${label} in.`;
  return null;
}

/** Haalt de opmaak uit een telefoonnummer, zodat elk nummer gelijk opgeslagen wordt. */
export function normaliseerTelefoon(waarde: string): string {
  return waarde.replace(TELEFOON_OPMAAK, "");
}

/**
 * Controleert één veld. Levert `null` bij goedkeuring en anders de melding die
 * de bezoeker te zien krijgt — in het Nederlands, en gericht op wat te doen.
 *
 * Het formulier roept dit aan bij `blur`, zodat je niet pas bij het versturen
 * hoort dat er iets mis is.
 */
export function controleerVeld(veld: LeadVeld, invoer: LeadInvoer): string | null {
  switch (veld) {
    case "voornaam":
      return controleerNaam(invoer.voornaam.trim(), "voornaam");

    case "achternaam":
      return controleerNaam(invoer.achternaam.trim(), "achternaam");

    case "email": {
      const email = invoer.email.trim();
      if (email.length === 0) return "Vul je e-mailadres in.";
      if (email.length > EMAIL_MAX) return "Dit e-mailadres is te lang.";
      if (!EMAIL_PATROON.test(email)) return "Dit e-mailadres klopt niet.";
      return null;
    }

    case "telefoon": {
      // Leeg is geldig: dit veld is optioneel. Alleen wát er staat moet kloppen.
      const telefoon = normaliseerTelefoon(invoer.telefoon.trim());
      if (telefoon.length === 0) return null;
      if (!TELEFOON_PATROON.test(telefoon)) {
        return "Dit telefoonnummer klopt niet. Laat het veld anders leeg.";
      }
      return null;
    }

    case "voorwaarden":
      return invoer.voorwaarden
        ? null
        : "Bevestig dat je aan de voorwaarden hebt voldaan.";

    case "consent":
      return invoer.consent ? null : "Dit vinkje is nodig om mee te doen.";
  }
}

/**
 * Controleert de hele inschrijving en levert bij goedkeuring meteen de
 * opgeschoonde versie op. De Worker schrijft die kopie weg en hoeft dus zelf
 * niets meer te trimmen of om te zetten — één plek die bepaalt hoe een rij eruit
 * ziet, en dus geen kans dat browser en server het anders opslaan.
 *
 * Neemt `unknown` aan, want aan serverzijde komt dit uit een JSON-body die
 * alles kan bevatten.
 */
export function valideerLead(ruw: unknown): LeadResultaat {
  const body = (typeof ruw === "object" && ruw !== null ? ruw : {}) as Record<
    string,
    unknown
  >;

  const invoer: LeadInvoer = {
    voornaam: leesTekst(body.voornaam),
    achternaam: leesTekst(body.achternaam),
    email: leesTekst(body.email),
    telefoon: leesTekst(body.telefoon),
    voorwaarden: body.voorwaarden === true,
    consent: body.consent === true,
  };

  const fouten: LeadFouten = {};

  for (const veld of Object.keys(LEEG_FORMULIER) as LeadVeld[]) {
    const fout = controleerVeld(veld, invoer);
    if (fout) fouten[veld] = fout;
  }

  if (Object.keys(fouten).length > 0) return { ok: false, fouten };

  const telefoon = normaliseerTelefoon(invoer.telefoon);

  return {
    ok: true,
    lead: {
      voornaam: invoer.voornaam,
      achternaam: invoer.achternaam,
      email: invoer.email.toLowerCase(),
      telefoon: telefoon.length > 0 ? telefoon : null,
      voorwaarden: true,
      consent: true,
    },
  };
}
