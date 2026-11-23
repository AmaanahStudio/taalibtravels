# Acceptatieomgeving Taalib Travels

Een kopie van de site waarop wijzigingen eerst getest worden, met een eigen adres en eigen data. Wat daar goed is, gaat daarna naar productie.

| | Productie | Acceptatie |
| --- | --- | --- |
| Adres | taalibtravels.com | **acc.taalibtravels.com** |
| Git-branch | `master` | `acceptatie-master` |
| Deploy | Workers Builds, bij een merge naar `master` | GitHub Actions, bij elke push |
| Database | `taalibtravels-leads` | `taalibtravels-leads-acc` |
| Foto-opslag | `taalibtravels-media` | `taalibtravels-media-acc` |

## Werkwijze

1. Je werkt op een feature-branch en voegt die samen met `acceptatie-master`.
2. Elke push op `acceptatie-master` bouwt de site, past database-migraties toe en zet hem live op acc.
3. De klant test op acc.taalibtravels.com.
4. Akkoord? Dan merge je `acceptatie-master` bewust naar `master`. Dat is de release naar productie.

Een hotfix op `master` merge je meteen terug naar `acceptatie-master`.

## Wat er is ingericht

- **Eigen Worker-omgeving** `acceptatie` in `wrangler.jsonc`: zelfde code, andere database, bucket, ratelimits en domein.
- **GitHub Actions** (`.github/workflows/deploy-acceptatie.yml`): lint, build, typecheck, migreren en deployen. Draait alleen vanaf `acceptatie-master`.
- **Kopie van productie** (`kopieer-productie-naar-acceptatie.yml`): zet reizen, foto's en galerij van productie op acceptatie. Alleen handmatig starten, niet gepland, omdat het testwerk overschrijft. Deelnemers worden nooit gekopieerd. Lokaal: `npm run kopieer:acc`.
- **Cloudflare Access** op `acc.taalibtravels.com/admin*`, `/api/admin/*` en `/api/deelnemers*` (zie onder). De rest van de site is openbaar.
- **Eigen secrets** op de acceptatie-Worker: `ADMIN_GEBRUIKER`, `ADMIN_WACHTWOORD`, `ADMIN_SESSIE_SECRET`, `TURNSTILE_SECRET`.
- **API-token** (alleen in de GitHub Environment `acceptatie`) met rechten op Workers Scripts, D1, R2 en de zone `taalibtravels.com` (Workers Routes en DNS).

### Wie komt waar

| Pad | Toegang |
| --- | --- |
| Hele site (`/`, `/reizen`, `/giveaway`, ...) | Openbaar |
| `/admin`, `/api/admin/*` | Access-login met e-mailcode, daarna het beheerwachtwoord |
| `/api/deelnemers*` (giveaway versturen) | Alleen na inloggen, zodat niemand per ongeluk inschrijft |

## Regels om te onthouden

- Elke `wrangler`-opdracht voor acceptatie heeft `--env acceptatie` nodig. Zonder die vlag raak je productie.
- Een nieuwe binding of variabele komt op **twee** plekken in `wrangler.jsonc`: productie en `env.acceptatie`.
- Database-wijzigingen gaan als nieuw bestand in `worker/migraties/` (`NNN-naam.sql`). Een gedraaide migratie hernoem je nooit.
- Een gedeelde Access-policy (**Beheerders**) betekent: wie je daar toevoegt, heeft ook toegang tot het productiebeheer.
- Het API-token kan alle Workers in het account wijzigen. Behandel het als een productiegeheim.

## Cloudflare-termen

| Term | Wat het is |
| --- | --- |
| **Worker** | Een programma dat Cloudflare draait op zijn netwerk, zonder eigen server. Onze hele site is één Worker. |
| **Workers Builds** | Cloudflare bouwt en deployt een Worker zelf bij een push naar GitHub. Gebruikt voor productie. |
| **OpenNext** | Het gereedschap dat een Next.js-site omzet naar iets wat op een Worker draait. |
| **Wrangler** | Het opdrachtregelprogramma van Cloudflare (`wrangler deploy`, `wrangler d1 ...`). |
| **`wrangler.jsonc`** | Het configuratiebestand van de Worker: naam, domeinen en koppelingen. |
| **Omgeving (`env`)** | Een tweede configuratie van dezelfde Worker. Hier: `acceptatie`. |
| **Binding** | Een koppeling tussen de Worker en een dienst, onder een vaste naam in de code (`DB`, `MEDIA`, `ASSETS`). |
| **D1** | De SQL-database van Cloudflare (SQLite). Bevat reizen, foto-gegevens, galerij en deelnemers. |
| **Migratie** | Een SQL-bestand dat de database-structuur wijzigt. Wrangler houdt bij welke al gedraaid zijn. |
| **R2** | Bestandsopslag, zoals Amazon S3. Bevat de foto's. |
| **Bucket** | Een "map" in R2 met een eigen naam. |
| **Secret** | Een geheime waarde (wachtwoord, sleutel) die alleen de Worker kan lezen, nooit terug te zien. Zet je met `wrangler secret put`. |
| **Variabele (`vars`)** | Een niet-geheime instelling in `wrangler.jsonc`, zoals `TEAM_DOMAIN`. |
| **Custom domain** | Een eigen adres (acc.taalibtravels.com) dat Cloudflare aan een Worker koppelt en waarvoor hij het DNS-record aanmaakt. |
| **Zone** | Een domein in je Cloudflare-account (taalibtravels.com) met zijn DNS en regels. |
| **DNS** | Het "telefoonboek" dat een naam omzet naar een serveradres. |
| **Ratelimit** | Een begrenzing op het aantal verzoeken per IP-adres, tegen misbruik van het formulier en het inloggen. |
| **Cloudflare Access** (Zero Trust) | Een voordeur voor een webadres: je moet inloggen (hier met een e-mailcode) voordat je erdoor mag. |
| **Application (Access)** | Een beschermde adresgroep in Access, met bestemmingen en een policy. |
| **Policy** | De regel wie er door de voordeur mag, bijvoorbeeld een lijst e-mailadressen. |
| **AUD-tag** | Het unieke nummer van een Access-app. Staat in elk inlogtoken; de Worker controleert er `POLICY_AUD` mee. |
| **Team domain** | Het adres van je Access-omgeving (`...cloudflareaccess.com`). Hier komt het inlogscherm vandaan. |
| **Turnstile** | Cloudflare's vervanger voor een captcha: controleert dat een inschrijving van een mens komt. |
| **Site key / secret key** | Het openbare deel (in de pagina) en het geheime deel (bij de Worker) van een Turnstile-widget. |
| **API-token** | Een sleutel waarmee een programma (hier GitHub) namens jou iets in Cloudflare mag doen, met alleen de rechten die je kiest. |
| **Account-ID** | Het nummer van je Cloudflare-account. Geen geheim. |
| **`workers.dev`** | Een gratis standaardadres voor een Worker. Staat bewust uit, omdat Access dat adres niet beschermt. |

## Nog te doen

- `acc.taalibtravels.com` toevoegen aan de Turnstile-widget.
- Workers Builds van productie instellen op alleen `master`.
- Optioneel: een `noindex`-header voor de acceptatiehost, zodat Google de testsite niet indexeert.
