# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

| Command             | Doet                                                    |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server op http://localhost:3000 — **zonder `/api`** |
| `npm run preview`   | `next build && wrangler dev` — de enige manier om `/api` lokaal te draaien |
| `npm run build`     | Productiebuild                                          |
| `npm run deploy`    | `next build && wrangler deploy`                         |
| `npm run start`     | Productieserver (na build)                              |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | `tsc --noEmit` voor de site **en** voor `worker/`        |
| `npm run typegen`   | Genereert de `PageProps`/`LayoutProps` route-types      |
| `npm run cf-typegen`| Genereert `Env` uit de bindings in `wrangler.jsonc`     |
| `npm run images`    | Genereert de WebP-varianten in `public/images/generated` |
| `npm run hero-video`| Bouwt `public/videos/hero-compilatie.mp4` + poster-frame |
| `npm run hero-video:web` | Leidt daaruit de WebM en het WebP-poster af        |

`npm run typecheck` faalt op een verse clone tot twee gegenereerde bestanden bestaan —
draai eerst `npm run typegen` (of `dev`/`build`) én `npm run cf-typegen`.

Er is **geen testrunner en geen testsuite**. `lint` + `typecheck` + een build zijn de
volledige verificatie; `npm run build` is de scherpste check, omdat de contentvalidatie
in [content.ts](src/lib/content.ts) pas bij het bundelen draait.

## Architectuur

