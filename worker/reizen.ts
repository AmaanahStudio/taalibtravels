/**
 * Beheer-API voor reizen: `/api/admin/reizen` en `/api/admin/reizen/:slug`.
 *
 * Wordt alleen aangeroepen vanachter de sessiepoort in `index.ts`; hier komt dus
 * nooit een verzoek zonder geldige sessie binnen. `valideerReis` oordeelt over de
 * inhoud, `reizen-db.ts` over wat alleen de database weet (bestaat de slug, de foto).
 */

import { API, type ReisAntwoord, type ReisRecord, type ReizenAntwoord } from "../src/lib/api";
import { valideerReis, type ReisFouten } from "../src/lib/reizen";
import {
  leesReisRecord,
  leesReisRecords,
  ReisSchrijfFout,
  schrijfReis,
  verwijderReis,
} from "../src/lib/reizen-db";
import { json, leesJson, methodeNietToegestaan, vanEigenOriginStrikt } from "./http";

const LIJST_METHODEN = "GET, POST";
const REIS_METHODEN = "GET, PUT, DELETE";

export async function routeerReizen(request: Request, url: URL, env: Env): Promise<Response> {
  const methode = request.method;

  if (methode !== "GET" && !vanEigenOriginStrikt(request, url)) {
    return json({ ok: false, melding: "Ongeldig verzoek." }, 403);
  }

  if (url.pathname === API.reizen) {
    if (methode === "GET") return lijst(env);
    if (methode === "POST") return opslaan(request, env, null);
    return methodeNietToegestaan(LIJST_METHODEN);
  }

  const slug = slugUitPad(url.pathname);
  if (slug === null) return json({ ok: false, melding: "Onbekende route." }, 404);

  if (methode === "GET") return een(env, slug);
  if (methode === "PUT") return opslaan(request, env, slug);
  if (methode === "DELETE") return verwijder(env, slug);
  return methodeNietToegestaan(REIS_METHODEN);
}

async function lijst(env: Env): Promise<Response> {
  const antwoord: ReizenAntwoord = { reizen: await leesReisRecords(env.DB) };
  return json(antwoord);
}

async function een(env: Env, slug: string): Promise<Response> {
  const reis = await leesReisRecord(env.DB, slug);
  if (!reis) return nietGevonden();
  const antwoord: ReisAntwoord = { ok: true, reis };
  return json(antwoord);
}

/** Aanmaken (`padSlug === null`) of bijwerken van de reis onder `padSlug`. */
async function opslaan(request: Request, env: Env, padSlug: string | null): Promise<Response> {
  const body = await leesJson(request);
  if (!body) return json({ ok: false, melding: "Ongeldig verzoek." }, 400);

  const resultaat = valideerReis(body);
  const fouten: ReisFouten = resultaat.ok ? {} : { ...resultaat.fouten };

  // De slug is de URL van de reis; hem via de body wijzigen zou bestaande links breken.
  if (padSlug !== null) {
    const bodySlug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (bodySlug !== padSlug) fouten.slug = "De slug van een bestaande reis kan niet wijzigen.";
  }

  if (!resultaat.ok || Object.keys(fouten).length > 0) {
    return veldFouten(fouten);
  }

  const nu = new Date().toISOString();
  try {
    await schrijfReis(env.DB, resultaat.reis, nu, padSlug === null ? "aanmaken" : "bijwerken");
  } catch (fout) {
    if (!(fout instanceof ReisSchrijfFout)) throw fout;
    const antwoord: ReisAntwoord = {
      ok: false,
      melding: fout.message,
      ...(fout.fouten ? { fouten: fout.fouten } : {}),
    };
    return json(antwoord, fout.status);
  }

  const reis: ReisRecord = { ...resultaat.reis, updatedAt: nu };
  const antwoord: ReisAntwoord = { ok: true, reis };
  return json(antwoord);
}

async function verwijder(env: Env, slug: string): Promise<Response> {
  if (!(await verwijderReis(env.DB, slug))) return nietGevonden();
  return json({ ok: true });
}

/**
 * De slug uit `/api/admin/reizen/<slug>`, of `null` bij een ander pad (extra
 * segmenten, lege slug, kapotte procentcodering).
 */
function slugUitPad(pathname: string): string | null {
  const rest = pathname.slice(`${API.reizen}/`.length);
  if (!pathname.startsWith(`${API.reizen}/`) || rest === "" || rest.includes("/")) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
}

function veldFouten(fouten: ReisFouten): Response {
  const antwoord: ReisAntwoord = { ok: false, melding: "Controleer de gemarkeerde velden.", fouten };
  return json(antwoord, 400);
}

function nietGevonden(): Response {
  const antwoord: ReisAntwoord = { ok: false, melding: "Deze reis bestaat niet." };
  return json(antwoord, 404);
}
