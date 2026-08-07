# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

| Command             | Doet                                                    |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server op http://localhost:3000                     |
| `npm run build`     | Productiebuild                                          |
| `npm run start`     | Productieserver (na build)                              |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | `tsc --noEmit`                                          |
| `npm run typegen`   | Genereert de `PageProps`/`LayoutProps` route-types      |
| `npm run hero-video`| Bouwt `public/videos/hero-compilatie.mp4` + poster-frame |

`npm run typecheck` faalt op een verse clone tot de route-types bestaan — draai eerst
`npm run typegen` (of `dev`/`build`).

Er is **geen testrunner en geen testsuite**. `lint` + `typecheck` + een build zijn de
volledige verificatie; `npm run build` is de scherpste check, omdat de contentvalidatie
in [content.ts](src/lib/content.ts) pas bij het bundelen draait.

## Architectuur

Puur frontend: geen backend, geen database, geen API-routes, geen formulieren. Elke
pagina is statisch. De site kan als statische export gehost worden.

### Content is data, geen code

**Alle** teksten, reizen, prijzen en bedrijfsgegevens staan als JSON in
[src/data](src/data), opgesplitst per onderwerp. Content wijzigen hoort nul componenten
te raken. [src/lib/content.ts](src/lib/content.ts) is de enige module die die bestanden
kent; [src/lib/types.ts](src/lib/types.ts) beschrijft de vorm ná het uitpakken.

| Bestand                 | Bevat                                                    |
| ----------------------- | -------------------------------------------------------- |
| `site.json`             | Naam, tagline, WhatsApp, e-mail, Instagram, domein        |
| `navigation.json`       | De links in navigatiebalk en footer                       |
| `inclusions.json`       | De "Inclusief?"-regels, per id                            |
| `images.json`           | Elke foto één keer: `src`, `alt`, `width`, `height`, per id |
| `gallery.json`          | Gedeelde fotopool — een lijst foto-id's                   |
| `faq.json`              | Veelgestelde vragen                                       |
| `trips/<slug>.json`     | Eén bestand per reis                                      |
| `trips/index.ts`        | Register: welke reisbestanden bestaan                     |

Twee dingen staan bewust één keer beschreven en worden elders alleen met een **id**
aangeroepen: de inclusies en de foto's. Een reis heeft dus `"coverImage": "trip-umrah-budget"`
en `"gallery": ["les-pilaren", …]`, geen ingesloten objecten. Een alt-tekst of afmeting
corrigeer je daardoor op één plek.

Bij het importeren van `content.ts` wordt de `TRIPS`-array één keer op module-niveau
opgebouwd — drafts eruit, id's opgezocht, gesorteerd op `departureDate`. Gevolgen om te
kennen:

- Een verwijzing naar een niet-bestaande `inclusion`- of foto-id **gooit tijdens de build**
  (`resolveInclusions`, `resolveImage`), bewust geen stille lege lijst. Datzelfde geldt voor
  een galerij die geen zes foto's telt en twee reizen met dezelfde slug
  (`resolveGallery`, `assertTripsConsistent`).
- `inclusions.json` en de reisbestanden worden gecast met `as unknown as`; TypeScript leest
  uit JSON alleen brede types (`"EUR"` wordt `string`). De typecheck bewaakt die vorm dus
  niet — de resolvers hierboven doen dat wel, bij de build.
- `status: "draft"` verbergt een reis, een reis zonder eigen `gallery` valt terug op de
  gedeelde pool. Drafts worden er vóór het uitpakken uitgefilterd, dus een half afgewerkte
  reis breekt de build niet.
- De homepage-hero is niet instelbaar: `getNextTrip` pakt de eerste reis die op dat moment
  nog niet terug is, en vult daarmee titel, samenvatting, datum en prijs. De pagina wordt
  statisch gebouwd, dus "dat moment" is de build — na een verstreken reis is een redeploy
  nodig voordat de hero opschuift.
- Een reis toevoegen: bestand aanmaken onder `trips/`, plus één import en één regel in
  `trips/index.ts`. Dat register staat er expliciet omdat `content.ts` ook in een client
  component belandt (de navbar) — de map uitlezen met `fs` kan dus niet.

Consumeer content via de functies uit `content.ts` (`getTrips`, `getTripBySlug`,
`getNextTrip`, `getTripSlugs`, `getGallery`) en de constanten
`SITE` / `NAV_LINKS` / `FAQ` — importeer nooit een bestand uit `src/data` rechtstreeks in
een component.

### Thema's en design tokens

Twee uiterlijken, geschakeld via `data-theme` op `<html>`: `light` (standaard) en
`dark`. Componenten gebruiken **uitsluitend semantische tokens** — `bg-page`,
`bg-surface`, `text-heading`, `text-accent`, `border-line`, `shadow-card`, … De concrete
waarden staan één keer per thema in [globals.css](src/app/globals.css). Een hardgecodeerde
kleur in een component (`bg-[#111]`, `text-white`) breekt het andere thema en hoort er
niet te staan. WhatsApp-groen is de uitzondering: merkkleur, verandert niet mee.

