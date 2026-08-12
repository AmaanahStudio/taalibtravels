# SEO

Wat er in de code geregeld is, en — belangrijker — wat er buiten de code nog
moet gebeuren. Op competitieve termen als "umrah reis" bepalen een
Google-bedrijfsprofiel, echte reviews en links van andere sites minstens
evenveel als alles hieronder. Techniek is de voorwaarde, geen garantie.

## Wat er nu in de code zit

| Onderdeel | Waar |
| --- | --- |
| Titels, beschrijvingen, canonicals, OpenGraph, Twitter-cards | [src/lib/seo.ts](src/lib/seo.ts) — elke pagina gaat hierlangs |
| Gestructureerde data (JSON-LD) | [src/lib/schema.ts](src/lib/schema.ts) + [json-ld.tsx](src/components/seo/json-ld.tsx) |
| Sitemap met wijzigingsdatums en foto's | [src/app/sitemap.ts](src/app/sitemap.ts) |
| robots.txt | [src/app/robots.ts](src/app/robots.ts) |
| Grote miniatuur in de zoekresultaten (`max-image-preview`) | [src/app/layout.tsx](src/app/layout.tsx) |
| Responsieve WebP-foto's | [scripts/optimize-images.mjs](scripts/optimize-images.mjs) + [image-variants.ts](src/lib/image-variants.ts) |
| Beveiligings- en cache-headers | [public/_headers](public/_headers) |

Schema per route: `TravelAgency` en `WebSite` op elke pagina, `BreadcrumbList`
op alles onder de homepage, `Product` + `TouristTrip` + `Offer` per reis,
`ItemList` op `/reizen`, `FAQPage` op `/veelgestelde-vragen`, `Article` op
`/umrah` en `/over-ons`, `VideoObject` op de homepage.

## Nog in te vullen in de code

Deze twee velden staan leeg in [src/data/site.json](src/data/site.json) en
worden bewust weggelaten uit de uitvoer zolang dat zo is:

- **`address`** — straat, postcode en gemeente. Zolang een van de drie leeg is,
  laat `schema.ts` het adres volledig weg: een half adres maakt de vermelding
  onbetrouwbaar in plaats van onvolledig. Vul dit in vóór je een
  Google-bedrijfsprofiel aanmaakt, zodat de gegevens op beide plekken exact
  gelijk zijn.
- **`verification.google`** — het token uit Google Search Console (zie hieronder).

## Wat je zelf moet doen

### 1. Google Search Console — als eerste

1. Ga naar [search.google.com/search-console](https://search.google.com/search-console)
   en voeg `taalibtravels.com` toe als **domeinproperty** (via DNS, dan tellen
   www en niet-www samen mee).
2. Lukt DNS niet? Kies de URL-prefix-methode, kopieer het HTML-tag-token en zet
   het in `site.json` onder `verification.google`. Daarna opnieuw deployen.
3. Dien de sitemap in: `https://www.taalibtravels.com/sitemap.xml`.
4. Vraag via "URL-inspectie" indexering aan voor de homepage, `/reizen`,
   `/umrah`, `/over-ons` en `/veelgestelde-vragen`. Zonder dat duurt het weken
   voor Google de nieuwe pagina's uit zichzelf oppikt.

### 2. Google Bedrijfsprofiel — de grootste hefboom

Voor zoekopdrachten met een plaatsnaam of met lokale intentie ("umrah reis
Antwerpen", "umrah reisbureau in de buurt") is dit belangrijker dan alle
techniek in deze repo samen. Maak een profiel aan op
[business.google.com](https://business.google.com):

- Naam, adres en telefoonnummer **exact** zoals in `site.json`. Verschillen
  tussen bronnen kosten vertrouwen.
- Categorie: reisbureau / reisorganisatie.
- Foto's toevoegen — dezelfde als op de site mag.
- De website koppelen aan `https://www.taalibtravels.com`.

### 3. Reviews

Vraag deelnemers na afloop van een reis om een review op het bedrijfsprofiel.
Dat is de belangrijkste bron van sterretjes én van vertrouwen bij een reis die
vooruit betaald wordt.

Zodra er echte reviews zijn, kan er `AggregateRating` aan het schema in
`schema.ts` toegevoegd worden. **Niet eerder.** Verzonnen beoordelingen leveren
een handmatige sanctie op van Google, en die kost meer dan hij ooit oplevert.

### 4. Bing Webmaster Tools

[bing.com/webmasters](https://www.bing.com/webmasters) — je kunt de gegevens
rechtstreeks uit Search Console importeren. Bing voedt ook ChatGPT-zoekopdrachten,
en dat kanaal groeit.

### 5. Links en vermeldingen

Google weegt wie er naar je verwijst. Realistische bronnen voor deze site:

- De link in de Instagram-bio naar `taalibtravels.com` (staat die er al?).
- Moskeeën en islamitische verenigingen waarmee jullie samenwerken.
- Belgische en Nederlandse bedrijvengidsen.
- Deelnemers die hun reis delen en de site vermelden.

### 6. Bijhouden

- Voeg elke nieuwe reis toe als eigen bestand onder `src/data/trips/` — elke
  reis is een eigen URL en dus een eigen ingang.
- `/umrah` is de pagina die informatieve zoekvraag opvangt. Groeit die uit, dan
  is een aparte gidssectie (`/umrah/visum`, `/umrah/checklist`) de logische
  volgende stap.
- Werk `updatedAt` bij in de JSON wanneer je een tekstpagina of reis inhoudelijk
  wijzigt; dat vult `lastmod` in de sitemap.
- De homepage-hero pakt de eerstvolgende reis die nog niet terug is. Dat wordt
  bij de build bepaald, dus **een verlopen reis schuift pas op na een redeploy.**

## Controleren of het werkt

```bash
npm run build

# Structured data aanwezig op elke pagina
grep -o 'application/ld+json' out/index.html | wc -l

# Deelafbeelding en eigen titel per pagina
grep -o 'og:image" content="[^"]*"' out/reizen.html out/contact.html
grep -o 'twitter:title" content="[^"]*"' out/reizen.html

# Responsieve foto's
grep -o 'srcSet="[^"]*"' out/index.html | head -1
```

Daarnaast met de hand:

- [Rich Results Test](https://search.google.com/test/rich-results) op een
  reispagina — er hoort een geldig product-/prijsresultaat uit te komen.
- [Schema Markup Validator](https://validator.schema.org/) — nul fouten.
- Lighthouse (mobiel, incognito) op de homepage en een reispagina.
