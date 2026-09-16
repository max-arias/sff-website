# AGENTS.md

This repo is for **SFF Builder**, a fitment engine for small-form-factor PC builds.

## Start Here

Read these files before making product or UX changes:

- [CONTEXT.md](./CONTEXT.md)
- [PRODUCT.md](./PRODUCT.md)
- [README.md](./README.md)
- [docs/adr/0001-build-route-and-url-state.md](./docs/adr/0001-build-route-and-url-state.md)

## Product Shape

- The product is a **fitment engine**, not a generic component catalog or recommendation site.
- The canonical stateful experience is intended to live at `/build`.
- The root route `/` currently resolves to the builder experience; utility-first build workflow is the homepage for now.
- URL query params are treated as a **public, human-readable, replayable contract**.

## Important Domain Rules

- Keep `pass`, `conditional`, and `fail` visible. Do not hide failing rows by default.
- `fail` means a known hard conflict.
- `conditional` covers uncertainty, incomplete data, and practical build risk.
- The system is **non-blocking**: users can still select risky or failing parts.
- Selected parts remain selected; issues should be surfaced, not auto-corrected away.
- Release scope uses **catalog-only selection** from current catalog record IDs.

## UI Direction

- `/build` should behave like a **filterable data table** driven by URL state.
- The selected build should remain visible in a persistent panel.
- Empty slots should stay visible and expose actions into the table.
- Fitment evidence should be visible in the table itself, especially at the failing or cautionary column.

## Current Reality Vs Intended Direction

- Some current code may still reflect older launcher/homepage experiments.
- When product docs and current UI code disagree, prefer the documented direction in `CONTEXT.md` and the ADR unless the user explicitly says otherwise.

## Data Notes

- The catalog is stored in per-kind D1 tables: `cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, and `ram`.
- Selected part identity should use concrete catalog record IDs from those tables.

## Catalog Delivery And D1 Budget

The catalog is **immutable between data deployments** and is now delivered to
the browser as a static artifact. `/build` performs **zero D1 reads**: the
browser downloads `catalog.sqlite3.gz`, caches it, and queries it locally.

- The artifact is built by `npm run catalog:browser` (local D1) or
  `catalog:browser:prod` / `:preview` (remote D1) into `public/catalog/`. It is
  gitignored and regenerated on every deploy; never commit it.
- D1 is the **write-side source of truth and pipeline dependency only**. Do not
  reintroduce Worker-side catalog reads on `/build` — that is what the artifact
  replaced.
- There are **no `/api/*` routes**. The Worker serves `/build`, `/`, and static
  assets only, and reads no bindings at request time. Adding an API route that
  queries D1 would reintroduce the read budget the artifact removed.
- Any D1 query that remains on a hot path must be indexed and bounded. No
  whole-table reads, no worker-side catalog scans, no per-request aggregate
  counts.
- Search inside the artifact uses the FTS5 trigram index on `catalog_search`,
  requiring at least three normalized characters. Keep the artifact's schema
  identical to the D1 `catalog_search` definition in `migrations/0008_catalog_search_fts.sql`
  so client and server ranking stay in parity.
- For every new or changed D1 query, run `EXPLAIN QUERY PLAN` against local D1.
  A hot query needs an indexed `SEARCH`/FTS plan or an explicit bounded reason
  to scan.
- Add supporting indexes and run `PRAGMA optimize` in a forward D1 migration.
  Verify the migration locally before deployment.
- After an independent catalog data change, bump the artifact: the browser
  re-downloads only when the manifest version changes, and the Cache API key
  includes that version.

## Local Development

- Both dev servers work. `npm run cf:dev` (Wrangler) serves the built `dist/` output, so it exercises the real asset layer and Worker bundle; `npm run dev` (Astro) serves source with HMR and is the faster loop for UI work. Prefer Wrangler when you need built-output fidelity.
- Either server needs the catalog artifact on disk first: `npm run catalog:browser` (or `npm run build`). Without it `/build` loads and then reports that the catalog could not be fetched.
- `npm run build` builds the catalog from local D1, falling back to remote D1 when local D1 has no catalog rows (a clean checkout). It prints which source it used; check that line when a build looks surprising.
- Dev and production disagree about who decodes the catalog artifact. The Vite dev server serves `.gz` with `Content-Encoding: gzip`, so the browser decodes it before the worker sees it; the Workers asset layer serves it raw with `Content-Type: application/gzip`. `catalog.worker.ts` sniffs the gzip magic bytes and handles both. Do not replace that with an assumption about either host — the artifact will silently fail to load on the other one.
- Bindings are emulated in dev, so dev is not a substitute for checking deploy-time behaviour (asset headers, caching, D1 permissions).

## Contribution Model

- V1 contribution intake is via GitHub issues plus manual review.
- Do not assume wiki-style direct editing exists in the shipped product.

## Agent skills

### Issue tracker

Issues live in GitHub Issues; external pull requests are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using the root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
