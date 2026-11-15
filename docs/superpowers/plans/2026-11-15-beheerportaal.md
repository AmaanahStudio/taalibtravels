# Beheerportaal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Team (`.claude/agents/`):** each task runs `architect` → `engineer` → `reviewer`; the engineer fixes the reviewer's findings and the reviewer re-checks. `optimizer` runs once, on the whole branch, in Task 10. The architect writes its per-task design into `docs/superpowers/plans/` and does not write product code.

**Goal:** Let the admin create, edit, hide and delete trips and add/remove photos from `/admin`, with changes live immediately for visitors.

**Architecture:** Next.js runs on Cloudflare Workers via OpenNext; public pages render on request from D1 (trips) and serve photos from R2. The existing Worker code keeps `/api/*` (behind the existing session gate) and gains CRUD routes for trips, photos and the shared gallery plus a `/media/*` route. `/admin` gets tabs Deelnemers / Reizen / Foto's.

**Tech Stack:** Next.js 16.2, `@opennextjs/cloudflare`, Cloudflare Workers, D1 (`DB`), R2 (`MEDIA`), wrangler 4, TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-15-beheerportaal-design.md`

## Global Constraints

- All UI copy, content and code comments in Dutch; comments explain the *why*.
- Only semantic design tokens (`bg-surface`, `text-heading`, …); no hardcoded colours except WhatsApp green.
- Dates and prices formatted with `formatDateLong`, `formatPrice`, `formatAmount`, … from `src/lib/utils.ts`; never `Intl` or `toLocaleString`.
- Form fields only via `Field` / `Checkbox` from `src/components/ui/field.tsx`; client components are small leaves under server pages.
- Files shared with the Worker (`src/lib/api.ts`, `src/lib/leads.ts`, new `src/lib/reizen.ts`, `src/lib/reizen-db.ts`) use **relative imports only**, never the `@/*` alias.
- The Worker is the authority: every write route validates server-side; all D1 queries use bound parameters.
- Existing security stays: cookie `__Host-tt_admin`, `inlogVingerafdruk` binding, `beheerIsIngesteld()`, rate limits, **no IP address stored**.
- Every `/api/admin/*` write route checks that `Origin` equals the request origin, in addition to the cookie.
- A trip gallery is exactly six photos, or `null` (= shared gallery); the shared gallery is exactly six.
- A trip `slug` is immutable after creation.
- A photo that is a trip cover, is in a trip gallery or is in the shared gallery cannot be deleted; the error names where it is used.
- Verification = `npm run lint`, `npm run typecheck`, `npm run build`, plus `npm run preview` for Worker behaviour. There is no test runner; do not claim a check passed without running it.
- Do not commit unless the task step says so. Never push.

## Review Focus

- A trip slug that collides with an existing one, is empty, or contains characters unsafe in a URL → 400 with a field error, never a 500 or an overwrite.
- A delete of a photo still used as a cover/gallery/shared gallery → 409 naming the usage; the photo and R2 object remain.
- An upload that is not an image, is oversized, or has a spoofed content type/size → rejected before anything reaches R2 or D1.
- A request to any write route without a session, or with a foreign `Origin` → 401 / 403, nothing written.
- A public request for a draft trip, an unknown slug, or an empty database → draft/unknown gives the 404 page; an empty trip list renders the existing empty state instead of crashing the homepage hero.

## File Structure

- Create `src/lib/reizen.ts` — trip input types, `valideerReis`, `maakSlug`, constants (shared browser/Worker, no alias).
- Create `src/lib/reizen-db.ts` — D1 read/write helpers mapping rows ⇄ `Trip` (shared Next/Worker, no alias).
- Modify `src/lib/api.ts` — new paths and response types.
- Create `worker/migraties/002-reizen-afbeeldingen.sql`; modify `worker/schema.sql`.
- Create `worker/reizen.ts`, `worker/afbeeldingen.ts`, `worker/media.ts` — route handlers; modify `worker/index.ts` to route to them and to the OpenNext handler.
- Modify `src/lib/content.ts`, `src/app/**` pages, `src/components/trips/*`, `src/lib/image-loader.ts` — read from D1, dynamic rendering.
- Create `src/components/admin/reizen-beheer.tsx`, `reis-formulier.tsx`, `fotos-beheer.tsx`, `foto-kiezer.tsx`, `upload-foto.ts`; modify `admin-paneel.tsx`.
- Create `scripts/seed-bestaande-content.mjs` — one-off import of existing JSON and photos.
- Modify `wrangler.jsonc`, `next.config.ts`, `package.json`, `public/_headers`, `CLAUDE.md`, `README.md`.

---

### Task 1: Spike — OpenNext on Next 16.2 with the existing Worker (decision gate)

**Files:**
- Modify: `package.json`, `next.config.ts`, `wrangler.jsonc`, `worker/index.ts`
- Create: `open-next.config.ts`, `src/app/spike/page.tsx` (deleted at the end of the task)

**Interfaces:**
- Produces: a decision recorded at the bottom of this plan: works / works with changes / blocked. Later tasks assume "works".

- [ ] **Step 1: Create branch `feat/beheerportaal`**; install `@opennextjs/cloudflare` (latest that supports Next 16) and add `open-next.config.ts` with the default config.
- [ ] **Step 2: Remove `output: "export"` and the custom image loader settings that need export, keeping the loader file; make `worker/index.ts` delegate every non-`/api/` request to the OpenNext handler** instead of `env.ASSETS.fetch`, keeping `/api/*` handling untouched.
- [ ] **Step 3: Add `src/app/spike/page.tsx`**, a `dynamic = "force-dynamic"` server component that reads `SELECT COUNT(*) FROM deelnemers` through `getCloudflareContext().env.DB` and renders it.
- [ ] **Step 4: Run `npm run build`, then `npm run preview`.** Expected: build passes; `/spike` renders a number that changes after inserting a row with `wrangler d1 execute taalibtravels-leads --local --command "…"` without rebuilding; `/api/admin/deelnemers` still answers 401; `/reizen` and `/` still render.
- [ ] **Step 5: Check the response headers on `/` and `/reizen/<slug>`** and record whether `public/_headers` still applies to dynamic responses. Expected: it does not (static assets only); note the needed fix for Task 8.
- [ ] **Step 6: Record the decision** under "Spike result" below and delete `src/app/spike/`. If blocked, **stop and return to the user** with the options from the design (A/C); do not continue.
- [ ] **Step 7: Commit** `chore: OpenNext op Cloudflare Workers (spike)`.

---

### Task 2: Schema, shared validation and API contract

**Files:**
- Create: `worker/migraties/002-reizen-afbeeldingen.sql`, `src/lib/reizen.ts`
- Modify: `worker/schema.sql`, `src/lib/api.ts`, `wrangler.jsonc` (R2 binding `MEDIA`, bucket `taalibtravels-media`)

**Interfaces:**
- Produces in `src/lib/reizen.ts`:
  - `export const ICON_KEYS: readonly IconKey[]` (the 8 keys; compile-time check that it equals the `IconKey` union)
  - `export const GALERIJ_AANTAL = 6`
  - `export interface InclusieInvoer { label: string; description?: string; icon: IconKey }`
  - `export interface ReisInvoer { slug: string; title: string; subtitle: string; summary: string; description: string[]; departureDate: string; returnDate: string; price: { amount: number; installmentsAvailable: boolean; note?: string }; inclusions: InclusieInvoer[]; coverImage: string; gallery: string[] | null; audience: TripAudience; status: TripStatus; spotsTotal?: number; spotsLeft?: number }`
  - `export type ReisFouten = Partial<Record<string, string>>`
  - `export type ReisResultaat = { ok: true; reis: ReisInvoer } | { ok: false; fouten: ReisFouten }`
  - `export function valideerReis(ruw: unknown): ReisResultaat`
  - `export function maakSlug(title: string, subtitle: string): string`
- Produces in `src/lib/api.ts`: `API.reizen = "/api/admin/reizen"`, `API.afbeeldingen = "/api/admin/afbeeldingen"`, `API.galerij = "/api/admin/galerij"`, `MEDIA_PAD = "/media/"`, `reisPad(slug)`, `afbeeldingPad(id)`, and response types `ReisAntwoord`, `ReizenAntwoord`, `AfbeeldingRecord { id; sleutel; alt; width; height }`, `AfbeeldingenAntwoord`, `GalerijAntwoord`.

- [ ] **Step 1: Write migration 002** creating `afbeeldingen`, `reizen`, `galerij` as in the design (idempotent `IF NOT EXISTS`; `reizen.cover_image` and gallery ids reference `afbeeldingen.id`; `description`, `inclusions`, `gallery` stored as JSON text); mirror it in `schema.sql`.
- [ ] **Step 2: Implement `valideerReis`** enforcing: non-empty trimmed title/subtitle/summary with sensible max lengths; slug `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 80 chars; ≥ 1 description paragraph; ISO dates with `returnDate >= departureDate`; `price.amount` finite, > 0, ≤ 100000, two decimals; ≥ 1 inclusion each with label ≤ 60 and icon in `ICON_KEYS`; `gallery` null or exactly `GALERIJ_AANTAL` unique ids; `spotsLeft <= spotsTotal`. Returns Dutch field errors keyed by field path (e.g. `inclusions.2.label`).
- [ ] **Step 3: Implement `maakSlug`** (lowercase, diacritics stripped, non-alphanumerics → `-`, collapse/trim) → e.g. `maakSlug("Umrah Budget", "November 2026") === "umrah-budget-november-2026"`.
- [ ] **Step 4: Run `npm run typecheck && npm run lint`.** Expected: pass. Also run `node --experimental-strip-types -e` (or a scratch script in the scratchpad) asserting: `maakSlug` example above; `valideerReis` of a copy of `src/data/trips/umrah-budget-november-2026.json` (with inclusion ids expanded) returns `ok: true`; the same with `gallery` of 5 ids returns `fouten.gallery`; `returnDate` before `departureDate` returns `fouten.returnDate`.
- [ ] **Step 5: Apply migration locally** (`wrangler d1 execute taalibtravels-leads --local --file=./worker/migraties/002-reizen-afbeeldingen.sql`), run `npm run cf-typegen`, and confirm `Env` now has `MEDIA`.
- [ ] **Step 6: Commit** `feat: schema en gedeelde validatie voor reizen en foto's`.

---

### Task 3: Seed existing content into D1 and R2

**Files:**
- Create: `scripts/seed-bestaande-content.mjs`

**Interfaces:**
- Consumes: Task 2 schema and `valideerReis`.
- Produces: `node scripts/seed-bestaande-content.mjs --local|--remote` — idempotent import. R2 keys are `fotos/<id>/<breedte>.webp` for each width in `ALL_WIDTHS` (from `scripts/image-sizes.mjs`); `afbeeldingen.r2_sleutel` stores the prefix `fotos/<id>`.

- [ ] **Step 1: Implement the script**: read `images.json`, `gallery.json`, `trips/*.json`, `inclusions.json`; generate WebP variants with `sharp` from `public/images/<id>.jpg` for every width ≤ the source width; upload with `wrangler r2 object put taalibtravels-media/<key> --file … --content-type image/webp` (`--local`/`--remote` as given); insert rows with `INSERT … ON CONFLICT DO NOTHING`; expand each trip's inclusion ids into `{label, description, icon}`. Run every trip through `valideerReis` first and abort on any error.
- [ ] **Step 2: Run it with `--local`**, then `wrangler d1 execute … --local --command "SELECT COUNT(*) FROM reizen; SELECT COUNT(*) FROM afbeeldingen; SELECT COUNT(*) FROM galerij;"`. Expected: 3, 32 (count of ids in `images.json`), 6. Run it a second time; expected: same counts, no errors.
- [ ] **Step 3: Commit** `feat: importscript voor bestaande reizen en foto's`. (The `--remote` run happens in Task 9.)

---

### Task 4: Worker API for trips

**Files:**
- Create: `src/lib/reizen-db.ts`, `worker/reizen.ts`
- Modify: `worker/index.ts` (route inside the existing session gate), `src/lib/api.ts` if the architect adds shared types

**Interfaces:**
- Consumes: `valideerReis`, `ReisInvoer`, `API.reizen`, `reisPad`.
- Produces in `src/lib/reizen-db.ts`: `leesReizen(db: D1Database, opts?: { metConcepten?: boolean }): Promise<Trip[]>` (sorted by `departure_date`, resolves images to `ImageAsset` with `src` = `MEDIA_PAD + sleutel + "/" + breedte + ".webp"` base form, see Task 6), `leesReis(db, slug, opts?): Promise<Trip | null>`, `leesGalerij(db): Promise<ImageAsset[]>`, `schrijfReis(db, reis: ReisInvoer, nu: string): Promise<void>`, `verwijderReis(db, slug): Promise<boolean>`.
- Produces routes: `GET /api/admin/reizen` (all incl. drafts), `POST /api/admin/reizen` (create; 409 on existing slug), `GET|PUT|DELETE /api/admin/reizen/:slug` (PUT rejects a body whose slug differs from the path).

- [ ] **Step 1: Implement `reizen-db.ts`**; `schrijfReis` verifies that the cover and gallery ids exist in `afbeeldingen` and fails with a field error otherwise (explicit check, not by reading a D1 error message); sets `updated_at`.
- [ ] **Step 2: Implement the handlers** with `Origin` check for POST/PUT/DELETE, `valideerReis` as the judge, and the status codes above; errors in Dutch via the existing `json()` helper.
- [ ] **Step 3: Run `npm run typecheck && npm run lint`**, then `npm run preview` and with a valid session cookie (login via `POST /api/admin/login`, saved with `curl -c`): POST a new trip → 200; same slug again → 409; invalid body → 400 with `fouten`; PUT changes `title`; DELETE → 200 and then GET → 404; each of these without cookie → 401; POST with `Origin: https://evil.example` → 403. Expected: all as stated.
- [ ] **Step 4: Commit** `feat: beheer-API voor reizen`.

---

### Task 5: Worker API for photos, shared gallery and `/media`

**Files:**
- Create: `worker/afbeeldingen.ts`, `worker/media.ts`
- Modify: `worker/index.ts`, `src/lib/api.ts`

**Interfaces:**
- Consumes: `API.afbeeldingen`, `API.galerij`, `afbeeldingPad`, `MEDIA_PAD`, `ALL_WIDTHS`.
- Produces routes: `GET /api/admin/afbeeldingen` (list with usage counts); `POST /api/admin/afbeeldingen` (multipart: `alt`, `width`, `height`, and one `v<breedte>` WebP file per variant); `PATCH /api/admin/afbeeldingen/:id` (`{alt}`); `DELETE /api/admin/afbeeldingen/:id` (409 when used, else removes D1 row and all R2 variants); `GET|PUT /api/admin/galerij` (PUT body `{ ids: string[] }` of exactly six); public `GET /media/fotos/<id>/<breedte>.webp` from R2 with `Cache-Control: public, max-age=31536000, immutable`.

- [ ] **Step 1: Implement upload validation**: each part must be `image/webp` (also verify the RIFF/WEBP magic bytes, not just the header), ≤ 1 MB per variant, widths only from `ALL_WIDTHS`, at most `ALL_WIDTHS.length` parts, `alt` required (≤ 200), source `width`/`height` integers in sensible bounds. The id is generated server-side (`crypto.randomUUID()` short form); nothing from the client becomes an R2 key.
- [ ] **Step 2: Implement the usage check for DELETE** (cover of any trip, member of any trip `gallery`, or in `galerij`) returning 409 with Dutch text naming the trip titles or "de homepagegalerij".
- [ ] **Step 3: Implement `/media`** serving only keys that match `^fotos/[a-z0-9-]+/\d+\.webp$`, 404 otherwise, with `ETag`.
- [ ] **Step 4: Verify with `npm run preview` and curl**: upload a real WebP → 200 and the file is retrievable at `/media/…`; upload a `.txt` renamed to `.webp` → 400; oversized → 400/413; DELETE of a seeded cover photo → 409 naming the trip; DELETE of the fresh unused upload → 200 and its `/media/…` URL → 404; PUT galerij with five ids → 400; all writes without cookie → 401. Expected: all as stated.
- [ ] **Step 5: Commit** `feat: beheer-API voor foto's en galerij, plus /media`.

---

### Task 6: Public site reads from D1

**Files:**
- Modify: `src/lib/content.ts`, `src/app/page.tsx`, `src/app/reizen/page.tsx`, `src/app/reizen/[slug]/page.tsx`, `src/app/sitemap.ts`, `src/components/trips/gallery-section.tsx`, `src/components/trips/trip-detail.tsx` (typo "BeeldEN" → "Beelden"), `src/lib/image-loader.ts`, `next.config.ts`
- Check: `src/components/home/*`, `src/components/trips/trip-card.tsx` for consumers of the trip functions

**Interfaces:**
- Consumes: `leesReizen`, `leesReis`, `leesGalerij` from `src/lib/reizen-db.ts`.
- Produces in `content.ts`: `getTrips(): Promise<Trip[]>`, `getTripBySlug(slug: string): Promise<Trip | null>`, `getNextTrip(): Promise<Trip | null>` (null when there are no trips), `getGallery(): Promise<ImageAsset[]>`; `getTripSlugs` and `generateStaticParams` are removed. `SITE`, `NAV_LINKS`, `FAQ`, `GIVEAWAY`, `PRIVACY` stay as JSON and stay synchronous so the navbar bundle stays free of D1.
- `ImageAsset.src` for managed photos is `/media/fotos/<id>` (no width); `image-loader.ts` appends `/<width>.webp` for `/media/` sources and keeps its current mapping for `/images/…` and passes everything else through unchanged.

- [ ] **Step 1: Split `content.ts`**: keep static JSON exports; move trip/gallery functions to async D1 readers via `getCloudflareContext().env.DB`; remove the build-time resolvers and `TRIP_FILES` use. Mark trip pages `export const dynamic = "force-dynamic"`; unknown or draft slug → `notFound()`.
- [ ] **Step 2: Handle the empty list**: the homepage hero and `/reizen` show the existing empty/fallback copy when `getNextTrip()` returns null (the architect picks the copy; no crash).
- [ ] **Step 3: Update `image-loader.ts`** as specified and add the `/media/*` origin to nothing else (same origin, so CSP `img-src 'self'` still holds).
- [ ] **Step 4: Run `npm run lint && npm run typecheck && npm run build`**, then `npm run preview` after Task 3's local seed. Expected: `/`, `/reizen`, `/reizen/umrah-budget-november-2026`, `/sitemap.xml` render the same content as before; a slug that does not exist and a draft slug give the 404 page; changing a title via the Task 4 API shows on the next page load without a rebuild; the page source contains per-trip `<title>` and `og:image` pointing to `/media/…`.
- [ ] **Step 5: Commit** `feat: reispagina's lezen uit D1, direct live`.

---

### Task 7: Admin UI — tabs and trips

**Files:**
- Modify: `src/components/admin/admin-paneel.tsx`
- Create: `src/components/admin/reizen-beheer.tsx`, `src/components/admin/reis-formulier.tsx`, `src/components/admin/foto-kiezer.tsx`

**Interfaces:**
- Consumes: `API.reizen`, `reisPad`, `valideerReis`, `maakSlug`, `ICON_KEYS`, `INCLUSION_ICONS`, `Field`, `Checkbox`, `AfbeeldingenAntwoord`.
- Produces: `ReizenBeheer` (list + status + hide/show + delete with confirm + "Nieuwe reis"), `ReisFormulier({ reis?: Trip; onKlaar: () => void })` covering every field in the spec's table, `FotoKiezer({ waarde: string[]; max: number; onChange })` (single pick when `max = 1`, exactly-six pick otherwise, showing thumbnails from `/media/…`).

- [ ] **Step 1: Add tabs** (Deelnemers · Reizen · Foto's) to `AdminPaneel` as keyboard-accessible `role="tablist"`; the existing deelnemers view is unchanged.
- [ ] **Step 2: Build `ReisFormulier`**: slug auto-filled from `maakSlug` on create and read-only on edit; description paragraphs and inclusions as add/remove/reorder lists; inclusions offer the 8 icons and quick-add suggestions from `src/data/inclusions.json`; client-side `valideerReis` for early messages, server errors mapped back onto fields; loading, error and success states; the save button is disabled while saving.
- [ ] **Step 3: Build `ReizenBeheer`** with delete confirmation that names the trip, and surfaces server 409/400 messages.
- [ ] **Step 4: Run `npm run lint && npm run typecheck && npm run build`**, then in `npm run preview` log in and: create a trip with a new slug, see it on `/reizen` after reload; edit its price and see it on its detail page; hide it and get the 404 page; delete it. Check at 375px width and keyboard-only navigation. Expected: all work with no console errors.
- [ ] **Step 5: Commit** `feat: beheerportaal voor reizen`.

---

### Task 8: Admin UI — photos, plus security headers on dynamic pages

**Files:**
- Create: `src/components/admin/fotos-beheer.tsx`, `src/components/admin/upload-foto.ts`
- Modify: `src/components/admin/admin-paneel.tsx`, `worker/index.ts` (apply the headers from `public/_headers` to dynamic responses), `public/_headers`

**Interfaces:**
- Consumes: `API.afbeeldingen`, `API.galerij`, `afbeeldingPad`, `ALL_WIDTHS` (the constant must be importable by the client without Node-only code: the architect re-exports the numbers into an alias-free `src/lib/foto-breedtes.ts` that `scripts/image-sizes.mjs` and `next.config.ts` also read, so the ladder stays in one place).
- Produces: `maakVarianten(bestand: File): Promise<{ width: number; height: number; varianten: Map<number, Blob> }>` in `upload-foto.ts` (canvas → WebP per width ≤ source width, quality 0.78, capped source of 4000px on the long side); `FotosBeheer` with multi-upload, alt-text editing, delete (shows the 409 text), and a section "Homepagegalerij" using `FotoKiezer` for exactly six.

- [ ] **Step 1: Implement `maakVarianten` and the upload flow** with per-file progress and an error per file; alt text required before upload.
- [ ] **Step 2: Implement the photos tab and the shared-gallery editor.**
- [ ] **Step 3: Apply the CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `X-Robots-Tag` for `/admin*` to dynamic responses in the Worker**, using one shared header list so `_headers` (static assets) and the Worker cannot drift. Dynamic pages must not get `immutable` caching; `/admin*` gets `no-store`.
- [ ] **Step 4: Verify** in `npm run preview`: upload two photos (one landscape JPEG ≥ 3000px, one PNG) and see them in the library; attach one as cover and into a gallery in the trip form; confirm `curl -I /` and `/reizen/<slug>` show the CSP header; confirm the Turnstile giveaway page still loads its widget (CSP unchanged); deleting the in-use photo shows the 409 text. Expected: all as stated.
- [ ] **Step 5: Commit** `feat: fotobeheer en beveiligingsheaders op dynamische pagina's`.

---

### Task 9: Cleanup, docs and production switch-over

**Files:**
- Delete: `src/data/trips/*`, `src/data/gallery.json`, `src/data/images.json` (after seed is verified remote), `scripts/build-images.mjs` and the `images`/`prebuild` scripts if no longer used
- Modify: `CLAUDE.md`, `README.md`, `package.json`, `wrangler.jsonc` (R2 binding with a comment on why it exists), `.gitignore`

- [ ] **Step 1: Create the R2 bucket** (`wrangler r2 bucket create taalibtravels-media`) and apply migration 002 to the remote D1.
- [ ] **Step 2: Run `node scripts/seed-bestaande-content.mjs --remote`** and confirm counts with a remote `SELECT COUNT(*)`.
- [ ] **Step 3: Remove the obsolete JSON, scripts and unused code** (`getTripSlugs`, `TRIP_FILES`, build-time resolvers) and update `CLAUDE.md` (architecture, commands, "Content is data" section, headers section, photo section) and `README.md` to the new reality.
- [ ] **Step 4: Run `npm run lint && npm run typecheck && npm run build`.** Expected: all pass with no references to removed files.
- [ ] **Step 5: Deploy only after the user confirms** (`npm run deploy`), then check production: `/`, a trip page, `/media/…`, `/admin` login, and one create/delete round-trip.
- [ ] **Step 6: Commit** `docs: CLAUDE.md en README bijgewerkt voor het beheerportaal`.

---

### Task 10: Whole-branch review and optimisation

- [ ] **Step 1: `reviewer` over the whole branch** against the spec and the Review Focus list; fix findings through `engineer` until the reviewer reports none.
- [ ] **Step 2: `optimizer` on the public trip pages**: measure D1 queries per page and photo bytes on mobile; change only what a measurement justifies; page behaviour stays identical.
- [ ] **Step 3: Re-run lint, typecheck, build and the Task 7/8 verification flows**; report real output.

---

## Spike result

**Besluit: werkt, met aanpassingen** (Task 1, 2026-11-15). Doorgaan met het plan.

- **Versie:** `@opennextjs/cloudflare@1.20.2`. Dat is de nieuwste die Next 16.2.12 en wrangler 4.121 in zijn peer-range heeft; vanaf 1.20.3 eist hij Next >=16.3.3 (en wrangler >=4.125), 1.20.16 zelfs >=16.4.5. Een upgrade van Next en wrangler is dus een aparte stap.
- **Build/preview:** `opennextjs-cloudflare build` slaagt (lint en typecheck ook). Scripts `preview` en `deploy` roepen dat nu aan i.p.v. `next build`. `wrangler dev` serveert `/`, `/reizen`, `/reizen/<slug>`, 404 en `/giveaway` correct.
- **D1 vanuit Next:** een `force-dynamic` pagina leest via `getCloudflareContext({ async: true }).env.DB` en toonde 0, daarna 1 na een `wrangler d1 execute --local` INSERT, zonder rebuild. `/api/admin/deelnemers` geeft nog 401.
- **Worker-compositie:** `worker/index.ts` blijft de `main` en importeert `../.open-next/worker.js`; alles buiten `/api/` gaat naar `openNext.fetch(request, env, ctx)`. Dat composeert zonder problemen. Aanpassingen: `worker/open-next.d.ts` (typedeclaratie, het bestand bestaat pas na de build), `fetch` krijgt `ctx`, `assets.directory` is `.open-next/assets`, `run_worker_first` en `not_found_handling` zijn weggehaald, `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]` toegevoegd. De DO-klassen (`DOQueueHandler` e.d.) worden niet geherexporteerd: zonder incrementele cache/queue-config zijn ze niet gebonden.
- **Env-type:** het root-tsconfig sluit `worker-configuration.d.ts` uit, dus `CloudflareEnv` kent `DB` niet in `src/`. Task 4+ moet een eigen `interface CloudflareEnv` of een smalle cast gebruiken (nu in de spike een cast).
- **Headers (Task 8):** `public/_headers` geldt alleen voor statische assets (`/images/...` kreeg CSP e.d.). De HTML-responses van `/`, `/reizen/<slug>` en de 404 hebben geen CSP, `X-Content-Type-Options`, `Referrer-Policy` of `Permissions-Policy`. Fix: de headers in `worker/index.ts` op elke niet-asset-response zetten (of via `headers()` in `next.config.ts`; die draait nu wel). Let op: de CSP vereist dan nog steeds `'unsafe-inline'` voor scripts.
- **Caching (Task 6/8):** prerendered pagina's komen terug met `Cache-Control: s-maxage=31536000`. Zonder incrementele cache (R2) en revalidatie blijven ze tot de volgende build staan; pagina's die uit D1 gaan lezen moeten `force-dynamic` zijn of expliciet revalideren.
- **Bundelgrootte:** `wrangler deploy --dry-run`: Total Upload 5293.90 KiB, gzip 1146.66 KiB. Volgens de huidige Cloudflare-limietenpagina is er geen gzip-limiet en 64 MiB ongecomprimeerd voor Free en Paid; dit past dus ruim op het Free-plan. Betaald plan is hiervoor niet nodig.
- **Overig:** `package-lock.json` veranderde sterk door de installatie (npm herschreef de boom); controleer dat bij review. Image-loader en `deviceSizes` ongewijzigd; `output: "export"` en de exportcomment zijn weg.

