-- Schema van de leads-database (D1).
--
-- Toepassen na `wrangler d1 create taalibtravels-leads`:
--   wrangler d1 execute taalibtravels-leads --local  --file=./worker/schema.sql
--   wrangler d1 execute taalibtravels-leads --remote --file=./worker/schema.sql
--
-- Alles staat op IF NOT EXISTS, dus het bestand mag opnieuw gedraaid worden.

CREATE TABLE IF NOT EXISTS deelnemers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  voornaam       TEXT NOT NULL,
  achternaam     TEXT NOT NULL,
  -- Altijd lowercase en getrimd opgeslagen, anders houdt de unieke index
  -- hieronder "Jan@x.be" en "jan@x.be" voor twee verschillende mensen.
  email          TEXT NOT NULL,
  -- Optioneel veld: leeg wordt NULL weggeschreven, nooit een lege string. Twee
  -- soorten "geen nummer" in dezelfde kolom maakt elke telling erop onbetrouwbaar.
  telefoon       TEXT,
  -- Waar de inschrijving vandaan komt. Staat er zodat hetzelfde formulier later
  -- voor een nieuwsbrief of een tweede actie kan dienen, zonder migratie.
  bron           TEXT NOT NULL DEFAULT 'giveaway',
  -- De twee vinkjes worden bewaard en niet alleen in het formulier afgedwongen:
  -- dat je toestemming hébt, moet je achteraf kunnen aantonen.
  voorwaarden    INTEGER NOT NULL,
  consent        INTEGER NOT NULL,
  aangemaakt_op  TEXT NOT NULL
);

-- Hier stond ooit een `ip_hash`-kolom. Die is verwijderd (zie migraties/001):
-- hij werd nergens getoond, hij is een persoonsgegeven, en een SHA-256 over de
-- 4 miljard IPv4-adressen is met de salt in seconden terug te rekenen. Gegevens
-- die je niet bewaart, kunnen niet lekken.

-- Blokkeert dubbele deelname aan de giveaway. De Worker gebruikt deze index ook
-- als voorwaarde in ON CONFLICT, dus hij is functioneel en niet enkel hygiëne.
CREATE UNIQUE INDEX IF NOT EXISTS deelnemers_email_uniek ON deelnemers (email);

-- Het overzicht sorteert altijd op datum, nieuwste eerst.
CREATE INDEX IF NOT EXISTS deelnemers_datum ON deelnemers (aangemaakt_op DESC);

-- Beheerportaal: foto's, reizen en de gedeelde homepagegalerij (zie migraties/002).
CREATE TABLE IF NOT EXISTS afbeeldingen (
  -- Leesbare slug; reizen en galerij verwijzen hiernaar.
  id          TEXT PRIMARY KEY,
  -- Unieke, niet-raadbare sleutel van het object in R2.
  r2_sleutel  TEXT NOT NULL UNIQUE,
  alt         TEXT NOT NULL,
  -- Echte afmetingen: ze bepalen de gereserveerde ruimte in de pagina.
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  aangemaakt  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reizen (
  -- Staat vast na aanmaken: een wijziging breekt bestaande links.
  slug               TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  subtitle           TEXT NOT NULL,
  summary            TEXT NOT NULL,
  -- JSON-array van paragrafen.
  description        TEXT NOT NULL,
  departure_date     TEXT NOT NULL,
  return_date        TEXT NOT NULL,
  price_amount       REAL NOT NULL,
  price_installments INTEGER NOT NULL DEFAULT 0,
  price_note         TEXT,
  -- JSON-array van { label, description?, icon }, per reis.
  inclusions         TEXT NOT NULL,
  cover_image        TEXT NOT NULL REFERENCES afbeeldingen (id),
  -- JSON-array van zes afbeelding-id's; NULL = de gedeelde galerij.
  gallery            TEXT,
  audience           TEXT NOT NULL,
  status             TEXT NOT NULL,
  spots_total        INTEGER,
  spots_left         INTEGER,
  updated_at         TEXT NOT NULL
);

-- De overzichten sorteren altijd op vertrekdatum.
CREATE INDEX IF NOT EXISTS reizen_vertrek ON reizen (departure_date);

-- De gedeelde galerij van de homepage: zes rijen, positie 1 t/m 6.
CREATE TABLE IF NOT EXISTS galerij (
  positie        INTEGER PRIMARY KEY,
  afbeelding_id  TEXT NOT NULL REFERENCES afbeeldingen (id)
);
