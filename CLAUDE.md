# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

| Command             | Doet                                                    |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server op http://localhost:3000 — D1 via `initOpenNextCloudflareForDev` (lokale staat), **zonder `/api` en `/media`** |
| `npm run preview`   | `opennextjs-cloudflare build && wrangler dev` — de enige manier om `/api`, `/media` en de D1-pagina's lokaal te draaien |
| `npm run build`     | `next build` (draait eerst `prebuild`: `images` + `headers`) |
| `npm run deploy`    | `opennextjs-cloudflare build && wrangler deploy`        |
| `npm run start`     | Productieserver (na build); kent D1 niet, gebruik `preview` |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | `tsc --noEmit` voor de site **en** voor `worker/`        |
| `npm run typegen`   | Genereert de `PageProps`/`LayoutProps` route-types      |
| `npm run cf-typegen`| Genereert `Env` uit de bindings in `wrangler.jsonc`     |
| `npm run seed -- --local` | Zet de JSON-reizen en `public/images` over naar lokale D1 en R2 (zie [Overgangsfase](#overgangsfase-seed-bronbestanden)) |
| `npm run images`    | Genereert WebP-varianten van de bronfoto's uit `images.json` in `public/images/generated` |
| `npm run headers`   | Schrijft `public/_headers` uit `worker/beveiligingsheaders.ts` |
| `npm run hero-video`| Bouwt `public/videos/hero-compilatie.mp4` + poster-frame |
| `npm run hero-video:web` | Leidt daaruit de WebM en het WebP-poster af        |

Node **>= 22.18** is vereist (`engines`): het seed-script en de build-scripts laden
`.ts`-bestanden (`foto-breedtes.ts`, `reizen.ts`, `beveiligingsheaders.ts`) rechtstreeks
via type stripping.

`npm run typecheck` faalt op een verse clone tot de gegenereerde bestanden bestaan:
draai eerst `npm run typegen` (of `dev`/`build`) én `npm run cf-typegen`. Kopieer ook
`.dev.vars.example` naar `.dev.vars` (staat in `.gitignore`): `wrangler types` leest daar
de namen van de secrets uit en `wrangler dev` de waarden. Voor `npm run preview` moet
bovendien de lokale D1 bestaan (`worker/schema.sql` en `worker/migraties/*` toepassen met
`wrangler d1 execute taalibtravels-leads --local --file=…`), en `preview` bouwt eerst
`.open-next/`, dat de Worker importeert.

Er is **geen testrunner en geen testsuite**. `lint` + `typecheck` +
`npx opennextjs-cloudflare build` zijn de volledige verificatie; die laatste is de
scherpste check, omdat hij de productiebundel bouwt die ook echt draait.

**Windows:** een gestopte `wrangler dev` laat soms een `workerd`-proces achter dat
`.open-next/assets` vergrendelt; de volgende OpenNext-build faalt dan met `EBUSY`.
Stop die processen eerst en bouw dan opnieuw.

## Architectuur

De site draait als **OpenNext op Cloudflare Workers** (`@opennextjs/cloudflare`, exact
vastgepind op de versie die bij Next 16.2 en wrangler 4.121 past — upgrade Next en
wrangler samen met hem). Er is geen `output: "export"` meer: pagina's worden per
verzoek gerenderd en lezen reizen en foto's uit **D1**; de foto-bestanden staan in **R2**.
Wat in het beheerportaal verandert, is dus direct live, zonder build of deploy.

`worker/index.ts` is de `main` van de Worker en handelt een verzoek in deze volgorde af:

1. `/media/*` → `worker/media.ts` serveert een foto uit R2 (publiek, geen sessie);
2. `/api/*` → de API-handlers (giveaway, login, beheer), achter de sessiepoort waar nodig;
3. al het andere → `openNext.fetch(…)` uit `.open-next/worker.js` (pagina's en 404);
4. op elk antwoord dat zo ontstaat zet `metBeveiligingsheaders` de beveiligingsheaders.

Statische bestanden (`/_next/static`, `public/`) serveert Cloudflare rechtstreeks uit
`.open-next/assets` (binding `ASSETS`), zonder de Worker; hun headers komen uit
`public/_headers` (zie [Headers](#headers)).

### Content: JSON voor het vaste, D1 + R2 voor het beheerde

| Waar | Wat |
| ---- | --- |
| D1 `reizen`, `afbeeldingen`, `galerij` | Alle reizen, foto's en de homepagegalerij — bewerkt in het beheerportaal |
| R2 (`MEDIA`) | De foto-bestanden: `fotos/<id>/<breedte>.webp` en `fotos/<id>/og.jpg` |
| `src/data/{site,navigation,faq,giveaway,privacy}.json` | Wat vast blijft |
| `src/data/inclusions.json` | Alleen nog de **voorstellen** in het reisformulier; een reis bewaart zijn eigen inclusies |

Vaste teksten wijzig je nog steeds in JSON zonder een component aan te raken. Reizen en
foto's wijzig je in het portaal, nooit in de code.

Twee modules, bewust gescheiden:

- [src/lib/content.ts](src/lib/content.ts) bevat alleen de **vaste** JSON (`SITE`,
  `NAV_LINKS`, `FAQ`, `GIVEAWAY`, `PRIVACY`) en is synchroon. Het bestand belandt via de
  navbar en `utils.ts` in de **browserbundel**; een D1-lezer erin sleept servercode mee.
  Daarom staan de lezers daar niet.
- [src/lib/trips.ts](src/lib/trips.ts) is `server-only` en levert de lezers: `getTrips`,
  `getTripBySlug`, `getNextTrip`, `getGallery`. Ze lezen `env.DB` per verzoek en zijn per
  verzoek ontdubbeld met `cache()`. De query's zelf staan in `src/lib/reizen-db.ts`.

Importeer nooit een bestand uit `src/data` rechtstreeks in een component, en importeer
`trips.ts` nooit vanuit een client component (de build breekt dan, bedoeld).

- **Pagina's die D1 lezen zijn `export const dynamic = "force-dynamic"`.** Er is geen
  incrementele cache geconfigureerd: een vooraf gerenderde pagina zou tot de volgende
  deploy blijven staan, met `s-maxage=31536000`. Dat geldt voor `/`, `/reizen`,
  `/reizen/[slug]` en `sitemap.ts`; een nieuwe pagina die `trips.ts` aanroept krijgt
  dezelfde regel. Pagina's zonder D1 (`/giveaway`, `/contact`, `/privacy`, `robots.ts`)
  blijven vooraf gerenderd.
- `src/app/error.tsx` vangt een pagina die niet rendert (in de praktijk: D1 onbereikbaar)
  en toont een nette foutpagina met een WhatsApp-uitweg.
- Eén kapotte reisrij (onleesbare JSON-kolom, verdwenen foto) legt de lijst niet plat:
  `reizen-db.ts` slaat hem over in de publieke lezers; alleen het beheer (`strikt`)
  krijgt de fout te zien.
- De homepage-hero is niet instelbaar: `getNextTrip` pakt de eerste reis die nog niet
  terug is — nu per verzoek, dus de hero schuift vanzelf op. Zijn alle reizen geweest,
  dan blijft de laatste staan.
- `status: "draft"` verbergt een reis publiek (404 op de detailpagina, weg uit lijst en
  sitemap); het beheer ziet hem wel.
- `src/cloudflare-env.d.ts` breidt de globale `CloudflareEnv` uit met `DB`. Het
  root-tsconfig sluit het gegenereerde `worker-configuration.d.ts` uit, zodat
  workerd-globals de DOM-types niet vervuilen.

### Beheerportaal (`/admin`)

Drie tabs: Deelnemers, Reizen, Foto's (de homepagegalerij zit bij Foto's). Regels die de
code afdwingt en die je niet moet "verzachten":

- **De slug staat vast** na het aanmaken: hij is de URL, wijzigen breekt links. `PUT`
  weigert een body waarvan de slug van het pad afwijkt.
- **Een foto die in gebruik is, wordt niet verwijderd** (omslag of galerij van een reis, of
  de homepagegalerij): de API geeft 409 met de titels. Er wordt nooit stilzwijgend ergens
  weggehaald.
- **Een galerij heeft exact zes foto's**, per reis en voor de homepage (`valideerReis`,
  `PUT /api/admin/galerij`). Een reis zonder eigen `gallery` valt terug op de
  homepagegalerij.
- De browser valideert vroeg, **de Worker oordeelt** (`valideerReis` in
  `src/lib/reizen.ts`). Een reis schrijven controleert expliciet dat omslag- en
  galerij-id's bestaan, niet door een D1-foutmelding te lezen.
- **Twee Origin-controles.** De nieuwe schrijfroutes (reizen, afbeeldingen, galerij) eisen
  een `Origin`-header gelijk aan de eigen origin (`vanEigenOriginStrikt`; ontbreekt hij,
  dan 403). De oude routes (login, giveaway, deelnemers) gebruiken de soepele
  `vanEigenOrigin`, die een ontbrekende header toelaat. Maak de oude niet strikter zonder
  de gevolgen te kennen, en de nieuwe niet soepeler. Curl-tests tegen de nieuwe routes
  hebben dus altijd een `Origin` nodig.
- Een upload bevat precies de breedtes uit `ALL_WIDTHS` (WebP, ≤ 1 MB per stuk, RIFF/WEBP-magic
  gecontroleerd) plus één `og.jpg`. De id wordt server-side gegenereerd; niets van de
  client wordt een R2-sleutel. `/media` serveert alleen sleutels die op `fotos/<id>/…`
  passen. Gaat een upload halverwege fout, dan wordt het al geschrevene opgeruimd.

### Overgangsfase: seed-bronbestanden

`npm run seed` (`scripts/seed-bestaande-content.mjs`) zet de oorspronkelijke JSON en
foto's eenmalig over naar D1 en R2, met dezelfde validatie als de Worker. Het leest nog
`src/data/trips/*.json`, `src/data/gallery.json`, `src/data/images.json` en
`public/images/*`. Dat zijn **seed-bronbestanden**: de site zelf leest ze niet meer. Ze
blijven staan tot de productie-seed is gedraaid en gecontroleerd; daarna worden ze samen
met het script verwijderd (zie het plan, Task 9b). Wijzig ze niet meer: een D1-rij wordt
door de seed nooit overschreven.

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
interface. `next.config.ts` pint de Turbopack-root, omdat er ook
een `package-lock.json` in de home-directory staat.

### Worker + D1 + R2

De servercode van het project: de giveaway-inschrijving, het beheerportaal en `/media`.
Deelnemers vullen `/giveaway` in, de beheerder werkt op `/admin`; daartussen zit
`worker/` met D1 (`deelnemers`, `reizen`, `afbeeldingen`, `galerij`) en R2 (de foto's).

| Bestand | Doet |
| ------- | ---- |
| `worker/index.ts` | Entry: volgorde /media, /api, OpenNext, headers; router voor giveaway, login en deelnemers |
| `worker/reizen.ts` | `/api/admin/reizen` (lijst, aanmaken, lezen, wijzigen, verwijderen) |
| `worker/afbeeldingen.ts` | `/api/admin/afbeeldingen` (upload, alt-tekst, verwijderen) en `/api/admin/galerij` |
| `worker/media.ts` | `/media/fotos/…` uit R2, met `ETag` en `immutable` |
| `worker/http.ts` | Gedeelde antwoordhelpers: `json`, `leesJson`, `methodeNietToegestaan`, beide Origin-controles |
| `worker/beveiligingsheaders.ts` | De ene definitie van alle headers; zie [Headers](#headers) |
| `worker/auth.ts` | Sessiecookie (HMAC), inlogvergelijking in constante tijd |
| `worker/csv.ts` | CSV-export |
| `worker/schema.sql` | De tabellen; opnieuw draaien mag (`IF NOT EXISTS`) |
| `worker/migraties/` | Genummerde wijzigingen op een database die al bestaat (`002` maakt `reizen`, `afbeeldingen`, `galerij`) |
| `worker/open-next.d.ts` | Typedeclaratie voor `../.open-next/worker.js`, dat pas na een OpenNext-build bestaat |
| `src/lib/leads.ts` | Validatieregels van de inschrijving, **gedeeld** met het formulier |
| `src/lib/reizen.ts` | Validatie en vorm van een reis (`valideerReis`, `ReisInvoer`), gedeeld met het portaal en het seed-script |
| `src/lib/reizen-db.ts` | D1-query's voor reizen, foto's en galerij; gebruikt door de Worker én door `trips.ts` |
| `src/lib/foto-breedtes.ts` | De breedteladder en de `og`-maten, gedeeld met Next, de browser, de Worker en de scripts |
| `src/lib/api.ts` | API-paden en antwoordtypes, idem |

Wat je moet weten voordat je hier iets wijzigt:

- **`leads.ts`, `api.ts`, `reizen.ts`, `reizen-db.ts` en `foto-breedtes.ts` mogen het
  `@/*`-alias niet gebruiken.** Wrangler bundelt de Worker met esbuild en past de `paths`
  uit `tsconfig.json` daarbij niet toe; een alias-import breekt de Worker-build. Onderling
  importeren ze relatief (`./leads`). `foto-breedtes.ts` en `reizen.ts` hebben bovendien
  geen imports en alleen wegstripbare typen: Node laadt ze rechtstreeks (scripts).
- De browser valideert voor het gemak, **de Worker oordeelt**. Voeg je een veld toe, doe
  dat dan in `leads.ts` of `reizen.ts` — dan volgen formulier en server vanzelf.
- `worker/` staat in de `exclude` van de root-`tsconfig.json` en heeft een eigen
  `worker/tsconfig.json`: die code draait op workerd en heeft geen DOM. `npm run typecheck`
  draait allebei. Het `Env`-type komt uit `npm run cf-typegen` en is dus gegenereerd —
  na een wijziging in `wrangler.jsonc` opnieuw draaien.
- **Er is geen `run_worker_first` en geen `not_found_handling`** meer: bestanden uit
  `assets` winnen vanzelf, al het andere komt bij `worker/index.ts` en de 404 rendert Next
  zelf. Voeg ze niet terug; `not_found_handling: "404-page"` zou de Worker voorbijgaan.
- `compatibility_date` moet een datum zijn die de **geïnstalleerde** wrangler aankan,
  anders start `wrangler dev` niet. Verhoog hem samen met de dependency, niet los. De
  flags `nodejs_compat` en `global_fetch_strictly_public` zijn voor OpenNext nodig.
- Bindings: `DB` (D1), `MEDIA` (R2, bucket `taalibtravels-media`), `ASSETS`, de twee
  ratelimits. Hernoem ze niet zonder de code mee te nemen.
- `npm run dev` leest D1 via `initOpenNextCloudflareForDev` (in `next.config.ts`, lokale D1-staat), maar kent `/api` en `/media` niet. Werk aan dit deel met `npm run preview`.
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
  Het vereist `Secure`, dus een andere browser dan Chromium op `http://localhost` krijgt
  hem niet; test dan met `wrangler dev --local-protocol https`.
- **Er wordt geen IP-adres bewaard**, ook niet gehasht — zie `worker/migraties/001`.
  Voeg dat niet terug toe zonder een echte reden: het is een persoonsgegeven, en een
  SHA-256 over de IPv4-ruimte is triviaal terug te rekenen.

### Headers

De headers (CSP, `nosniff`, referrer- en permissions-policy, cache-regels, het beheer
zonder cache en met `noindex`) staan op **één plek**: `worker/beveiligingsheaders.ts`.
Daaruit komen twee uitvoerwegen:

- `scripts/build-headers.mjs` schrijft `public/_headers` voor de statische bestanden die
  Cloudflare zelf serveert. Dat bestand is **gegenereerd en staat in `.gitignore`**; het
  draait als `prebuild`, dus ook binnen `opennextjs-cloudflare build`. Pas het nooit met
  de hand aan. Wie `--skipNextBuild` gebruikt, slaat `prebuild` over en levert zonder
  `_headers` uit.
- `metBeveiligingsheaders` in `worker/index.ts` zet de beveiligingsheaders (niet de
  cacheregels) op elk antwoord van de Worker: pagina's, API en 404. `headers()` in
  `next.config.ts` wordt daarvoor niet gebruikt.

De CSP staat `'wasm-unsafe-eval'` alleen toe op `/admin` (de WebP-fallback van het
uploadformulier, zie Foto's); `'unsafe-inline'` bij `script-src` is nodig voor het
themascript en Next's hydratie. Laadt er ooit een script van een nieuw domein, dan moet
dat domein in de CSP in `beveiligingsheaders.ts`. Zet geen tweede, aparte CSP in
`_headers`: Cloudflare voegt dan twee beleiden samen en de strengste wint.

## Conventies

- **Alles is Nederlands**: UI-copy, content, en ook de code-commentaren en JSDoc. Schrijf
  nieuwe commentaren in het Nederlands en leg het *waarom* vast, niet het *wat* — dat is
  de bestaande stijl in dit project.
- Imports gaan via het `@/*`-alias naar `src/`.

## Foto's en video

Foto's beheer je in het portaal (tab Foto's); de code raak je daarvoor niet aan. Een foto
heeft in D1 een id, `alt`, en de **echte** `width`/`height` van de bron — die bepalen de
gereserveerde ruimte, een verkeerde waarde laat de pagina verspringen. Houd elke galerij
op **zes** liggende (3:2) foto's: met de grote tegel erbij vult dat precies het raster, bij
een ander aantal blijft er een lege cel over (`valideerReis` weigert het).

In R2 staat per foto `fotos/<id>/<breedte>.webp` voor elke breedte uit
[src/lib/foto-breedtes.ts](src/lib/foto-breedtes.ts) plus `fotos/<id>/og.jpg` (1200px
JPEG, voor linkvoorbeelden: niet elke previewer leest WebP als `og:image`). Publiek zijn
dat `/media/fotos/<id>/<breedte>.webp` en `/media/fotos/<id>/og.jpg`; een `ETag` en
`immutable` maken ze eeuwig cachebaar, omdat een id nooit hergebruikt wordt. In D1 staat
`src` als het basispad `/media/fotos/<id>` zonder breedte.

`foto-breedtes.ts` is de **enige** plek met de breedteladder. Vier kanten lezen hem en
moeten gelijk blijven: `next.config.ts` (`deviceSizes`/`imageSizes`, voor de `srcset`), het
uploadformulier in de browser, `worker/afbeeldingen.ts` (eist precies deze breedtes) en de
scripts (`scripts/image-sizes.mjs` geeft hem door). Lopen ze uiteen, dan vraagt de browser
een bestand op dat niet bestaat.

De browser maakt de varianten **vóór** het uploaden (canvas, EXIF-rotatie gerespecteerd,
bron begrensd op 4000px). Kan de browser geen WebP uit een canvas halen (oudere Safari/iOS),
dan valt `upload-foto.ts` terug op `@jsquash/webp` (WASM, lazy geladen, dus alleen op
`/admin` en alleen als het nodig is). Daarom staat `'wasm-unsafe-eval'` in de CSP van
`/admin`. Gaat ook dat fout, dan krijgt de beheerder een eerlijke melding in plaats van een
half geüploade foto.

`src/lib/image-loader.ts` wijst voor `next/image` de variant aan (`/media/fotos/<id>` →
`…/<breedte>.webp`); zonder loader komt er geen `srcset` en laadt elke telefoon de volle
1600px. Alleen `public/images/*.jpg|png` met een variant gaat nog naar
`/images/generated/<naam>-<breedte>.webp`; al het andere (logo, `og-image.jpg`, externe
URL's) gaat ongewijzigd terug.

`npm run images` (`scripts/build-images.mjs`, `prebuild` én `dev`) maakt die laatste
varianten met `sharp` uit de bronfoto's die in `images.json` staan. De live site gebruikt
ze niet meer: alle foto's komen uit R2. Het script en `images.json` bestaan nog omdat de
seed ze nodig heeft; na de productie-seed vervalt de stap (zie Overgangsfase).

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
niet. Video's en `public/images` zijn vaste bestanden met een vaste naam; hun cacheregels
komen uit het gegenereerde `public/_headers` (zie Headers).

Zie [README.md](README.md) voor de volledige uitleg over het portaal en de hero-video.
