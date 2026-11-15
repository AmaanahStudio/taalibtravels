# Seed-script verharding

## Oorzaak van de eerdere hang: NIET gevonden
- Geen wrangler/workerd/node-processen meer actief (PowerShell-controle), dus niets om te killen.
- Losse wrangler-aanroep met CI=true, WRANGLER_SEND_METRICS=false, NO_COLOR=1: ~1 s; zonder die variabelen ~1,4 s. Geen prompt of blokkerende update-check waargenomen.
- Volle run op schone state: 228 s, tweede run 231 s. De eerdere >20 min is dus niet reproduceerbaar; waarschijnlijk een eenmalig hangende wrangler-aanroep (zonder timeout). Let op: D1-rijen worden pas aan het einde geschreven, dus "0 rijen" tijdens de R2-fase is normaal.

## Wijzigingen (scripts/seed-bestaande-content.mjs)
1. Time-out per wrangler-aanroep (120 s, SIGKILL), 3 pogingen, daarna Nederlandse foutmelding met foto/variant en "veilig opnieuw te draaien".
2. Voortgangsregel per foto met verstreken tijd; totalen aan het einde (D1-telling via query, R2 verwacht = 28 x 8).
3. Wrangler-child krijgt CI=true, NO_COLOR=1, WRANGLER_SEND_METRICS=false en alleen een allowlist van omgevingsvariabelen (PATH, profielmappen, CLOUDFLARE_*, WRANGLER_*, proxy).
4. Validatie, idempotentie, --local|--remote-exclusiviteit en SQL-escaping ongewijzigd. D1 was al één `--file`; R2 blijft één spawn per object.
5. Seams: SEED_WRANGLER en SEED_TIMEOUT_MS (gedocumenteerd in de header).

## Verificatie
- eslint op het script: schoon.
- Schone lokale state + schema + migraties 001/002: run 1 = 228 s, 3 reizen / 28 afbeeldingen / 6 galerij, 224 R2-bestanden op schijf. Run 2 identiek (231 s).
- Hang-simulatie (stub die slaapt, timeout 3 s): 3 pogingen, daarna "foto avond-nabawi variant 256: wrangler geen antwoord na 3s na 3 pogingen. Het script is veilig opnieuw te draaien.", exit 1, na 9 s.
- .wrangler/state teruggezet uit backup.

## Aandachtspunten
- Op Windows kan een gedode wrangler een workerd-kindproces achterlaten (R2 put --local); bij een timeout lokaal even controleren. Bij --remote is er geen workerd.
- Niet getest: --remote (bewust).
