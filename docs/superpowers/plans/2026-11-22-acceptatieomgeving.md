# Plan: acceptatieomgeving op `acc.taalibtravels.com`

> **Team:** architect (dit document) → engineer → reviewer. De engineer werkt op een
> feature-branch (voorstel: `feat/acceptatieomgeving`, afgetakt van `feat/beheerportaal`),
> **nooit op `master`**: `master` deployt automatisch naar productie.
> Er is geen testrunner; verificatie = `npm run lint`, `npm run typecheck`,
> `npx opennextjs-cloudflare build` plus de dry-runs in [Verificatie](#7-verificatie).

## 0. Doel en uitgangspunten

- Branch **`acceptatie-master`**: elke push bouwt en deployt automatisch naar de Worker-omgeving
  **`acceptatie`** (Worker `taalibtravels-acceptatie`) op **`acc.taalibtravels.com`**.
- Zelfde code, zelfde build, zelfde config als productie. Alleen de bindings, vars en het domein
  verschillen. Alles wat productie kan, kan acceptatie: pagina's uit D1, `/media` uit R2, giveaway
  (Turnstile, ratelimit), beheerportaal (Access + login), migraties.
- `master` blijft productie (`taalibtravels.com`, gedeployd door de bestaande Workers Builds-koppeling).
  Na akkoord van de klant wordt `acceptatie-master` naar `master` gemerged; dat blijft een bewuste
  handeling van de gebruiker. Productie-migraties blijven ook handmatig.
- Eigen D1 `taalibtravels-leads-acc`, eigen R2 `taalibtravels-media-acc`, eigen admin-secrets, eigen
  Access-applicatie op de hele host, eigen ratelimit-`namespace_id`'s, eigen Turnstile-hostnaam.
- Productie heeft nu al: D1 met migratie 001 en 002 + seed (3 reizen, 23 foto's, galerij), R2 met de
  foto's, 209 deelnemers. De nieuwe (OpenNext-)code staat nog niet live. Acceptatie is dus ook de
  eerste plek waar de OpenNext-build in CI draait; dat is een voordeel, geen bijzaak.

Niets hier heropent het ontwerp van het beheerportaal (`docs/superpowers/specs/2026-11-15-beheerportaal-design.md`).
Dat zegt alleen dat schemawijzigingen als genummerde migratie in `worker/migraties/` komen; dat blijft zo.

**Bestandslocatie:** de opdracht noemde `docs/plannen/acceptatieomgeving.md`; de projectconventie
voor architectplannen is `docs/superpowers/plans/`. Dit plan staat daarom hier.

---

## 1. `wrangler.jsonc`: `env.acceptatie`

### Wat erft en wat niet (gecontroleerd in `node_modules/wrangler/config-schema.json`, wrangler 4.121)

| Sleutel | Erft van top-level? | Gevolg |
| --- | --- | --- |
| `name`, `main`, `compatibility_date`, `compatibility_flags`, `assets`, `observability` | ja | niet herhalen; naam wordt automatisch `taalibtravels-acceptatie` |
| **`routes`** | **ja** | **Gevaar.** Zonder eigen `routes` probeert de acceptatie-Worker `taalibtravels.com` en `www.` te claimen. Altijd expliciet overschrijven. |
| `workers_dev`, `preview_urls` | ja | erven `false`; toch expliciet herhalen, zodat niemand ze bij het lezen van het blok mist |
| `vars` | nee | `TEAM_DOMAIN` én `POLICY_AUD` opnieuw opgeven |
| `d1_databases`, `r2_buckets`, `ratelimits` | nee | volledig opnieuw opgeven, zelfde bindingnamen |

### Exacte toevoeging

Op top-level krijgt de bestaande D1-binding er één sleutel bij (nodig voor `wrangler d1 migrations`, zie §2):

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "taalibtravels-leads",
    "database_id": "694508d6-d030-40ec-959f-9c0d933eb482",
    "migrations_dir": "worker/migraties"
  }
],
```

Onderaan, na `observability`:

```jsonc
// Acceptatie: zelfde code en build, eigen database, bucket, domein en Access-app.
// Deployt automatisch vanaf `acceptatie-master` (.github/workflows/deploy-acceptatie.yml).
// Bindings, vars en ratelimits erven NIET van hierboven; routes erven WEL, en zonder
// eigen routes zou deze Worker het productiedomein proberen over te nemen.
"env": {
  "acceptatie": {
    "routes": [{ "pattern": "acc.taalibtravels.com", "custom_domain": true }],
    "workers_dev": false,
    "preview_urls": false,
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "taalibtravels-leads-acc",
        "database_id": "<uit `wrangler d1 create`, handmatige stap 3>",
        "migrations_dir": "worker/migraties"
      }
    ],
    "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "taalibtravels-media-acc" }],
    // Eigen namespaces: met die van productie zou een klant die op acceptatie test
    // zijn eigen inlogpogingen op productie opgebruiken (de sleutel is het IP-adres).
    "ratelimits": [
      { "name": "LOGIN_LIMIT", "namespace_id": "2001", "simple": { "limit": 5, "period": 60 } },
      { "name": "SIGNUP_LIMIT", "namespace_id": "2002", "simple": { "limit": 5, "period": 60 } }
    ],
    "vars": {
      "TEAM_DOMAIN": "https://taalibtravelsdomain.cloudflareaccess.com",
      // AUD van de Access-app op acc.taalibtravels.com, NIET die van productie.
      "POLICY_AUD": "<AUD-tag van de acceptatie-app, handmatige stap 2>"
    }
  }
}
```

De engineer zet de echte `database_id` en `POLICY_AUD` erin zodra de gebruiker ze heeft aangeleverd
(handmatige stappen 2 en 3). Staat er nog een placeholder, dan faalt het dicht: de migratiestap
vindt de database niet (deploy stopt) of `/api/admin/*` geeft 403.

### Gedrag van `worker/access.ts` en `accessGoedgekeurd` op acceptatie

- Geen codewijziging. De Worker eist op `/api/admin/*` een Access-token met `aud` = `POLICY_AUD`.
  Op acceptatie is dat de AUD van de acceptatie-app, dus een token van de productie-app wordt
  geweigerd en omgekeerd. Precies wat we willen.
- **`ACCESS_UIT` wordt op acceptatie nooit gezet.** Het staat alleen in `.dev.vars`. Zou het er toch
  in belanden (bijvoorbeeld door `wrangler secret bulk .dev.vars --env acceptatie`), dan negeert de
  bestaande `CF-Ray`-controle het en logt een fout. Secrets dus altijd één voor één met
  `wrangler secret put`.
- De Access-app dekt op acceptatie de **hele host**, niet alleen `/admin*`. De Worker controleert het
  token nog steeds alleen op `/api/admin/*`; de rest wordt afgeschermd door Access zelf. Daarmee is de
  Worker-laag niet anders dan in productie, en dat is ook de bedoeling.

### `site.json` (`url` = canonical) blijft ongewijzigd

`SITE.url` (`https://www.taalibtravels.com`) zit in `content.ts`, die synchroon is en in de
browserbundel belandt; per omgeving variëren zou een tweede build of een runtime-lezer vragen, en
dan is het niet meer dezelfde build. Het is ook niet nodig:

- canonical, `og:url`, sitemap en `robots.txt` op acceptatie wijzen naar productie. Voor zoekmachines
  is dat precies het juiste signaal, mocht Access ooit wegvallen;
- de host staat volledig achter Access, dus crawlers en linkvoorbeelden zien niets;
- de Origin-controles (`vanEigenOrigin`, `vanEigenOriginStrikt`) vergelijken met de origin van het
  verzoek, niet met `SITE.url`, en werken op `acc.` dus vanzelf.

Bewust geen `OMGEVING`-var, geen noindex-header en geen "acceptatie"-banner: geen enkele eis vraagt
erom.

---

## 2. Automatische deploy

### Keuze: GitHub Actions (niet Workers Builds)

| | GitHub Actions | Workers Builds |
| --- | --- | --- |
| Configuratie | in de repo, reviewbaar | in het dashboard, onzichtbaar in code-review |
| Migraties vóór deploy, stoppen bij fout | expliciete stap | in één deploy-commando geplakt |
| Lint en typecheck als poort | ja | alleen via het buildcommando |
| Gelijktijdige deploys | `concurrency` met wachtrij | geen controle |
| Secrets | GitHub Environment met branch-restrictie | dashboard |

Productie blijft op de bestaande Workers Builds-koppeling. Dat raken we niet aan, behalve één
instelling (handmatige stap 9): **builds voor niet-productiebranches uitzetten** op de
productie-Worker. Anders bouwt en uploadt elke push naar `acceptatie-master` ook een
(niet-gedeployde) versie van de productie-Worker, met productie-bindings.

### Nieuw bestand: `.github/workflows/deploy-acceptatie.yml`

```yaml
name: Deploy acceptatie

on:
  push:
    branches: [acceptatie-master]
  workflow_dispatch:

permissions:
  contents: read

# Nooit twee deploys tegelijk, en een lopende niet afbreken: een migratie die
# halverwege wordt gestopt is erger dan even wachten.
concurrency:
  group: deploy-acceptatie
  cancel-in-progress: false

jobs:
  deploy:
    # workflow_dispatch kan elke ref kiezen; alleen acceptatie-master mag deployen.
    if: github.ref == 'refs/heads/acceptatie-master'
    runs-on: ubuntu-latest
    environment: acceptatie
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      # `wrangler types` leest de secretnamen uit .dev.vars; het voorbeeld volstaat.
      # Weggooien na gebruik: .dev.vars hoort nergens anders dan lokaal.
      - name: Types genereren
        run: |
          cp .dev.vars.example .dev.vars
          npm run typegen
          npm run cf-typegen
          rm .dev.vars
      - run: npm run lint
      - run: npm run typecheck
      # Het token alleen in deze stap: npm ci draait scripts van derden.
      - name: Bouwen, migreren en deployen
        run: npm run deploy:acc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          WRANGLER_SEND_METRICS: "false"
```

`node-version: 22` levert de nieuwste 22.x (≥ 22.18, `engines`). Secrets staan in de GitHub
Environment `acceptatie`, die alleen voor `acceptatie-master` openstaat (handmatige stap 8). Er is
geen `pull_request`-trigger, dus code uit een fork komt nooit bij het token.

### Volgorde in `deploy:acc` en waarom

1. `opennextjs-cloudflare build`: faalt de build, dan is er niets aangeraakt.
2. `wrangler d1 migrations apply taalibtravels-leads-acc --env acceptatie --remote`: nieuwe
   migraties vóór de nieuwe code. Faalt er één, dan stopt `&&` de keten en blijft de oude Worker
   draaien.
3. `wrangler deploy --env acceptatie`.

De build is omgevingsonafhankelijk (geen incrementele cache, `site.json` is vast): hetzelfde
artefact zou naar productie gaan. Daarom geen `--env` op de build.

### Migraties: hoe weten we wat al gedraaid is?

**Besluit:** `wrangler d1 migrations apply` met `migrations_dir: "worker/migraties"`. Wrangler
houdt per database een tabel `d1_migrations (id, name UNIQUE, applied_at)` bij en draait alleen
bestanden waarvan de naam daar nog niet in staat. In CI bevestigt hij zonder prompt
(`isNonInteractiveOrCI`). Elke migratie wordt samen met haar registratie-`INSERT` in één verzoek
uitgevoerd; faalt ze, dan wordt ze niet geregistreerd en stopt de opdracht met een foutcode.

Gecontroleerd in de wrangler-broncode:
- standaardpatroon is `<migrations_dir>/*.sql`;
- sorteren gaat op het getal vóór de eerste `_`. `parseInt("001-ip-hash-weg.sql")` = 1, dus de
  bestaande naamgeving `NNN-naam.sql` werkt zonder hernoemen;
- de **bestandsnaam is de sleutel**. Een gedraaide migratie nooit hernoemen.

**Het probleem met de bestaande twee migraties:** 001 (`DROP COLUMN ip_hash`) is niet herhaalbaar.
Op een nieuwe database uit `schema.sql` bestaat die kolom niet, dus `apply` zou falen. In productie
zijn 001 en 002 al met de hand gedraaid. Oplossing: een **basislijn**.

- `worker/schema.sql` beschrijft voortaan de **stand na migratie 002** en wordt niet meer
  bijgewerkt. Nieuwe schemawijzigingen komen alleen nog in `worker/migraties/`. De huidige stand is
  dus `schema.sql` + alle migraties vanaf 003. Zo krijgt acceptatie elke migratie op precies
  dezelfde manier als productie straks, en dat is juist wat je wilt testen.
- Onderaan `schema.sql` komt de basislijn (idempotent, dezelfde tabeldefinitie als wrangler maakt):

  ```sql
  -- Basislijn voor `wrangler d1 migrations apply`: wat hierboven staat, is de stand na
  -- 001 en 002. Zonder deze regels probeert wrangler 001 (DROP COLUMN ip_hash) opnieuw,
  -- en die kolom bestaat in een nieuwe database niet. Nieuwe migraties (003 en verder)
  -- horen NIET in dit bestand en NIET in deze lijst: wrangler draait ze zelf.
  CREATE TABLE IF NOT EXISTS d1_migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
  INSERT OR IGNORE INTO d1_migrations (name) VALUES
    ('001-ip-hash-weg.sql'),
    ('002-reizen-afbeeldingen.sql');
  ```

- Kop van `schema.sql` aanpassen: "stand na 002; nieuwe database = dit bestand + daarna
  `wrangler d1 migrations apply`".
- **Productie** krijgt dezelfde basislijn door `schema.sql` er nog één keer op te draaien (alles
  `IF NOT EXISTS` / `OR IGNORE`, er verandert niets aan de data). Dat is handmatige stap 13. Het moet
  gebeuren vóór de eerste migratie 003 naar productie gaat, niet per se nu.
- **Lokaal:** zelfde, met `--local`.

### Regels voor nieuwe migraties (vanaf 003)

- Naam `NNN-korte-naam.sql`, met de hand aangemaakt. Niet `wrangler d1 migrations create`
  gebruiken: die maakt `0003_naam.sql`. Dat sorteert wel goed, maar breekt de naamgeving.
- Schrijf herhaalbaar waar SQLite het toelaat (`IF NOT EXISTS`). `ADD COLUMN` kan dat niet; daar
  zorgt de registratie ervoor dat hij één keer draait.
- **Expand/contract.** Acceptatie migreert automatisch vóór de deploy, dus de migratie draait terwijl
  de oude code nog leeft. Een migratie moet daarom altijd compatibel zijn met de code die op dat
  moment draait:
  - toevoegen (tabel, kolom met default, index): samen met de code in één push;
  - verwijderen of hernoemen: in een **latere** push, nadat de code die de kolom niet meer gebruikt
    op acceptatie én productie staat. Dat is dezelfde regel als in de kop van 001.
- Releasevolgorde voor productie (handmatig): eerst `npm run db:migreer:prod`, daarna
  `acceptatie-master` → `master` mergen. Bij een contract-migratie andersom: eerst mergen, daarna
  migreren.

---

## 3. npm-scripts (`package.json`)

Toevoegen, de bestaande scripts ongemoeid laten (`deploy` blijft productie):

| Script | Commando | Wie |
| --- | --- | --- |
| `deploy:acc` | `opennextjs-cloudflare build && wrangler d1 migrations apply taalibtravels-leads-acc --env acceptatie --remote && wrangler deploy --env acceptatie` | CI; met de hand alleen de allereerste keer |
| `db:migreer:acc` | `wrangler d1 migrations apply taalibtravels-leads-acc --env acceptatie --remote` | los inzetbaar |
| `db:migreer:prod` | `wrangler d1 migrations apply taalibtravels-leads --remote` | alleen de gebruiker, bewust, bij een release |
| `kopieer:acc` | `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/kopieer-naar-acceptatie.mjs` | de gebruiker, zie §6 |

Wat er nog is gemigreerd en wat niet, zie je met `npx wrangler d1 migrations list <db> [--env acceptatie] --remote`.
Daar is geen script voor nodig.

---

## 4. Handmatige stappen in Cloudflare en GitHub (gebruiker)

Volgorde is belangrijk: **Access eerst**, zodat de host nooit een minuut open staat.

1. **Controleer de productie-Access-app.** Het domein moet `taalibtravels.com`/`www` met paden
   `/admin*` en `/api/admin/*` zijn, **geen wildcard** `*.taalibtravels.com`. Anders valt `acc.` er
   ook onder.
2. **Access-app voor acceptatie** (Zero Trust → Access → Applications → Add → Self-hosted):
   - naam `TaalibTravels acceptatie`, domein `acc.taalibtravels.com`, **pad leeg** (de hele host);
   - policy *Allow*, Include → Emails: jouw adres + het adres van de klant;
   - login: One-time PIN (de klant krijgt een code per mail; geen account nodig);
   - sessieduur bijvoorbeeld 24 uur;
   - kopieer de **Application Audience (AUD) Tag** en geef die aan de engineer → `POLICY_AUD`.
   - Maak hem los van de productie-app. Eén app voor beide hosts zou de klant ook toegang tot
     productie-`/admin` geven.
3. **D1:** `npx wrangler d1 create taalibtravels-leads-acc --location weur`. Geef de `database_id`
   aan de engineer. Daarna, als de engineer `schema.sql` met de basislijn heeft opgeleverd:
   `npx wrangler d1 execute taalibtravels-leads-acc --env acceptatie --remote --file=./worker/schema.sql`.
4. **R2:** `npx wrangler r2 bucket create taalibtravels-media-acc`.
5. **Turnstile:** open de bestaande widget (die van de site key in `giveaway.json`) → Hostname
   management → voeg `acc.taalibtravels.com` toe. De site key zit vast in de build, dus acceptatie
   gebruikt dezelfde widget en dus dezelfde secret key. Een eigen widget vraagt een eigen build;
   dat ruilen we niet in.
6. **DNS:** controleer dat er nog **geen** record voor `acc` in de zone `taalibtravels.com` staat. Het
   custom domain maakt het record zelf aan bij de eerste deploy; een bestaand record blokkeert dat.
7. **API-token** (My Profile → API Tokens → Create): sjabloon *Edit Cloudflare Workers*, plus
   *Account → D1 → Edit*. Account Resources: alleen dit account. Zone Resources: alleen
   `taalibtravels.com`. Vervaldatum: een jaar, met een herinnering. (Faalt de domeinstap in CI met
   een autorisatiefout, voeg dan *Zone → DNS → Edit* toe.) Let op: *Workers Scripts: Edit* geldt
   voor het hele account, dus ook voor de productie-Worker. Behandel dit token als een productiegeheim.
8. **GitHub** (repo → Settings → Environments → New: `acceptatie`):
   - Deployment branches: *Selected branches* → `acceptatie-master`;
   - Environment secrets: `CLOUDFLARE_API_TOKEN` (stap 7), `CLOUDFLARE_ACCOUNT_ID`.
9. **Productie-Worker, Workers Builds** (Workers & Pages → `taalibtravels` → Settings → Build):
   zet *Builds for non-production branches* uit. Productiebranch blijft `master`.
10. **Eerste deploy, lokaal en met je eigen login** (`npx wrangler login`), op een checkout van de
    branch die `acceptatie-master` wordt: `npm run deploy:acc`. Dit maakt het custom domain en het
    DNS-record met jouw rechten aan. Daarna doet CI het.
11. **Secrets** (eigen waarden, niet die van productie; genereer met
    `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`):

    ```bash
    npx wrangler secret put ADMIN_GEBRUIKER     --env acceptatie
    npx wrangler secret put ADMIN_WACHTWOORD    --env acceptatie   # >= 16 tekens
    npx wrangler secret put ADMIN_SESSIE_SECRET --env acceptatie   # >= 16 tekens, ander dan wachtwoord
    npx wrangler secret put TURNSTILE_SECRET    --env acceptatie   # zelfde als productie (stap 5)
    ```

    **Nooit** `ACCESS_UIT`, en nooit `wrangler secret bulk .dev.vars`. Deel de inloggegevens met de
    klant via een wachtwoordmanager. Tot deze secrets staan geeft `/api/admin/*` 503 (faalt dicht).
12. **Branch:** maak `acceptatie-master` aan vanaf de geteste feature-branch en push. Controleer in
    GitHub → Actions dat de workflow groen is.
13. **Productie-basislijn** (vóór de eerste migratie 003 naar productie, bewuste handeling):
    `npx wrangler d1 execute taalibtravels-leads --remote --file=./worker/schema.sql` en daarna
    `npx wrangler d1 migrations list taalibtravels-leads --remote`. Die moet "No migrations to apply"
    melden.
14. **Data kopiëren** (§6): `npm run kopieer:acc` (overzicht), daarna `npm run kopieer:acc -- --overschrijf`.
15. **Rooktest op `acc.taalibtravels.com`:** Access-mail ontvangen en inloggen, `/`, `/reizen`, een
    reisdetail, een `/media/...`-foto, `/giveaway` inschrijven (Turnstile), `/admin` inloggen, foto
    uploaden en verwijderen, deelnemer verwijderen. Terugdraaien kan met
    `npx wrangler rollback --env acceptatie`. Migraties draaien niet terug; herstel gaat vooruit.

---

## 5. Documentatie

### `CLAUDE.md`

- **Commands-tabel:** `deploy:acc`, `db:migreer:acc`, `db:migreer:prod`, `kopieer:acc` toevoegen. Bij
  `deploy` vermelden: "productie; deployt normaal via Workers Builds bij een merge naar `master`".
- **Nieuwe sectie "Omgevingen: productie en acceptatie"** (na Architectuur), met:
  - de tabel productie ↔ acceptatie (branch, Worker-naam, domein, D1, R2, ratelimit-id's,
    Access-app, deploymechanisme);
  - de flow: feature-branch → `acceptatie-master` (automatisch live op `acc.`) → akkoord klant →
    merge naar `master` (bewust, = productie). Een hotfix op `master` meteen terugmergen naar
    `acceptatie-master`;
  - `env.acceptatie`: `routes` erft wel en moet dus altijd eigen waarden hebben; bindings, vars en
    ratelimits erven niet. Een nieuwe binding of var hoort dus **op twee plekken** in
    `wrangler.jsonc`;
  - Access dekt op acceptatie de hele host; `POLICY_AUD` verschilt per omgeving; `ACCESS_UIT`
    nooit op een omgeving;
  - `site.json`-canonical wijst ook op acceptatie bewust naar productie;
  - elke `wrangler`-opdracht richting acceptatie heeft `--env acceptatie` nodig, anders raakt hij
    productie.
- **Worker + D1 + R2:**
  - tabelregel `worker/schema.sql`: "stand na 002 + basislijn voor `d1 migrations`; wordt niet meer
    bijgewerkt";
  - tabelregel `worker/migraties/`: "toegepast met `wrangler d1 migrations apply`; bijgehouden in
    `d1_migrations`";
  - nieuwe regel `.github/workflows/deploy-acceptatie.yml`;
  - de migratieregels uit §2 (naamgeving, nooit hernoemen, expand/contract, releasevolgorde).
- **Commands-alinea over `preview`:** de lokale D1 opzetten wordt `schema.sql` draaien en daarna
  `npx wrangler d1 migrations apply taalibtravels-leads --local`.

### `README.md`

- "Eenmalig opzetten": na `schema.sql` volgt `wrangler d1 migrations apply`.
- "Schemawijzigingen": de `d1 execute`-voorbeelden vervangen door `migrations apply` en de
  expand/contract-regel.
- Korte sectie "Acceptatieomgeving" die naar CLAUDE.md verwijst voor de details en de klant-flow
  uitlegt (Access-mail, eigen login).

De koppen van `001` en `002` blijven zoals ze zijn: dat is geschiedenis. Nieuwe migraties krijgen
in hun kop `npm run db:migreer:acc` / `db:migreer:prod` in plaats van `d1 execute`.

---

## 6. Data van productie naar acceptatie, zonder deelnemers

### Nieuw bestand: `scripts/kopieer-naar-acceptatie.mjs`

Kopieert reizen, foto's en de homepagegalerij van productie naar acceptatie. **Raakt `deelnemers`
nergens aan**: niet lezen, niet schrijven, niet leegmaken.

**Constanten** (hard, geen argumenten of omgevingsvariabelen):

```js
const BRON_DB = "taalibtravels-leads";
const DOEL_DB = "taalibtravels-leads-acc";
const BRON_BUCKET = "taalibtravels-media";
const DOEL_BUCKET = "taalibtravels-media-acc";
// Volgorde = invoegvolgorde (vreemde sleutels); verwijderen gaat andersom.
const TABELLEN = ["afbeeldingen", "reizen", "galerij"];
```

Bij de start controleren dat `DOEL_DB`/`DOEL_BUCKET` op `-acc` eindigen en verschillen van de bron.
Anders afbreken. De tabellijst is een vaste allowlist: het script kent het woord `deelnemers` niet.

**Werkwijze:**

1. Node-versiecheck (≥ 22.18), zoals in het seed-script, vóór
   `await import("../src/lib/foto-breedtes.ts")` voor `ALL_WIDTHS`. Rechtstreeks, niet via
   `scripts/image-sizes.mjs`: dat verdwijnt samen met de seed.
2. Lezen uit productie, alleen-lezen: per tabel
   `wrangler d1 execute taalibtravels-leads --remote --json --command "SELECT * FROM <tabel>"`, en
   `results` parsen. `SELECT *` mag hier omdat de tabel uit de allowlist komt. Zo volgt de kopie
   een latere kolom vanzelf. Kolomnamen worden gecontroleerd tegen `/^[a-z_]+$/` voordat ze als
   identifier in SQL gaan.
3. Lezen uit acceptatie: `SELECT id FROM afbeeldingen` (met `--env acceptatie --remote`).
4. **Zonder `--overschrijf`:** overzicht tonen (aantal rijen per tabel, aantal nieuw te kopiëren
   foto's en objecten) en stoppen. Er wordt niets geschreven.
5. **Met `--overschrijf`:**
   a. **R2 eerst**, alleen voor foto-id's die nog niet in acceptatie-D1 staan. Een id wordt nooit
      hergebruikt, dus een id dat al in acceptatie staat, is al volledig gekopieerd. Per foto:
      `r2_sleutel` controleren tegen `/^fotos\/[a-z0-9]+(-[a-z0-9]+)*$/`, dan voor elke breedte uit
      `ALL_WIDTHS` `${r2_sleutel}/${w}.webp` plus `${r2_sleutel}/og.jpg`:
      `wrangler r2 object get <BRON_BUCKET>/<sleutel> --remote --file <tmp>` →
      `wrangler r2 object put <DOEL_BUCKET>/<sleutel> --remote --file <tmp> --content-type image/webp|image/jpeg`.
      (`--remote` is verplicht: wrangler 4 werkt standaard lokaal.)
   b. **Dan D1**, in één SQL-bestand: `DELETE FROM galerij; DELETE FROM reizen; DELETE FROM afbeeldingen;`
      en daarna de `INSERT`s in de volgorde van `TABELLEN`. Waarden gaan via `sqlTekst`/`sqlGetal`
      (overnemen uit het seed-script: verdubbelde quotes, NUL geweigerd, `NULL` voor null,
      getallen gecontroleerd). Uitvoeren met
      `wrangler d1 execute taalibtravels-leads-acc --env acceptatie --remote --file <tmp>.sql`.
   c. Tijdelijke map (`fs.mkdtemp(os.tmpdir())`) altijd opruimen in `finally`.
6. De `wrangler()`-helper (geen shell, beperkte env, `CI=true`, time-out, 3 pogingen) overnemen uit
   `scripts/seed-bestaande-content.mjs`. De duplicatie is tijdelijk: de seed verdwijnt na de
   productie-seed (Task 9b).

**Gevolgen om in de kop van het script te zetten:**

- Wat de klant op acceptatie aan reizen, foto's of galerij wijzigde, wordt overschreven. Dat is de
  bedoeling van een kopie; daarom de vlag.
- Foto's die alleen op acceptatie bestonden, blijven als wees in de R2-bucket staan. Onschuldig.
- De eerste keer zijn het ongeveer 23 × 9 = 207 objecten, twee wrangler-aanroepen per object: reken
  op een kwartier. Daarna gaan alleen nieuwe foto's over.
- Is de D1-stap halverwege mislukt, draai het script dan opnieuw. Het begint met `DELETE`, dus
  opnieuw draaien is veilig.
- Niet draaien terwijl een acceptatie-deploy loopt (migratie).
- Deelnemers op acceptatie zijn testinschrijvingen van de klant (echte e-mailadressen). Ruim ze na
  de test op via `/admin`.

---

## 7. Risico's en randgevallen

| Risico | Wat er gebeurt / wat het systeem doet |
| --- | --- |
| `routes` vergeten in `env.acceptatie` | erft productiedomeinen; dry-run in §8 vangt dit af, het blok staat expliciet in dit plan |
| Binding of var alleen top-level toegevoegd (toekomst) | acceptatie mist hem: D1/R2 → fout, ratelimit → gelogd en doorgelaten, Access-var → 403. Regel in CLAUDE.md: twee plekken |
| Placeholder `POLICY_AUD` | `/api/admin/*` 403 op acceptatie (faalt dicht) |
| Migratie faalt in CI | `&&` stopt, geen deploy, oude Worker blijft, workflow rood |
| Destructieve migratie samen met code | oude code breekt kort op acceptatie → expand/contract-regel |
| `npm run deploy` (zonder `:acc`) lokaal vanaf `acceptatie-master` | deployt naar **productie**. Bestaand risico; staat in CLAUDE.md. Bewust geen extra script dat dit vangt |
| `wrangler secret put` zonder `--env acceptatie` | overschrijft het productiesecret. Checklist zet `--env` overal expliciet |
| Token lekt | kan ook productie deployen. GitHub Environment met branch-restrictie, token alleen in de deploy-stap, geen PR-trigger |
| Access-app per ongeluk verwijderd | site op `acc.` publiek; canonical wijst naar productie (SEO-veilig); beheer-API blijft 403 (AUD-controle); giveaway schrijft in de acceptatie-DB, niet in productie |
| Prod-app met wildcard-domein | klantpolicy en prod-policy overlappen → stap 1 |
| Workers Builds bouwt `acceptatie-master` op de prod-Worker | stap 9 |
| Kopiescript wijst naar verkeerde database | harde constanten + `-acc`-controle + vlag `--overschrijf` |
| Foto-variant ontbreekt in productie-R2 | `r2 object get` faalt → script stopt met de sleutel in de melding; D1 is dan nog niet aangeraakt |

---

## 8. Verificatie (engineer)

```bash
npm run cf-typegen && npm run typegen
npm run lint
npm run typecheck
npx opennextjs-cloudflare build
npx wrangler deploy --env acceptatie --dry-run --outdir "$TMP/acc"   # bindings: DB=…-leads-acc, MEDIA=…-media-acc, LOGIN_LIMIT 2001, SIGNUP_LIMIT 2002, POLICY_AUD = acc-AUD
npx wrangler deploy --dry-run --outdir "$TMP/prod"                   # ongewijzigd: …-leads, …-media, 1001/1002, prod-AUD
npx wrangler d1 execute taalibtravels-leads --local --file=./worker/schema.sql
npx wrangler d1 migrations list taalibtravels-leads --local          # verwacht: geen openstaande migraties
node --check scripts/kopieer-naar-acceptatie.mjs
```

De engineer draait het kopieerscript **niet** tegen productie en deployt niet. De eerste echte run
en de eerste deploy zijn handmatige stappen 10 en 14 van de gebruiker. Het workflowbestand wordt
door de reviewer gelezen; het bewijs dat het werkt is de eerste groene run (stap 12).

---

## 9. Takenlijst

### Door de engineer in de repo (op `feat/acceptatieomgeving`, niet committen op `master`)

1. `wrangler.jsonc`: `migrations_dir` op de top-level D1-binding; `env.acceptatie` volgens §1, met
   de aangeleverde `database_id` en `POLICY_AUD` (tot dan placeholders, zie stap 2 en 3 hieronder).
2. `worker/schema.sql`: kop bijwerken (stand na 002) en de basislijn onderaan (§2).
3. `package.json`: `deploy:acc`, `db:migreer:acc`, `db:migreer:prod`, `kopieer:acc` (§3).
4. `.github/workflows/deploy-acceptatie.yml` (§2).
5. `scripts/kopieer-naar-acceptatie.mjs` (§6).
6. `CLAUDE.md` en `README.md` bijwerken (§5).
7. Verificatie uit §8 draaien en de uitvoer van beide dry-runs in de oplevering zetten.

### Door de gebruiker handmatig

1. Productie-Access-app controleren: geen wildcard (§4.1).
2. Access-app `acc.taalibtravels.com` aanmaken, hele host, e-mail-OTP, klant + jijzelf; AUD naar de engineer (§4.2).
3. `wrangler d1 create taalibtravels-leads-acc`; id naar de engineer. Na taak 2 van de engineer: `schema.sql` remote op de acceptatie-DB draaien (§4.3).
4. `wrangler r2 bucket create taalibtravels-media-acc` (§4.4).
5. Turnstile-widget: hostname `acc.taalibtravels.com` toevoegen (§4.5).
6. DNS: geen bestaand `acc`-record (§4.6).
7. API-token aanmaken (§4.7).
8. GitHub Environment `acceptatie` met branch-restrictie en de twee secrets (§4.8).
9. Workers Builds van de productie-Worker: builds voor niet-productiebranches uit (§4.9).
10. Eerste deploy lokaal: `npm run deploy:acc` (§4.10).
11. Vier secrets met `--env acceptatie`; nooit `ACCESS_UIT` (§4.11).
12. Branch `acceptatie-master` aanmaken en pushen; workflow groen (§4.12).
13. Later, vóór de eerste migratie 003 naar productie: basislijn op productie (§4.13).
14. Data kopiëren: `npm run kopieer:acc`, dan `-- --overschrijf` (§4.14).
15. Rooktest en de klant uitnodigen (§4.15).
