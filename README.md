# TaalibTravels

Website voor Umrah-reisbureau **TaalibTravels**, gebaseerd op de campagneposter.

De site heeft twee uiterlijken, om te wisselen met de knop in de navigatie:

- **light** (standaard) — crème/wit met een warm goud accent
- **dark** — bijna zwart met blauwe ondertoon en ijsblauw accent

Componenten gebruiken uitsluitend semantische kleur-tokens (`bg-page`,
`bg-surface`, `text-heading`, `text-accent`, …). De concrete waarden staan één
keer per thema in `src/app/globals.css`; een rebrand of een derde thema vraagt
dus geen enkele wijziging in een component.

> **Statisch, op één uitzondering na.** Alle content staat als JSON in
> `src/data` en wordt bij het bouwen meegebundeld, dus elke pagina is een
> statisch bestand — de site draait als export op Cloudflare. De enige
> servercode is `worker/`, en die draait uitsluitend op `/api/*`: het
> inschrijfformulier van de giveaway en het admin-overzicht daarachter. Zie
> [Giveaway en inschrijvingen](#giveaway-en-inschrijvingen).

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
| `npm run dev`          | Ontwikkelserver (zonder `/api` — zie hieronder)       |
| `npm run build`        | Productiebuild                                        |
| `npm run preview`      | Build + `wrangler dev`: de enige manier om `/api` lokaal te draaien |
| `npm run deploy`       | Build + `wrangler deploy`                             |
| `npm run start`        | Productieserver (na build)                            |
| `npm run lint`         | ESLint                                                |
| `npm run typecheck`    | TypeScript voor de site én de Worker                  |
| `npm run typegen`      | Genereert de `PageProps`/`LayoutProps` route-types    |
| `npm run cf-typegen`   | Genereert `Env` uit de bindings in `wrangler.jsonc`   |
| `npm run hero-video`   | Bouwt de videocompilatie voor de hero (zie onder)      |

> `npm run typecheck` heeft twee gegenereerde bestanden nodig. Draai na een
> verse clone eerst `npm run typegen` (of `dev` / `build`) voor de route-types,
> en `npm run cf-typegen` voor het `Env`-type van de Worker.

> `npm run dev` draait alleen Next.js en kent `/api` dus niet: het
> giveaway-formulier geeft daar een netwerkfout. Werk je aan het formulier of
> aan het admin-overzicht, gebruik dan `npm run preview`.

## Structuur

```
src/
├── app/
│   ├── layout.tsx              Root layout: fonts, metadata, navbar/footer
│   ├── page.tsx                Homepage
│   ├── reizen/page.tsx         Overzicht van alle reizen
│   ├── reizen/[slug]/page.tsx  Detailpagina per reis (statisch gegenereerd)
│   ├── contact/page.tsx        Contactpagina
│   ├── giveaway/page.tsx       Inschrijfpagina van de giveaway
│   ├── admin/page.tsx          Beheeroverzicht (leeg omhulsel; data via /api)
│   ├── privacy/page.tsx        Privacyverklaring
│   ├── not-found.tsx           404
│   ├── sitemap.ts / robots.ts  SEO-basics
│   └── globals.css             Tailwind-thema en design tokens
├── components/
│   ├── brand/logo.tsx          SVG-logo (moskee + vliegtuig-swoosh)
│   ├── layout/                 Navbar, Footer, achtergrondlaag
│   ├── home/hero.tsx           Hero van de homepage
│   ├── home/hero-video.tsx     Videocompilatie in de hero (muted, loop)
│   ├── giveaway/               Inschrijfformulier + Turnstile-hook
│   ├── admin/                  Inlogscherm en deelnemerstabel
│   ├── trips/                  TripCard, TripDetail, DateBlock, FeatureList,
│   │                           PriceBlock, GallerySection
│   └── ui/                     Button, Badge, Section, Field, ThemeToggle,
│                               WhatsAppButton, WhatsAppCta, iconen
├── data/
│   ├── site.json               Naam, tagline, contactgegevens, socials
│   ├── navigation.json         Links in navigatiebalk en footer
│   ├── inclusions.json         De "Inclusief?"-regels, per id
│   ├── images.json             Elke foto één keer beschreven, per id
│   ├── gallery.json            Gedeelde fotopool (lijst foto-id's)
│   ├── faq.json                Veelgestelde vragen
│   ├── giveaway.json           Copy, einddatum en Turnstile site key
│   ├── privacy.json            Tekst van de privacyverklaring
│   └── trips/                  Eén bestand per reis + index.ts (het register)
├── lib/
│   ├── content.ts              Leest src/data in en levert de lees-functies
│   ├── theme.ts                Themasleutel + init-script (geen "use client")
│   ├── types.ts                Domeinmodellen
│   ├── leads.ts                Validatieregels, gedeeld met de Worker
│   ├── api.ts                  API-paden en antwoordtypes, idem
│   └── utils.ts                Datum-/prijsformattering, WhatsApp-links
├── scripts/
│   ├── generate-placeholders.mjs
│   └── build-hero-video.mjs
└── worker/                     De enige servercode; draait alleen op /api/*
    ├── index.ts                Router en handlers
    ├── auth.ts                 Sessiecookie en wachtwoordcontrole
    ├── csv.ts                  CSV-export
    └── schema.sql              Tabel `deelnemers` in D1
```

> `src/lib/leads.ts` en `src/lib/api.ts` worden door zowel de site als de Worker
> geïmporteerd. Ze mogen daarom **geen `@/*`-alias gebruiken**: wrangler bundelt
> met esbuild en past die alias niet toe.

## Foto's

Alle foto's staan in `public/images` en worden beschreven in
`src/data/images.json`. Een foto toevoegen of vervangen:

1. Zet het bestand in `public/images`. Schaal het eerst terug — de lange zijde
   op ~1600px en JPEG-kwaliteit 80 levert scherpe beelden van 100–300 KB.
2. Voeg hem toe aan `images.json` met de **echte** afmetingen: die bepalen de
   verhouding waarmee Next.js de ruimte reserveert, dus een verkeerde waarde
   laat de pagina verspringen. Schrijf ook een `alt` die beschrijft wat er te
   zien is. Als id gebruiken we de bestandsnaam zonder extensie.
3. Zet die id in `gallery.json`, in de `gallery` van een reis, of als
   `coverImage` van een reis.

```json
"klokkentoren": {
  "src": "/images/klokkentoren.jpg",
  "alt": "De klokkentoren van Makkah tegen een blauwe lucht",
  "width": 1400,
  "height": 933
}
```

Elke foto staat zo maar één keer beschreven, ook als hij bij meerdere reizen
hoort: een gecorrigeerde alt-tekst of afmeting geldt meteen overal. Verwijs je
naar een id die niet bestaat, dan faalt de build met een duidelijke melding.

De galerij bestaat uit twee lagen. `gallery.json` is de gedeelde set en staat op
de homepage. Krijgt een reis een eigen `gallery`, dan gebruikt die reis zijn
eigen foto's — zo toont elke reispagina iets anders. Laat je hem weg, dan valt
die reis terug op de gedeelde set.

Drie dingen om rekening mee te houden:

- **Houd elke `gallery` op zes foto's.** Met de grote tegel erbij vullen die
  precies drie rijen van drie op desktop en drie rijen van twee op mobiel. Bij
  een ander aantal blijft er onderaan een lege cel over — de build weigert het
  dan ook.
- **Gebruik liggende foto's.** De tegels zijn breder dan hoog en snijden bij met
  `object-cover`; van een staande foto blijft dan alleen een smalle band over.
  Snijd ze daarom vooraf op 3:2 bij, zodat jij bepaalt wat er in beeld komt en
  niet de browser.
- **Snijd gecentreerd bij, niet automatisch.** De "attention"-modus van
  beeldbewerkers kiest het contrastrijkste deel, en dat is bij een avondfoto
  vaak juist de lege lucht of een donkere helling in plaats van de mensen.

## Hero-video

De hero op de homepage toont `public/videos/hero-compilatie.mp4`: een montage
van losse telefoonopnames, staand 4:5 (720×900), zonder audiotrack.
`public/images/hero-poster.jpg` is het poster-frame en komt uit diezelfde
montage — die twee horen altijd bij elkaar, anders springt het beeld op het
moment dat de video start.

Beide worden gegenereerd door één script:

```bash
npm run hero-video
```

Pas `SOURCE_DIR` en `SOURCES` boven in `scripts/build-hero-video.mjs` aan om
andere fragmenten te gebruiken. Verder staan daar drie knoppen:

| Constante           | Doet                                                          |
| ------------------- | ------------------------------------------------------------- |
| `MAX_CLIP_SECONDS`  | Maximale duur per fragment; kortere clips blijven volledig     |
| `CRF`               | Kwaliteit vs. bestandsgrootte (hoger = kleiner, 28–32 zinnig)  |
| `POSTER_AT`         | Seconde waaruit het poster-frame gegrepen wordt                |

Bronnen mogen staand én liggend door elkaar. Een staand fragment wordt
bijgesneden tot het kader vol is; een liggend fragment zou daarbij ruim de helft
verliezen en wordt daarom passend geschaald met een vervaagde kopie van zichzelf
als achtergrond. Zet een staand fragment vooraan en richt `POSTER_AT` daarop —
anders krijgt het poster-frame die vervaagde balken.

Het script schaalt en snijdt elk fragment bij naar hetzelfde staande kader en
trekt de framerate gelijk. Zonder die stap weigert ffmpeg bronnen met
verschillende afmetingen aan elkaar te plakken.

> Let op de bestandsgrootte: de video speelt automatisch af, dus elke bezoeker
> downloadt hem. Houd hem bij voorkeur onder ~5 MB.

## Content aanpassen

Alles staat in **`src/data`**, per onderwerp een eigen bestand. Geen component
hoeft aangeraakt te worden om teksten, prijzen of reizen te wijzigen.

| Bestand              | Bevat                                                      |
| -------------------- | ---------------------------------------------------------- |
| `site.json`          | Naam, tagline, WhatsApp-nummer, e-mail, Instagram, domein   |
| `navigation.json`    | De links in de navigatiebalk en de footer                   |
| `inclusions.json`    | De "Inclusief?"-regels, één keer gedefinieerd, per id       |
| `images.json`        | Elke foto één keer beschreven, per id                       |
| `gallery.json`       | Gedeelde fotopool — een lijst van foto-id's                 |
| `faq.json`           | Veelgestelde vragen op de contactpagina                     |
| `trips/<slug>.json`  | Eén bestand per reis                                        |
| `trips/index.ts`     | Het register: welke reisbestanden er zijn                   |

### Een reis toevoegen

1. Maak `src/data/trips/<slug>.json` aan — kopieer een bestaande reis als basis.
2. Zet in `src/data/trips/index.ts` één import erbij en de naam in de lijst.
   Die lijst staat er met de hand omdat `content.ts` ook in de browser-bundle
   belandt (de navbar gebruikt hem), en daar kan geen map uitgelezen worden.
3. Draai `npm run build`. Klopt er een verwijzing niet, dan hoor je het meteen.

### Regels die de bestanden hanteren

- Een reis verwijst met id's naar `inclusions.json` en `images.json`, zodat
  dezelfde tekst of foto niet bij elke reis herhaald staat. Verwijs je naar een
  id die niet bestaat, dan faalt de build met een duidelijke melding — geen
  stille lege lijst.
- `status: "draft"` verbergt een reis zonder hem te verwijderen. Drafts worden
  eruit gefilterd vóór de verwijzingen opgezocht worden, dus een half afgewerkte
  reis breekt de build niet.
- De homepage-hero toont altijd de eerstvolgende reis: de eerste die op de dag
  van de build nog niet terug is. Daar valt niets aan in te stellen — zet de
  datums goed en de hero volgt vanzelf.
- Een reis zonder eigen `gallery` gebruikt de gedeelde pool uit `gallery.json`.
  Elke galerij telt precies zes foto's.
- Datums zijn ISO (`"2026-11-07"`), `slug` is uniek en vormt de URL. De
  bestandsnaam volgt de slug, maar de `slug`-waarde in het bestand telt.

`src/lib/content.ts` is de enige plek die het bestand inleest; `src/lib/types.ts`
beschrijft de vorm ervan.

## Giveaway en inschrijvingen

Deelnemers aan de giveaway laten hun gegevens achter op `/giveaway`. Dat is het
enige formulier van de site, en de enige reden dat er servercode bestaat.

```
Browser  /giveaway  ──POST /api/deelnemers──▶  Worker  ──▶  D1 `deelnemers`
Browser  /admin     ──GET  /api/admin/…────▶  Worker  ──▶  D1
                        (HttpOnly sessiecookie)
```

Velden: **voornaam, achternaam en e-mail zijn verplicht, telefoon is optioneel.**
Een leeg telefoonveld wordt als `NULL` opgeslagen, nooit als lege string. Verder
twee verplichte vinkjes — dat de deelnemer aan de voorwaarden voldeed, en
toestemming voor mails — die allebei als kolom bewaard worden, want toestemming
moet je achteraf kunnen aantonen.

De deelnamevoorwaarden zélf staan bewust niet op de site: die communiceer je via
Instagram. Het vinkje laat de deelnemer alleen bevestigen dat hij eraan voldeed.
Zorg er dan wel voor dat in die Instagram-tekst staat dat meedoen betekent dat je
onze mails ontvangt — het formulier zegt het bij het vinkje, en de
[privacyverklaring](src/data/privacy.json) legt het uit, maar wie op Instagram
begint hoort het daar al te lezen.

Tegen misbruik staan er drie lagen: een Turnstile-captcha, een unieke index op
`email` (dus één inschrijving per adres), en een verborgen honeypot-veld. Een
inzending die daarin blijft hangen krijgt gewoon een bevestiging te zien maar
wordt niet opgeslagen.

### Eenmalig opzetten

```bash
npx wrangler d1 create taalibtravels-leads       # id in wrangler.jsonc zetten
npx wrangler d1 execute taalibtravels-leads --remote --file=./worker/schema.sql
npx wrangler d1 execute taalibtravels-leads --local  --file=./worker/schema.sql

npx wrangler secret put ADMIN_WACHTWOORD         # minimaal 16 tekens
npx wrangler secret put ADMIN_SESSIE_SECRET      # willekeurig, 32+ tekens
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put IP_SALT
```

Lokaal komen diezelfde waarden uit `.dev.vars`; `.dev.vars.example` is het
sjabloon. Dat bestand staat in `.gitignore` — let op, het valt **niet** onder de
`.env*`-regel, dus die uitzondering staat er apart in.

Maak in het Cloudflare-dashboard een **Turnstile**-widget aan voor het domein.
De secret key wordt het Worker-secret hierboven; de site key hoort in
`giveaway.json` en mag gewoon in git. Zolang daar Cloudflare's testsleutel staat,
zet `/giveaway` er zichtbaar een waarschuwing bij — die sleutel laat namelijk
élke bot door.

Ontbreekt `ADMIN_WACHTWOORD` of `ADMIN_SESSIE_SECRET`, of zijn ze te kort, dan
antwoordt alles onder `/api/admin/` met **503**. Beheer gaat liever helemaal
dicht dan half open: met een lege sessiesleutel is een cookie te vervalsen.

### Het overzicht gebruiken

`/admin` vraagt om het wachtwoord en toont daarna alle inschrijvingen, met een
zoekveld, een knop om alle e-mailadressen te kopiëren, een CSV-export en een
verwijderknop per rij. De pagina zelf is statische HTML zonder gegevens erin —
alles komt via de API achter de sessiecontrole binnen, want bij een statische
export staat elk gegenereerd bestand publiek op het netwerk.

De CSV is komma-gescheiden (RFC 4180, met UTF-8 BOM), zodat Mailchimp en Brevo
hem zonder omwegen inlezen. Een cel die met `=`, `+`, `-` of `@` begint krijgt
een apostrof mee, anders voert Excel de inhoud uit als formule.

## Contact en reserveren

Reserveren en vragen stellen gaat volledig via WhatsApp, met telefoon, e-mail en
Instagram als alternatief op de contactpagina. Klanten boeken toch al via hun
telefoon, dus daar staat bewust geen formulier tegenover — het enige formulier
van de site is de giveaway-inschrijving hierboven.

`WhatsAppCta` (`src/components/ui/whatsapp-cta.tsx`) is het grote blok dat
onderaan elke reispagina en op de contactpagina staat. `WhatsAppButton` is de
knop op zich. Beide bouwen een `wa.me`-link met een voorgevuld bericht, zodat de
klant alleen nog hoeft te verzenden — pas de tekst aan waar de component wordt
aangeroepen.

Het nummer staat één keer in `src/data/site.json` onder `whatsapp`.
