import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

import { leesGalerij, leesReis, leesReizen } from "@/lib/reizen-db";
import type { ImageAsset, Trip } from "@/lib/types";

/**
 * De reizen en foto's voor de publieke pagina's, per verzoek uit D1.
 *
 * Een wijziging in het beheer staat daardoor bij de volgende paginalading live,
 * zonder build. Elke pagina die deze functies aanroept moet dus
 * `dynamic = "force-dynamic"` zijn: zonder incrementele cache houdt een vooraf
 * gerenderde pagina zijn inhoud tot de volgende deploy.
 *
 * `server-only` breekt de build zodra een client component dit bestand
 * (in)direct importeert; de D1-code hoort nooit in de browserbundel.
 *
 * `cache` ontdubbelt binnen één verzoek: de homepage vraagt de lijst voor de hero
 * én voor de kaarten, en een detailpagina haalt dezelfde reis op voor de metadata
 * én voor de pagina. Zo blijft dat één query in plaats van twee.
 */

/** De database van dit verzoek; het type komt uit `cloudflare-env.d.ts`. */
function db() {
  return getCloudflareContext().env.DB;
}

/**
 * De gedeelde galerij van de homepage; kan minder dan zes foto's tellen.
 * Ook de reizen zonder eigen galerij lezen hem hierlangs, zodat één verzoek
 * hem hooguit één keer ophaalt.
 */
export const getGallery = cache(async (): Promise<ImageAsset[]> => leesGalerij(db()));

/** Alle publiek zichtbare reizen, op vertrekdatum. */
export const getTrips = cache(
  async (): Promise<Trip[]> => leesReizen(db(), { leesGedeeldeGalerij: getGallery }),
);

/** Eén reis op basis van de slug uit de URL; `null` bij een onbekende slug of een concept. */
export const getTripBySlug = cache(
  async (slug: string): Promise<Trip | null> =>
    leesReis(db(), slug, { leesGedeeldeGalerij: getGallery }),
);

/**
 * De reis die de homepage uitlicht: de eerstvolgende die nog niet voorbij is.
 * Zijn ze allemaal geweest, dan blijft de laatste staan — een verlopen datum is
 * minder erg dan een lege hero. `null` alleen als er geen enkele reis is.
 */
export async function getNextTrip(): Promise<Trip | null> {
  const trips = await getTrips();
  const today = new Date().toISOString().slice(0, 10);

  return trips.find((trip) => trip.returnDate >= today) ?? trips.at(-1) ?? null;
}
