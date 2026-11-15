# Beheerportaal voor reizen en foto's — ontwerp

Datum: 2026-11-15 · Status: ter goedkeuring

## Waarom

De beheerder van TaalibTravels (niet-technisch) wil zelf de website kunnen bijhouden zonder
een ontwikkelaar: reizen aanmaken, wijzigen en verwijderen, en foto's toevoegen en
verwijderen. Na het inloggen als admin en het opslaan moet de wijziging **direct live**
staan voor bezoekers.

Nu staan reizen en foto's als JSON en bestanden in de repo en worden ze bij `npm run build`
in statische pagina's gebakken. Elke wijziging vraagt dus een ontwikkelaar, een build en
een deploy.

## Doelen

- Admin kan reizen aanmaken, bewerken, verbergen (concept) en verwijderen.
- Admin kan foto's uploaden en verwijderen, en kiest per reis de omslagfoto en de
  galerij (zes foto's), en de gedeelde galerij van de homepage.
- Alles wordt in een Cloudflare-database (D1) en -opslag (R2) bewaard en daaruit
  opgehaald. Wijzigingen zijn direct zichtbaar.
- Reispagina's houden eigen metadata (titel, beschrijving, voorbeeldkaart voor WhatsApp)
  en blijven snel.
- Alleen bereikbaar na inloggen met het bestaande `/admin`-login.

## Niet-doelen

- Teksten van de rest van de site bewerken (FAQ, giveaway, privacy, bedrijfsgegevens,
  navigatie). Die blijven JSON; mogelijk een volgende fase.
- De vaste structuur van de reispagina wijzigen (volgorde van de blokken, vormgeving).
  Wel bewerkbaar: alle inhoud, zie "Reispagina volledig bewerkbaar".
- Meerdere admins, rollen, wijzigingsgeschiedenis, ongedaan maken.
- Foto's bijsnijden of bewerken in het portaal.
- Hero-video, logo en og-image beheren; die blijven in `public/`.

## Anti-doelen (zou mislukt zijn, ook als het technisch werkt)

- Admin kan de site breken met ongeldige invoer (dubbele slug, foto die niet bestaat,
  galerij met een ander aantal dan zes).
- Een foto verwijderen die nog op een reis of de homepage staat, waardoor er een gat valt.
- Een zwakkere beveiliging dan het bestaande beheer, of een publiek schrijfpad.
- Een merkbaar tragere site voor bezoekers.

## Randvoorwaarden

- Bestaande conventies uit CLAUDE.md gelden: Nederlandse copy en commentaar, semantische
  design tokens, handmatige datum- en prijsopmaak (geen `Intl`), `Field`/`Checkbox` als
  formuliervelden, client components alleen als bladeren.
- `src/lib/leads.ts` en `src/lib/api.ts` mogen het `@/*`-alias niet gebruiken; nieuwe
  gedeelde validatie die de Worker gebruikt volgt dezelfde regel.
- Bestaande beveiliging blijft staan: sessiecookie `__Host-tt_admin`, vingerafdruk van
  inloggegevens, `beheerIsIngesteld()`, ratelimits. Er wordt nog steeds geen IP bewaard.
- De 3 bestaande reizen en alle bestaande foto's moeten behouden blijven.

## Aanpak

Drie opties zijn overwogen:

| | Aanpak | Voor | Tegen |
|---|---|---|---|
| A | Statische site houden; reizen in de browser uit `/api` ophalen | Weinig ombouw | Geen eigen metadata of WhatsApp-voorbeeldkaart per nieuwe reis; slechter voor zoekmachines |
| **B** | **Next.js op Cloudflare Workers via OpenNext; pagina's bouwen bij elk verzoek uit D1; foto's uit R2** | **Direct live; eigen metadata per reis; volledige HTML voor bezoekers** | **Grootste ombouw: weg van `output: "export"`** |
| C | Portaal commit naar GitHub en triggert een nieuwe build | Site blijft statisch | Wachttijd van minuten, dus niet "direct live" |

**Gekozen: B.** A en C voldoen niet aan de twee eisen (direct live én werkende gedeelde
reislinks). De wensen van de opdrachtgever sluiten ze uit.

## Ontwerp

### Architectuur

- Next.js draait op Cloudflare Workers via `@opennextjs/cloudflare`. `output: "export"`
  vervalt. Eén Worker bedient alles: `/api/*` wordt afgehandeld door de bestaande
  `worker/index.ts`-code; de rest gaat naar de OpenNext-handler.
- Reispagina's, overzicht, homepage en sitemap worden **dynamisch** gerenderd en lezen
  bij elk verzoek uit D1. Er komt bewust geen paginacache of herhaalde validatie
  (cache-invalidatie is extra complexiteit zonder aantoonbare winst bij dit verkeer).
  Mocht de snelheid tegenvallen, dan kan later gecachet worden.
- `generateStaticParams` voor reizen vervalt; een onbekende slug geeft `notFound()`.
- Bestaande D1-database (`DB`) wordt hergebruikt; er komt een R2-bucket (`MEDIA`) bij.

### Reispagina volledig bewerkbaar

Elk stuk inhoud op `/reizen/[slug]` en op de reiskaart is per reis in te stellen:

| Op de pagina | Veld in het portaal |
|---|---|
| Titel (kop), ondertitel (paginatitel en kaart) | `title`, `subtitle` |
| Korte tekst onder de kop en op de kaart | `summary` |
| Omslagfoto | `cover_image` uit de fotobibliotheek |
| Vertrek- en terugkomstdatum | `departure_date`, `return_date` |
| "Inclusief"-regels | Per reis een vrije lijst: **label, toelichting, icoon** (uit de 8 bestaande iconen), met volgorde. Eerdere regels uit `inclusions.json` staan klaar als snelkeuze, maar zijn daarna per reis aanpasbaar |
| Programma / "Over deze reis" | Lijst van alinea's, toevoegen, verwijderen en verslepen |
| Prijs, notitie onder de prijs, "betalen in termijnen" | `price_amount`, `price_note`, `price_installments` |
| Fotogalerij (zes foto's) | `gallery`, of leeg voor de gedeelde galerij |
| Plekken beschikbaar op de kaart | `spots_total`, `spots_left` |
| Voor wie (broeders, zusters, ...) en zichtbaarheid | `audience`, `status` |
| Tekst van het reserveerblok onderaan | Wordt automatisch uit titel en termijnoptie opgebouwd, zoals nu |

De vaste kopjes en knoppen ("Wat zit erbij", "Wat kost het", "Reserveer je plek", het
voorgevulde WhatsApp-bericht) blijven in de code: ze zijn voor elke reis gelijk. Bij
deze ombouw wordt de typfout "BeeldEN" in het kopje boven de galerij hersteld.

### Data (D1)

Nieuwe tabellen via een genummerde migratie in `worker/migraties/`:

- `afbeeldingen`: `id` (slug), `r2_sleutel`, `alt`, `width`, `height`, `aangemaakt`.
- `reizen`: `slug` (PK, na aanmaken niet meer wijzigbaar), `title`, `subtitle`, `summary`,
  `description` (JSON-array van paragrafen), `departure_date`, `return_date`, `price_amount`,
  `price_installments`, `price_note`, `inclusions` (JSON-array van `{label, description?,
  icon}` — per reis, niet meer gedeeld), `cover_image` (FK naar `afbeeldingen`), `gallery` (JSON-array van
  zes id's, of `NULL` = gedeelde galerij), `audience`, `status`, `spots_total`,
  `spots_left`, `updated_at`.
- `galerij`: `positie`, `afbeelding_id` — de gedeelde galerij van de homepage (zes rijen).

Verwijderen van een foto wordt geweigerd zolang ze op een reis of in de homepagegalerij
staat; de foutmelding noemt waar. Alleen zo kan het publieke pad zonder extra controles
vertrouwen dat verwijzingen bestaan.

### Foto's (R2)

- Browser verkleint de foto vóór het uploaden en maakt dezelfde breedtes als de ladder in
  `scripts/image-sizes.mjs` (WebP). De Worker valideert type, maximale grootte en
  afmetingen en schrijft ze naar R2 onder een unieke, niet-raadbare sleutel.
- De Worker serveert `/media/<sleutel>` rechtstreeks uit R2 met `immutable`-cacheheaders
  (sleutel is uniek, dus nooit verouderd).
- `src/lib/image-loader.ts` wijst voortaan naar `/media/…` voor beheerde foto's; losse
  assets in `public/` (logo, hero, og) blijven werken zoals nu.

### API (Worker, achter de bestaande sessiepoort)

`/api/admin/reizen` (GET lijst, POST aanmaken), `/api/admin/reizen/:slug` (GET, PUT,
DELETE), `/api/admin/afbeeldingen` (GET, POST upload), `/api/admin/afbeeldingen/:id`
(DELETE, PATCH alt-tekst), `/api/admin/galerij` (GET, PUT).

- Validatieregels staan in één gedeeld, alias-vrij bestand (zoals `leads.ts`) en worden
  zowel door het formulier als door de Worker gebruikt; **de Worker oordeelt**.
- Alle schrijvende routes controleren dat het verzoek van dezelfde oorsprong komt
  (`Origin`) en JSON/multipart is, bovenop de `SameSite`-cookie.

### Portaal (UI)

`/admin` krijgt tabbladen: **Deelnemers** (bestaand), **Reizen**, **Foto's**. Alles is een
client-blad onder een server-page, conform de bestaande conventie.

- Reizen: lijst met status; formulier met alle velden uit de tabel hierboven, inclusies
  als bewerkbare lijst (met snelkeuze uit `inclusions.json`), omslagfoto en galerij kiezen uit de fotobibliotheek (precies zes
  vereist), opslaan, verbergen/tonen, verwijderen met bevestiging.
- Foto's: uploaden (meerdere tegelijk), alt-tekst invullen, verwijderen.

### Overgang

Een eenmalig script zet de huidige JSON en `public/images`-foto's in D1 en R2. Daarna
verdwijnen `trips/*.json`, `gallery.json` en `images.json` en de trip-delen van
`content.ts` worden asynchrone D1-lezers (`getTrips`, `getTripBySlug`, `getNextTrip`,
`getGallery`). `SITE`, `NAV_LINKS`, `FAQ` e.d. blijven ongewijzigd.

## Gemaakte keuzes die nog niet door de opdrachtgever zijn bevestigd

(Mijn keuzes; zeg het als je het anders wilt.)

1. Dynamisch renderen zonder cache (simpelheid boven snelheid).
2. De slug staat vast na het aanmaken, omdat een wijziging bestaande links breekt.
3. Foto's verwijderen die in gebruik zijn wordt geweigerd, niet stilzwijgend overal weggehaald.
4. Browser-side verkleinen naar de bestaande ladder, geen extern beeldservice.
5. "Inclusief"-regels worden per reis opgeslagen en vrij bewerkt (label, toelichting,
   icoon). `inclusions.json` blijft alleen bestaan als lijst met voorstellen in het portaal.
6. De vaste kopjes en knoppen van de reispagina blijven in de code, omdat ze voor elke
   reis gelijk zijn. Per reis aanpasbaar maken kan, maar vergroot het formulier flink.

## Risico's en te onderzoeken

- **OpenNext met Next 16.2**: eerst een korte spike (hello-page + D1-lezing + eigen
  `/api`-routing in dezelfde Worker) voordat de rest wordt gebouwd.
- **Beveiligingsheaders**: `public/_headers` geldt alleen voor statische assets. De CSP
  en andere headers moeten ook op dynamische responses komen (middleware of Worker).
- **Foto-upload** naar de Worker moet binnen de requestlimiet blijven; zo nodig uploaden
  per variant.
- **Terugvallen**: D1 Time Travel dekt de database; R2 heeft geen versiegeschiedenis,
  dus verwijderen van een foto is definitief.

## Overgelaten aan de bouwer

Exacte kolomtypes en indexen, bestandsstructuur van de nieuwe componenten, de
UI-vormgeving binnen de bestaande tokens, en de details van de uploadvolgorde.
