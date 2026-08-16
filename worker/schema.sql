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
  aangemaakt_op  TEXT NOT NULL,
  -- SHA-256(ip + IP_SALT). Genoeg om misbruik te herkennen, zonder een ruw
  -- IP-adres te bewaren dat je niet nodig hebt.
  ip_hash        TEXT
);

-- Blokkeert dubbele deelname aan de giveaway. De Worker gebruikt deze index ook
-- als voorwaarde in ON CONFLICT, dus hij is functioneel en niet enkel hygiëne.
CREATE UNIQUE INDEX IF NOT EXISTS deelnemers_email_uniek ON deelnemers (email);

-- Het overzicht sorteert altijd op datum, nieuwste eerst.
CREATE INDEX IF NOT EXISTS deelnemers_datum ON deelnemers (aangemaakt_op DESC);
