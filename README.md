# TaalibTravels

Website voor Umrah-reisbureau **TaalibTravels**, gebaseerd op de campagneposter.

De site heeft twee uiterlijken, om te wisselen met de knop in de navigatie:

- **dark** (standaard) — bijna zwart met blauwe ondertoon en ijsblauw accent
- **light** — crème/wit met een warm goud accent

Componenten gebruiken uitsluitend semantische kleur-tokens (`bg-page`,
`bg-surface`, `text-heading`, `text-accent`, …). De concrete waarden staan één
keer per thema in `src/app/globals.css`; een rebrand of een derde thema vraagt
dus geen enkele wijziging in een component.

> **Puur frontend.** Geen backend, geen database, geen API-routes. Alle content
> staat in `src/data/content.json` en wordt bij het bouwen meegebundeld, dus
> elke pagina is statisch. De site kan als statische export gehost worden.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- `next/font` — Anton (display) en Poppins (body)

## Aan de slag

```bash
npm install
npm run dev
```

De site draait dan op http://localhost:3000.

| Script                 | Doet                                                  |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Ontwikkelserver                                       |
| `npm run build`        | Productiebuild                                        |
| `npm run start`        | Productieserver (na build)                            |
| `npm run lint`         | ESLint                                                |
| `npm run typecheck`    | TypeScript zonder output                              |
| `npm run typegen`      | Genereert de `PageProps`/`LayoutProps` route-types    |
| `npm run placeholders` | Hergenereert de placeholder-foto's in `public/images` |
| `npm run hero-video`   | Bouwt de videocompilatie voor de hero (zie onder)      |

> `npm run typecheck` heeft de gegenereerde route-types nodig. Draai eerst
> `npm run typegen` (of `npm run dev` / `npm run build`) na een verse clone.

## Structuur

```
src/
├── app/
│   ├── layout.tsx              Root layout: fonts, metadata, navbar/footer
│   ├── page.tsx                Homepage
│   ├── reizen/page.tsx         Overzicht van alle reizen
│   ├── reizen/[slug]/page.tsx  Detailpagina per reis (statisch gegenereerd)
│   ├── contact/page.tsx        Contactpagina
│   ├── not-found.tsx           404
│   ├── sitemap.ts / robots.ts  SEO-basics
│   └── globals.css             Tailwind-thema en design tokens
├── components/
│   ├── brand/logo.tsx          SVG-logo (moskee + vliegtuig-swoosh)
│   ├── layout/                 Navbar, Footer, achtergrondlaag
│   ├── home/hero.tsx           Hero van de homepage
│   ├── home/hero-video.tsx     Videocompilatie in de hero (muted, loop)
│   ├── trips/                  TripCard, TripDetail, DateBlock, FeatureList,
│   │                           PriceBlock, GallerySection
│   └── ui/                     Button, Badge, Section, ThemeToggle,
│                               WhatsAppButton, WhatsAppCta, iconen
├── data/
│   └── content.json            Alle content: reizen, teksten, contactgegevens
├── lib/
│   ├── content.ts              Leest content.json in en levert de lees-functies
│   ├── theme.ts                Themasleutel + init-script (geen "use client")
│   ├── types.ts                Domeinmodellen
│   └── utils.ts                Datum-/prijsformattering, WhatsApp-links
└── scripts/
    ├── generate-placeholders.mjs
    └── build-hero-video.mjs
```

## Foto's vervangen

De bestanden in `public/images` zijn gegenereerde placeholders (behalve
`hero-poster.jpg`). Zet er echte foto's neer met dezelfde bestandsnamen, of pas
de paden aan in `src/lib/mock-data.ts`. Vergeet de `alt`-teksten niet — die
staan bij de data.

## Hero-video

De hero op de homepage toont `public/videos/hero-compilatie.mp4`: een montage
van losse telefoonopnames, staand formaat (576×1024), zonder audiotrack.
`public/images/hero-poster.jpg` is het poster-frame en komt uit diezelfde
montage — die twee horen altijd bij elkaar, anders springt het beeld op het
moment dat de video start.

Beide worden gegenereerd door één script:

```bash
npm run hero-video
```

Pas de lijst `SOURCES` boven in `scripts/build-hero-video.mjs` aan om andere of
meer fragmenten te gebruiken. Verder staan daar drie knoppen:

| Constante           | Doet                                                          |
| ------------------- | ------------------------------------------------------------- |
| `MAX_CLIP_SECONDS`  | Maximale duur per fragment; kortere clips blijven volledig     |
| `CRF`               | Kwaliteit vs. bestandsgrootte (hoger = kleiner, 28–32 zinnig)  |
| `POSTER_AT`         | Seconde waaruit het poster-frame gegrepen wordt                |

Het script schaalt en snijdt elk fragment bij naar hetzelfde staande kader en
trekt de framerate gelijk. Zonder die stap weigert ffmpeg bronnen met
verschillende afmetingen aan elkaar te plakken.

> Let op de bestandsgrootte: de video speelt automatisch af, dus elke bezoeker
> downloadt hem. Houd hem bij voorkeur onder ~5 MB.

## Content aanpassen

Alles staat in **`src/data/content.json`**. Geen component hoeft aangeraakt te
worden om teksten, prijzen of reizen te wijzigen.

| Sleutel           | Bevat                                                        |
| ----------------- | ------------------------------------------------------------ |
| `site`            | Naam, tagline, WhatsApp-nummer, e-mail, Instagram, domein     |
| `navigation`      | De links in de navigatiebalk en de footer                     |
| `inclusions`      | De "Inclusief?"-regels, één keer gedefinieerd                 |
| `gallery`         | Gedeelde fotopool                                             |
| `trips`           | De reizen                                                     |
| `faq`             | Veelgestelde vragen op de contactpagina                       |

Een paar regels die het bestand hanteert:

- Een reis verwijst met id's naar `inclusions`, zodat dezelfde tekst niet bij
  elke reis herhaald staat. Verwijs je naar een id die niet bestaat, dan faalt
  de build met een duidelijke melding — geen stille lege lijst.
- `status: "draft"` verbergt een reis zonder hem te verwijderen.
- `featured: true` bepaalt welke reis de homepage-hero toont; zet dit bij één
  reis.
- Een reis zonder eigen `gallery` gebruikt de gedeelde `gallery`.
- Datums zijn ISO (`"2026-11-07"`), `slug` is uniek en vormt de URL.

`src/lib/content.ts` is de enige plek die het bestand inleest; `src/lib/types.ts`
beschrijft de vorm ervan.

## Contact en reserveren

De site heeft **geen formulieren**. Reserveren en vragen stellen gaat volledig
via WhatsApp, met telefoon, e-mail en Instagram als alternatief op de
contactpagina. Dat past bij een statische site zonder backend: er is niets dat
een inzending zou kunnen ontvangen, en klanten boeken toch al via hun telefoon.

`WhatsAppCta` (`src/components/ui/whatsapp-cta.tsx`) is het grote blok dat
onderaan elke reispagina en op de contactpagina staat. `WhatsAppButton` is de
knop op zich. Beide bouwen een `wa.me`-link met een voorgevuld bericht, zodat de
klant alleen nog hoeft te verzenden — pas de tekst aan waar de component wordt
aangeroepen.

Het nummer staat één keer in `content.json` onder `site.whatsapp`.