Elke pagina is statisch (`output: "export"`) en wordt door Cloudflare rechtstreeks van
het netwerk geserveerd. De **enige** servercode staat in `worker/` en draait uitsluitend
op `/api/*` — zie [Giveaway](#giveaway-inschrijvingen-worker--d1) onderaan. Raakt een
wijziging aan de rest van de site, dan is er dus nog steeds geen backend in het spel.

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
| `giveaway.json`         | Copy en einddatum van de giveaway + Turnstile site key     |
| `privacy.json`          | Tekst van de privacyverklaring                            |
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

Alles is een server component, op deze na: `navbar.tsx`, `ui/theme-toggle.tsx`,
`home/hero-video.tsx`, en de bladeren van het formulier en het beheer —
`giveaway/giveaway-form.tsx` (+ `use-turnstile.ts`) en `admin/*`. Houd dat zo — nieuwe
interactiviteit hoort in een klein client-blad, niet door `"use client"` naar boven te
schuiven. `giveaway/page.tsx` en `admin/page.tsx` zijn dan ook server components die
enkel het client-blad renderen; daarom kunnen ze nog steeds `metadata` exporteren.

### Hydration: formatteer datums en prijzen handmatig

[src/lib/utils.ts](src/lib/utils.ts) formatteert datums en bedragen met eigen
Nederlandse maandtabellen en UTC-getters in plaats van `Intl`, zodat server en browser
byte-voor-byte hetzelfde produceren. Gebruik `formatDateNumeric`, `formatDateLong`,
`splitDate`, `nightsBetween`, `formatAmount`, `formatPrice` — introduceer hier geen
`Intl.DateTimeFormat` of `toLocaleString`.

### Conversie loopt volledig via WhatsApp

Reserveren en vragen stellen loopt volledig via WhatsApp; het enige formulier op de site
is de giveaway-inschrijving. `whatsappUrl(message?)` in `utils.ts` bouwt een `wa.me`-link
met voorgevuld bericht; het nummer staat één keer in `site.json` onder `whatsapp`.
`WhatsAppCta` is het blok onderaan reis- en contactpagina, `WhatsAppButton` de losse knop
— het bericht geef je mee op de plek van aanroep.

### UI-primitieven

- `Section` heeft een `spacing`-prop (`default` / `continue` / `tight` / `none`).
  Overschrijf de padding **niet** via `className`: de standaard bevat een `lg:`-variant
  die in de cascade van een losse `pt-0` wint.
- `Button` rendert `<button>`, `<Link>` of `<a>` afhankelijk van `href`; externe links
  (`http`, `mailto`, `tel`) omzeilen de router automatisch.
- `Field` en `Checkbox` in [field.tsx](src/components/ui/field.tsx) zijn de enige
  formuliervelden. Ze zetten géén eigen focus-ring: die komt uit de globale
  `:focus-visible`-regel in `globals.css`, en twee ringen over elkaar zien er rommelig
  uit. Foutkleuren lopen via de tokens `danger` en `danger-soft`.
- Iconen zijn inline SVG's in [icons.tsx](src/components/ui/icons.tsx). De `IconKey`-union
  in `types.ts` en de `INCLUSION_ICONS`-map moeten synchroon blijven met de `icon`-waarden
  in `inclusions.json`.

### Next.js 16 specifics

`params` is een Promise: `const { slug } = await props.params`. Route-props typen met de
gegenereerde globals — `PageProps<"/reizen/[slug]">` — niet met een handgeschreven
interface. `generateStaticParams` in [reizen/[slug]/page.tsx](src/app/reizen/[slug]/page.tsx)
bouwt elke detailpagina statisch. `next.config.ts` pint de Turbopack-root, omdat er ook
een `package-lock.json` in de home-directory staat.

### Giveaway-inschrijvingen: Worker + D1

De enige servercode van het project. Deelnemers vullen `/giveaway` in, de beheerder
bekijkt ze op `/admin`; daartussen zit `worker/` met een D1-tabel `deelnemers`.

| Bestand | Doet |
| ------- | ---- |
| `worker/index.ts` | Router en handlers voor `/api/*` |
| `worker/auth.ts` | Sessiecookie (HMAC), inlogvergelijking in constante tijd |
| `worker/csv.ts` | CSV-export |
| `worker/schema.sql` | De tabel; opnieuw draaien mag (`IF NOT EXISTS`) |
| `worker/migraties/` | Genummerde wijzigingen op een database die al bestaat |
| `src/lib/leads.ts` | Validatieregels, **gedeeld** met het formulier |
| `src/lib/api.ts` | API-paden en antwoordtypes, idem |

Wat je moet weten voordat je hier iets wijzigt:

- **`leads.ts` en `api.ts` mogen het `@/*`-alias niet gebruiken.** Wrangler bundelt de
  Worker met esbuild en past de `paths` uit `tsconfig.json` daarbij niet toe; een
  alias-import breekt de Worker-build. Onderling importeren ze relatief (`./leads`).
- De browser valideert voor het gemak, **de Worker oordeelt**. Voeg je een veld toe, doe
  dat dan in `leads.ts` — dan volgen formulier en server vanzelf.
- `worker/` staat in de `exclude` van de root-`tsconfig.json` en heeft een eigen
  `worker/tsconfig.json`: die code draait op workerd en heeft geen DOM. `npm run typecheck`
  draait allebei. Het `Env`-type komt uit `npm run cf-typegen` en is dus gegenereerd —
  na een wijziging in `wrangler.jsonc` opnieuw draaien.
- `run_worker_first: ["/api/*"]` in `wrangler.jsonc` is niet optioneel. Zonder die regel
  wint `not_found_handling: "404-page"` en krijgt het formulier de 404-pagina in plaats
  van de Worker. `index.ts` valt voor al het overige terug op `env.ASSETS.fetch`.
- `compatibility_date` moet een datum zijn die de **geïnstalleerde** wrangler aankan,
  anders start `wrangler dev` niet. Verhoog hem samen met de dependency, niet los.
- `npm run dev` kent `/api` niet. Werk aan dit deel met `npm run preview`.
- Het gegenereerde `Env`-type zegt `string` voor elk secret, maar dat is wat de config
  belóóft — is een secret in productie niet gezet, dan is de waarde `undefined`. Vandaar
  `beheerIsIngesteld()`: ontbreken de admin-secrets of zijn ze te kort, dan geeft álles
  onder `/api/admin/` een 503. Met een lege sessiesleutel valt een cookie te vervalsen.
- Een dubbele inschrijving wordt afgevangen met `ON CONFLICT (email) DO NOTHING` plus
  `meta.changes === 0`, niet door de tekst van een D1-foutmelding te lezen.
- Een leeg telefoonveld gaat als `NULL` de database in, nooit als lege string.
- **Inloggen vergelijkt gebruikersnaam én wachtwoord, altijd allebei.** Ze gaan via
  `Promise.all` zodat er geen vroege exit is: stoppen bij de eerste mismatch verraadt via
  de responstijd welk veld goed was. Eén melding voor beide fouten, om dezelfde reden.
- De sessiecookie tekent over vervalmoment **plus** een vingerafdruk van de huidige
  inloggegevens (`inlogVingerafdruk`). Daardoor logt het wijzigen van gebruikersnaam of
  wachtwoord iedereen uit. Verwijder die binding niet — dan blijft een gestolen cookie
  acht uur geldig, óók nadat je het wachtwoord juist vanwege een lek hebt vervangen.
- De cookie heet `__Host-tt_admin`. Dat voorvoegsel is functioneel: het verbiedt een
  subdomein een eigen cookie met die naam te zetten. Hernoemen breekt die bescherming.
- **Er wordt geen IP-adres bewaard**, ook niet gehasht — zie `worker/migraties/001`.
  Voeg dat niet terug toe zonder een echte reden: het is een persoonsgegeven, en een
  SHA-256 over de IPv4-ruimte is triviaal terug te rekenen.
- Security headers (waaronder de CSP) staan in `public/_headers`. Dat is de enige plek:
  bij `output: "export"` draait `headers()` uit `next.config.ts` nooit. Laadt er ooit een
  script van een nieuw domein, dan moet dat domein daar in de CSP bij.

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

De bronfoto's worden nooit rechtstreeks geserveerd. `npm run images` maakt met `sharp`
een WebP per breedte uit `scripts/image-sizes.mjs` in `public/images/generated` — een
gegenereerde map die in `.gitignore` staat. Het draait automatisch als `prebuild`, en is
incrementeel: alleen foto's die nieuwer zijn dan hun varianten worden opnieuw omgezet.
`src/lib/image-loader.ts` wijst die varianten aan; zonder loader zou een statische export
helemaal geen `srcset` opleveren en laadde elke telefoon de volle 1400px. Blijft de ladder
in `image-sizes.mjs` niet gelijk aan `deviceSizes`/`imageSizes` in `next.config.ts`, dan
vraagt de browser een bestand op dat niet bestaat.

`scripts/build-hero-video.mjs` heeft een hardgecodeerd `CLIPS_DIR` naar een lokale
Downloads-map; `npm run hero-video` draait niet zonder die constanten eerst aan te passen.
Video en poster-frame komen uit dezelfde montage en horen altijd samen vernieuwd te worden.
Draai daarna `npm run hero-video:web`: dat leidt uit die twee de WebM en het WebP-poster af
die de hero echt gebruikt. Dat script raakt de MP4 en de JPEG niet aan — nu de bronclips
weg zijn, zijn dát de enige originelen die er nog zijn.

De video staat bewust **niet** in de eerste lading: `hero-video.tsx` rendert de `<source>`
pas als een `IntersectionObserver` aanslaat. Zet daar geen `autoPlay` of vaste `src` terug —
dan haalt elke bezoeker weer 1,7 MB binnen vóór de pagina in beeld staat. Cloudflare
beantwoordt een `Range`-request bovendien met het hele bestand, dus `preload` alleen helpt
niet.

Cache-headers staan in `public/_headers`. Zonder dat bestand serveert Cloudflare álles met
`max-age=0, must-revalidate`, ook de content-gehashte bundels.

Zie [README.md](README.md) voor de volledige uitleg over content, foto's en de hero-video.
