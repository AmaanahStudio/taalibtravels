-- 002 — tabellen voor het beheerportaal: foto's, reizen en de homepagegalerij.
--
-- Waarom: reizen en foto's stonden als JSON en bestanden in de repository; het
-- portaal bewerkt ze nu live. De bestanden zelf staan in R2 (binding MEDIA), D1
-- bewaart alleen de beschrijving en de verwijzingen.
--
-- Alles staat op IF NOT EXISTS, dus het bestand mag opnieuw gedraaid worden.
--
--   wrangler d1 execute taalibtravels-leads --local  --file=./worker/migraties/002-reizen-afbeeldingen.sql
--   wrangler d1 execute taalibtravels-leads --remote --file=./worker/migraties/002-reizen-afbeeldingen.sql

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