Twee details die niet vanzelf spreken:

- `@theme` bevat de waarden van het standaardthema (light); het `:root[data-theme="dark"]`-blok
  overschrijft ze en staat bewust **buiten elke `@layer`** — ongelaagde regels winnen altijd
  van de gelaagde `:root` uit `@theme`.
- [src/lib/theme.ts](src/lib/theme.ts) heeft bewust **geen `"use client"`**. Het wordt
  door zowel de root layout (server) als de ThemeToggle (client) geïmporteerd; met de
  directive zou `THEME_INIT_SCRIPT` aan serverzijde een client-verwijzing zijn in plaats
  van een string. Dat script draait synchroon in `<head>` vóór de eerste paint, zodat wie
  licht koos geen donkere flits ziet.

### Server- vs. client-componenten

Alles is een server component, op drie na: `navbar.tsx`, `ui/theme-toggle.tsx` en
`home/hero-video.tsx`. Houd dat zo — nieuwe interactiviteit hoort in een klein client-blad,
niet door `"use client"` naar boven te schuiven.

### Hydration: formatteer datums en prijzen handmatig

[src/lib/utils.ts](src/lib/utils.ts) formatteert datums en bedragen met eigen
Nederlandse maandtabellen en UTC-getters in plaats van `Intl`, zodat server en browser
byte-voor-byte hetzelfde produceren. Gebruik `formatDateNumeric`, `formatDateLong`,
`splitDate`, `nightsBetween`, `formatAmount`, `formatPrice` — introduceer hier geen
`Intl.DateTimeFormat` of `toLocaleString`.

### Conversie loopt volledig via WhatsApp

Geen formulieren, dus ook geen types voor ingevulde velden. `whatsappUrl(message?)` in
`utils.ts` bouwt een `wa.me`-link met voorgevuld bericht; het nummer staat één keer in
`site.json` onder `whatsapp`. `WhatsAppCta` is het blok onderaan reis- en
contactpagina, `WhatsAppButton` de losse knop — het bericht geef je mee op de plek van
aanroep.

### UI-primitieven

- `Section` heeft een `spacing`-prop (`default` / `continue` / `tight` / `none`).
  Overschrijf de padding **niet** via `className`: de standaard bevat een `lg:`-variant
  die in de cascade van een losse `pt-0` wint.
- `Button` rendert `<button>`, `<Link>` of `<a>` afhankelijk van `href`; externe links
  (`http`, `mailto`, `tel`) omzeilen de router automatisch.
- Iconen zijn inline SVG's in [icons.tsx](src/components/ui/icons.tsx). De `IconKey`-union
  in `types.ts` en de `INCLUSION_ICONS`-map moeten synchroon blijven met de `icon`-waarden
  in `inclusions.json`.

### Next.js 16 specifics

`params` is een Promise: `const { slug } = await props.params`. Route-props typen met de
gegenereerde globals — `PageProps<"/reizen/[slug]">` — niet met een handgeschreven
interface. `generateStaticParams` in [reizen/[slug]/page.tsx](src/app/reizen/[slug]/page.tsx)
bouwt elke detailpagina statisch. `next.config.ts` pint de Turbopack-root, omdat er ook
een `package-lock.json` in de home-directory staat.

## Conventies

- **Alles is Nederlands**: UI-copy, content, en ook de code-commentaren en JSDoc. Schrijf
  nieuwe commentaren in het Nederlands en leg het *waarom* vast, niet het *wat* — dat is
  de bestaande stijl in dit project.
- Imports gaan via het `@/*`-alias naar `src/`.

## Foto's en video

Foto's staan in `public/images` en worden beschreven in `images.json`, één keer per foto,
met de bestandsnaam zonder extensie als id. Galerijen en `coverImage` verwijzen alleen naar
die id's. Zet altijd de **echte** afmetingen in `width`/`height` — die bepalen de
gereserveerde ruimte, een verkeerde waarde laat de pagina verspringen. Houd elke `gallery`
op **zes** liggende (3:2) foto's: met de grote tegel erbij vult dat precies het raster, bij
een ander aantal blijft er een lege cel over — `resolveGallery` breekt de build als het er
niet zes zijn.

`scripts/build-hero-video.mjs` heeft een hardgecodeerd `CLIPS_DIR` naar een lokale
Downloads-map; `npm run hero-video` draait niet zonder die constanten eerst aan te passen.
Video en poster-frame komen uit dezelfde montage en horen altijd samen vernieuwd te worden.
Houd het eindbestand onder ~5 MB — het speelt automatisch af, dus elke bezoeker downloadt
het.

Zie [README.md](README.md) voor de volledige uitleg over content, foto's en de hero-video.
