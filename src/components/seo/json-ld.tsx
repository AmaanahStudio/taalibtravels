import type { JsonLdNode } from "@/lib/schema";

/**
 * Zet een JSON-LD-blok in de pagina.
 *
 * De `<` wordt vervangen door zijn unicode-notatie. `JSON.stringify` ontsnapt
 * die zelf niet, dus een `</script>` in een tekstveld zou het script-blok
 * anders vroegtijdig sluiten en de rest als HTML laten uitvoeren. Dat is de
 * afscherming die de Next-documentatie voorschrijft (`docs/01-app/02-guides/json-ld.md`).
 *
 * Een gewone `<script>` en niet `next/script`: dit is data, geen code die
 * uitgevoerd of ingepland hoeft te worden.
 */
export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
