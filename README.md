# TaalibTravels

Website voor Umrah-reisbureau **TaalibTravels**, gebaseerd op de campagneposter.

De site heeft twee uiterlijken, om te wisselen met de knop in de navigatie:

- **light** (standaard) — crème/wit met een warm goud accent
- **dark** — bijna zwart met blauwe ondertoon en ijsblauw accent

Componenten gebruiken uitsluitend semantische kleur-tokens (`bg-page`,
`bg-surface`, `text-heading`, `text-accent`, …). De concrete waarden staan één
keer per thema in `src/app/globals.css`; een rebrand of een derde thema vraagt
dus geen enkele wijziging in een component.

> **Dynamisch, op Cloudflare Workers.** De site draait als OpenNext-Worker. Reizen,
> foto's en de homepagegalerij staan in D1 en R2 en worden in het
> [beheerportaal](#beheerportaal) bewerkt; de pagina's lezen ze per verzoek, dus een
> wijziging is direct live. Alleen de vaste content (bedrijfsgegevens, navigatie, FAQ,
> giveaway, privacy) staat nog als JSON in `src/data`. De Worker (`worker/`) handelt
> `/media/*` en `/api/*` zelf af en geeft de rest aan Next. Zie
> [Giveaway en inschrijvingen](#giveaway-en-inschrijvingen).

## Stack

- Next.js 16 (App Router, Turbopack) op Cloudflare Workers via OpenNext
- Cloudflare D1 (reizen, foto-metadata, deelnemers) en R2 (foto-bestanden)
- React 19 + TypeScript
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- `next/font` — Anton (display) en Poppins (body)

## Aan de slag

```bash
npm install
npm run dev
```

De site draait dan op http://localhost:3000, maar zonder D1, R2 en `/api`: de pagina's die
reizen tonen werken pas met `npm run preview`. Vereist Node 22.18 of nieuwer.

| Script                 | Doet                                                  |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Ontwikkelserver (zonder `/api`, `/media` en D1)        |
| `npm run build`        | `next build` (draait eerst `prebuild`: `images` en `headers`) |
| `npm run preview`      | OpenNext-build + `wrangler dev`: de enige manier om `/api`, `/media` en D1 lokaal te draaien |
| `npm run deploy`       | OpenNext-build + `wrangler deploy`                    |
| `npm run start`        | Productieserver (na build); kent D1 niet               |
| `npm run lint`         | ESLint                                                |
| `npm run typecheck`    | TypeScript voor de site én de Worker                  |
| `npm run typegen`      | Genereert de `PageProps`/`LayoutProps` route-types    |
| `npm run cf-typegen`   | Genereert `Env` uit de bindings in `wrangler.jsonc`   |
| `npm run seed`         | Zet de oorspronkelijke JSON-reizen en foto's over naar D1 en R2 (`-- --local` of `-- --remote`) |
| `npm run images`       | WebP-varianten van de bronfoto's in `images.json` (alleen nog nodig voor de seed) |
| `npm run headers`      | Schrijft `public/_headers` uit `worker/beveiligingsheaders.ts` |
| `npm run hero-video`   | Bouwt de videocompilatie voor de hero (zie onder)      |
| `npm run hero-video:web` | Leidt de WebM en het WebP-poster af                  |

> `npm run typecheck` heeft twee gegenereerde bestanden nodig. Draai na een
> verse clone eerst `npm run typegen` (of `dev` / `build`) voor de route-types,
> en `npm run cf-typegen` voor het `Env`-type van de Worker. Kopieer eerst
> `.dev.vars.example` naar `.dev.vars`: daar komen de secret-namen en de lokale
> waarden vandaan.

> `npm run dev` draait alleen Next.js en kent `/api`, `/media` en D1 niet. Werk
> je aan een pagina met reizen, het formulier of het beheerportaal, gebruik dan
> `npm run preview`. Op Windows kan een gestopte `wrangler dev` een `workerd`-proces
> achterlaten dat `.open-next/assets` vergrendelt; stop dat voor de volgende build.

## Structuur

```
src/
├── app/
│   ├── layout.tsx              Root layout: fonts, metadata, navbar/footer
│   ├── page.tsx                Homepage
│   ├── reizen/page.tsx         Overzicht van alle reizen
│   ├── reizen/[slug]/page.tsx  Detailpagina per reis (per verzoek uit D1)
│   ├── contact/page.tsx        Contactpagina
│   ├── giveaway/page.tsx       Inschrijfpagina van de giveaway
│   ├── admin/page.tsx          Beheerportaal (leeg omhulsel; data via /api)
│   ├── privacy/page.tsx        Privacyverklaring
│   ├── error.tsx               Foutpagina (bijv. als D1 onbereikbaar is)
│   ├── not-found.tsx           404
│   ├── sitemap.ts / robots.ts  SEO-basics
│   └── globals.css             Tailwind-thema en design tokens
├── components/
│   ├── brand/logo.tsx          SVG-logo (moskee + vliegtuig-swoosh)
│   ├── layout/                 Navbar, Footer, achtergrondlaag
│   ├── home/hero.tsx           Hero van de homepage
│   ├── home/hero-video.tsx     Videocompilatie in de hero (muted, loop)
│   ├── giveaway/               Inschrijfformulier + Turnstile-hook
│   ├── admin/                  Inlog en de tabs Deelnemers, Reizen, Foto's
│   ├── trips/                  TripCard, TripDetail, DateBlock, FeatureList,
│   │                           PriceBlock, GallerySection
│   └── ui/                     Button, Badge, Section, Field, ThemeToggle,
│                               WhatsAppButton, WhatsAppCta, iconen
├── data/
│   ├── site.json               Naam, tagline, contactgegevens, socials
│   ├── navigation.json         Links in navigatiebalk en footer
│   ├── inclusions.json         Voorstellen voor "Inclusief?"-regels in het portaal
│   ├── faq.json                Veelgestelde vragen
│   ├── giveaway.json           Copy, einddatum en Turnstile site key
│   ├── privacy.json            Tekst van de privacyverklaring
│   └── trips/, gallery.json, images.json
│                               Seed-bronbestanden (de site leest ze niet meer)
├── lib/
│   ├── content.ts              De vaste JSON (SITE, NAV_LINKS, FAQ, ...), ook in de browser
│   ├── trips.ts                Lezers voor reizen en foto's uit D1 (alleen server)
│   ├── reizen-db.ts            D1-query's, gedeeld met de Worker
│   ├── reizen.ts               Validatie en vorm van een reis, gedeeld met de Worker
│   ├── foto-breedtes.ts        De breedteladder van elke foto
│   ├── image-loader.ts         Wijst de variant van een foto aan
│   ├── theme.ts                Themasleutel + init-script (geen "use client")
│   ├── types.ts                Domeinmodellen
│   ├── leads.ts                Validatieregels van de inschrijving, gedeeld met de Worker
│   ├── api.ts                  API-paden en antwoordtypes, idem
│   └── utils.ts                Datum-/prijsformattering, WhatsApp-links

scripts/
├── build-headers.mjs           Schrijft public/_headers uit worker/beveiligingsheaders.ts
├── build-images.mjs            WebP-varianten van bronfoto's (alleen nog voor de seed)
├── seed-bestaande-content.mjs  Eenmalige overzet van JSON en foto's naar D1 en R2
├── build-hero-video.mjs / build-hero-web.mjs
└── image-sizes.mjs             Geeft de ladder uit foto-breedtes.ts door aan de scripts

worker/                         De servercode; handelt /media/* en /api/* af
├── index.ts                    Entry: /media, /api, dan OpenNext; zet de headers
├── reizen.ts                   Beheer-API voor reizen
├── afbeeldingen.ts             Beheer-API voor foto's en galerij
├── media.ts                    /media/fotos/... uit R2
├── http.ts                     Gedeelde antwoordhelpers
├── beveiligingsheaders.ts      De ene definitie van alle headers
├── auth.ts                     Sessiecookie en inlogcontrole
├── csv.ts                      CSV-export
├── schema.sql                  Tabellen in D1
└── migraties/                  Genummerde wijzigingen op een bestaande database
```

> `src/lib/leads.ts`, `api.ts`, `reizen.ts`, `reizen-db.ts` en `foto-breedtes.ts` worden
> door zowel de site als de Worker geïmporteerd. Ze mogen daarom **geen `@/*`-alias gebruiken**: wrangler bundelt
> met esbuild en past die alias niet toe.

## Foto's

Foto's beheer je in het [beheerportaal](#beheerportaal), tab **Foto's**. Daar upload je een
foto (of meerdere tegelijk), vul je een `alt`-tekst in die beschrijft wat er te zien is, en
verwijder je foto's die nergens meer in gebruik zijn.

Achter de schermen:

- De browser verkleint de foto vóór het uploaden naar elke breedte uit
  `src/lib/foto-breedtes.ts` (WebP) en maakt een `og.jpg` (1200px) voor linkvoorbeelden.
  Op een browser die geen WebP uit een canvas kan halen (oudere Safari/iOS) valt hij terug
  op een WASM-encoder.
- De Worker valideert type, grootte en breedtes en schrijft alles naar R2 onder
  `fotos/<id>/<breedte>.webp` en `fotos/<id>/og.jpg`. Publiek komen ze uit
  `/media/fotos/<id>/<breedte>.webp`, met `immutable`-cacheheaders.
- In D1 staat per foto de id, `alt` en de **echte** `width`/`height` van de bron; die
  bepalen de gereserveerde ruimte, dus een verkeerde waarde laat de pagina verspringen.
- `src/lib/image-loader.ts` wijst voor `next/image` de juiste variant aan, zodat elke
  foto een `srcset` krijgt en een telefoon niet de volle 1600px laadt.

Drie dingen om rekening mee te houden:

- **Elke galerij heeft precies zes foto's** (per reis en voor de homepage). Met de grote
  tegel erbij vullen die precies drie rijen van drie op desktop en drie rijen van twee op
  mobiel; bij een ander aantal blijft er een lege cel over, dus het portaal weigert het.
- **Gebruik liggende foto's.** De tegels zijn breder dan hoog en snijden bij met
  `object-cover`; van een staande foto blijft dan alleen een smalle band over. Snijd ze
  vooraf op 3:2 bij, zodat jij bepaalt wat er in beeld komt en niet de browser.
- **Snijd gecentreerd bij, niet automatisch.** De "attention"-modus van beeldbewerkers kiest
  het contrastrijkste deel, en dat is bij een avondfoto vaak juist de lege lucht of een
  donkere helling in plaats van de mensen.

De breedteladder staat op één plek, `src/lib/foto-breedtes.ts`. `next.config.ts`, het
uploadformulier, de Worker en de scripts lezen hem allemaal; wijzig hem dus nooit op één
plek.

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

Daarna leidt `npm run hero-video:web` uit de MP4 en de JPEG de WebM en het
WebP-poster af die de hero echt gebruikt.

> Let op de bestandsgrootte: de video speelt automatisch af, dus elke bezoeker
> downloadt hem. Houd hem bij voorkeur onder ~5 MB.

## Content aanpassen

Wat waar staat:

| Wat | Waar | Hoe wijzig je het |
| --- | ---- | ----------------- |
| Reizen (alle velden, prijzen, inclusies, status) | D1 | Beheerportaal, tab Reizen |
| Foto's en de homepagegalerij | D1 + R2 | Beheerportaal, tab Foto's |
| Naam, tagline, WhatsApp, e-mail, Instagram, domein | `src/data/site.json` | JSON bewerken |
| Links in navigatiebalk en footer | `src/data/navigation.json` | JSON bewerken |
| Veelgestelde vragen | `src/data/faq.json` | JSON bewerken |
| Giveaway-copy, einddatum, Turnstile site key | `src/data/giveaway.json` | JSON bewerken |
| Privacyverklaring | `src/data/privacy.json` | JSON bewerken |
| Voorstellen voor "Inclusief?"-regels in het reisformulier | `src/data/inclusions.json` | JSON bewerken |

Een wijziging in het portaal staat bij de volgende paginalading live; er is geen build of
deploy voor nodig. Een wijziging in de JSON hierboven vraagt wel een deploy.

`src/lib/content.ts` leest de vaste JSON in (synchroon, ook in de browserbundel);
`src/lib/trips.ts` leest reizen en foto's per verzoek uit D1 (alleen server);
`src/lib/types.ts` beschrijft de vorm.

### Regels van het portaal

- De **slug** van een reis staat vast na het aanmaken: hij is de URL.
- Een foto die nog in gebruik is (omslag, galerij, homepagegalerij) kan niet worden
  verwijderd; het portaal noemt de reizen die hem gebruiken.
- Een galerij heeft precies zes foto's. Een reis zonder eigen galerij toont de
  homepagegalerij.
- `status: draft` verbergt een reis publiek zonder hem te verwijderen.
- De homepage-hero toont altijd de eerstvolgende reis die nog niet terug is; daar valt
  niets aan in te stellen — zet de datums goed en de hero volgt vanzelf.
- Datums zijn ISO (`"2026-11-07"`).

## Beheerportaal

`/admin` (met inlog) heeft drie tabs:

- **Deelnemers** — de giveaway-inschrijvingen: zoeken, e-mailadressen kopiëren, CSV-export,
  verwijderen.
- **Reizen** — reizen aanmaken, bewerken, verbergen/tonen en verwijderen, met alle velden van
  de reispagina, de inclusies, een omslagfoto en een galerij uit de fotobibliotheek.
- **Foto's** — foto's uploaden, de alt-tekst aanpassen, verwijderen en de homepagegalerij kiezen.

Benodigd:

| Wat | Waar |
| --- | ---- |
| `ADMIN_GEBRUIKER`, `ADMIN_WACHTWOORD` (≥ 16 tekens), `ADMIN_SESSIE_SECRET` | `npx wrangler secret put …` in productie, `.dev.vars` lokaal |
| `TURNSTILE_SECRET` | idem (alleen voor de giveaway) |
| D1-database `DB` | `wrangler.jsonc`; schema uit `worker/schema.sql` en `worker/migraties/` |
| R2-bucket `MEDIA` (`taalibtravels-media`) | `wrangler.jsonc`; eenmalig aanmaken met `npx wrangler r2 bucket create taalibtravels-media` |

Ontbreken de admin-secrets, dan antwoordt alles onder `/api/admin/` met 503.

Lokaal werk je met `npm run preview` (build + `wrangler dev`); `npm run dev` kent `/api`,
`/media` en D1 niet. Op Windows kan een gestopte `wrangler dev` `.open-next/assets`
vergrendelen: stop dan eerst de achtergebleven `workerd`-processen.

### Bestaande reizen overzetten (eenmalig)

`npm run seed -- --local` (of `--remote`, met expliciete toestemming) zet de oorspronkelijke
JSON-reizen en de foto's uit `public/images` over naar D1 en R2. Die bronbestanden
(`src/data/trips/*.json`, `gallery.json`, `images.json`, `public/images`) zijn alleen nog
**seed-bronbestanden**: de site leest ze niet meer, en ze kunnen weg zodra de productie-seed
is gedraaid.

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
wordt niet opgeslagen — wél met een regel in de Worker-logs, want als een
browser-autofill dat verborgen veld invult, verlies je een échte deelnemer.

Er wordt bewust **geen IP-adres** bewaard, ook niet gehasht. Dat stond er eerst
wel, maar het werd nergens gebruikt, en een SHA-256 over de vier miljard
IPv4-adressen is met de salt in seconden terug te rekenen — "onomkeerbaar" was
dus te veel gezegd. Turnstile en de rate limit doen het anti-misbruikwerk al.

### Eenmalig opzetten

```bash
npx wrangler d1 create taalibtravels-leads       # id in wrangler.jsonc zetten
npx wrangler d1 execute taalibtravels-leads --remote --file=./worker/schema.sql
npx wrangler d1 execute taalibtravels-leads --local  --file=./worker/schema.sql

npx wrangler secret put ADMIN_GEBRUIKER          # gebruikersnaam of e-mail
npx wrangler secret put ADMIN_WACHTWOORD         # minimaal 16 tekens
npx wrangler secret put ADMIN_SESSIE_SECRET      # willekeurig, 32+ tekens
npx wrangler secret put TURNSTILE_SECRET
```

Lokaal komen diezelfde waarden uit `.dev.vars`; `.dev.vars.example` is het
sjabloon. Dat bestand staat in `.gitignore` — let op, het valt **niet** onder de
`.env*`-regel, dus die uitzondering staat er apart in.

Maak in het Cloudflare-dashboard een **Turnstile**-widget aan voor het domein.
De secret key wordt het Worker-secret hierboven; de site key hoort in
`giveaway.json` en mag gewoon in git. Zolang daar Cloudflare's testsleutel staat,
zet `/giveaway` er zichtbaar een waarschuwing bij — die sleutel laat namelijk
élke bot door.

Ontbreekt een van de drie admin-secrets, of zijn ze te kort, dan antwoordt alles
onder `/api/admin/` met **503** — het inschrijfformulier blijft dan gewoon werken.
Beheer gaat liever helemaal dicht dan half open: met een lege sessiesleutel is een
cookie te vervalsen.

### Schemawijzigingen

`worker/schema.sql` beschrijft de tabel zoals hij hoort te zijn; voor een database
die al bestaat staan de losse stappen genummerd in `worker/migraties/`. Toepassen:

```bash
npx wrangler d1 execute taalibtravels-leads --local  --file=./worker/migraties/<nummer>-<naam>.sql
npx wrangler d1 execute taalibtravels-leads --remote --file=./worker/migraties/<nummer>-<naam>.sql
```

Verwijdert een migratie een kolom, **deploy dan eerst de code die die kolom niet
meer schrijft.** Andersom schrijft de nog draaiende oude Worker naar iets dat niet
meer bestaat, en breekt elke inschrijving.

### Het overzicht gebruiken

`/admin` vraagt om gebruikersnaam en wachtwoord, en toont daarna alle
inschrijvingen, met een zoekveld, een knop om alle e-mailadressen te kopiëren, een
CSV-export en een verwijderknop per rij. De pagina zelf is HTML zonder
gegevens erin — alles komt via de API achter de sessiecontrole binnen. De overige tabs
van het portaal staan onder [Beheerportaal](#beheerportaal).

De sessie is een cookie met een ondertekend vervalmoment plus een vingerafdruk van
de huidige inloggegevens. Daardoor is **je wachtwoord of gebruikersnaam wijzigen
meteen een "log overal uit"**: elke openstaande sessie is op slag ongeldig. Dat is
wat je nodig hebt als je vermoedt dat het wachtwoord gelekt is.

De CSV is komma-gescheiden (RFC 4180, met UTF-8 BOM), zodat Mailchimp en Brevo
hem zonder omwegen inlezen. Een cel die met `=`, `+`, `-` of `@` begint krijgt
een apostrof mee, anders voert Excel de inhoud uit als formule.

### Twee bewuste beperkingen

**Een dubbel adres krijgt een 409 met "je doet al mee".** Daarmee kan iemand die
adressen afgaat te weten komen wie er meedoet. Het alternatief — iedereen dezelfde
bevestiging tonen — laat een eerlijke deelnemer die zich per ongeluk twee keer
inschrijft in het ongewisse, en dat weegt hier zwaarder.

**Er is geen dubbele opt-in.** Iemand kan dus het adres van een ander invullen, dat
adres staat dan met "toestemming" op de lijst terwijl die persoon niets deed. Wil je
dat sluiten, dan heb je een mailprovider nodig (Brevo is gratis tot 300 mails/dag):
een `bevestigd`-kolom erbij, een bevestigingsmail met een unieke link, en alleen
bevestigde adressen laten meetellen.

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
