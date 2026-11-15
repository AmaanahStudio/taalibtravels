import type { ReisD1 } from "./lib/reizen-db";

/*
 * Vult het `CloudflareEnv` van OpenNext aan met de bindings die de Next-kant
 * gebruikt, zodat `getCloudflareContext().env.DB` getypeerd is zonder cast.
 *
 * Bewust niet het gegenereerde `Env` uit `worker-configuration.d.ts`: dat bestand
 * brengt de workerd-globals mee, en die horen niet naast de DOM in dit programma.
 * `ReisD1` is de structurele vorm die `reizen-db.ts` nodig heeft; het echte
 * `env.DB` past daarop. Komt er een binding bij die de pagina's lezen, zet hem
 * dan hier — en alleen hier.
 */
declare global {
  interface CloudflareEnv {
    DB: ReisD1;
  }
}

export {};
