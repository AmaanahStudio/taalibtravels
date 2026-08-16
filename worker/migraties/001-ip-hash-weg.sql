-- 001 — verwijdert de kolom `ip_hash` uit `deelnemers`.
--
-- Waarom: de kolom werd nergens getoond of gebruikt, een IP-adres is een
-- persoonsgegeven, en de hash was met de salt in seconden terug te rekenen —
-- terwijl de privacyverklaring "onomkeerbaar" beloofde. Minder bewaren is hier
-- eenvoudiger dan het beter beveiligen.
--
-- DROP COLUMN behoudt alle rijen; alleen deze kolom en zijn inhoud verdwijnen.
--
-- LET OP met de volgorde: draai dit pas NA de deploy waarin de Worker de kolom
-- niet meer schrijft. Andersom schrijft de nog draaiende oude code naar een
-- kolom die niet meer bestaat, en breekt elke inschrijving.
--
--   wrangler d1 execute taalibtravels-leads --local  --file=./worker/migraties/001-ip-hash-weg.sql
--   wrangler d1 execute taalibtravels-leads --remote --file=./worker/migraties/001-ip-hash-weg.sql
--
-- Daarna mag het secret weg: `wrangler secret delete IP_SALT`.

ALTER TABLE deelnemers DROP COLUMN ip_hash;
