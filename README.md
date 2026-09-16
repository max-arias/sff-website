# SFF PC Builder

Astro 7 + Tailwind CSS 4 fitment engine for small-form-factor PC builds. The stateful builder lives at `/build`; the root route rewrites to `/build` so the builder is the primary experience.

`/build` is a **client-first** experience. The catalog ships as a static SQLite artifact (`catalog.sqlite3.gz`) that the browser downloads once, caches, and queries locally with sqlite-wasm — so browsing, filtering, search, and fitment perform **no D1 reads**. D1 remains the source of truth for the data pipeline and is what the artifact is built from.

For product intent, audience, and scope, see [PRODUCT.md](./PRODUCT.md).

## First Run

```powershell
npm install
npm run intake
npm run db:migrate:local
npm run db:seed:local
npm run build      # builds public/catalog/ from local D1, then the site
npm run cf:dev     # serve the Worker locally
```

`npm run build` must run before `cf:dev`, because `/build` fetches the catalog
artifact from `public/catalog/`. Without it the page loads and then reports that
the catalog could not be fetched.

The intake command fetches the public SFF Master List tabs, normalizes a broad generic part catalog plus the current case/GPU compatibility projections, and writes:

- `.data/intake-seed.sql`

## Search

Search runs entirely in the browser against the cached catalog artifact, using the same FTS5 trigram `catalog_search` index that D1 uses, so ranking is identical to the server-side implementation. It requires at least three characters and issues no network requests once the catalog is cached.

## Build Table Filters

The `/build` table is URL-backed. Search, active kind, sort, selected parts, numeric filters, and sparse-row visibility are encoded in query params so the view can be shared and replayed.

The table renders the whole filtered result set in one virtualized list — there is no pagination and no `page` parameter. Only rows near the viewport exist in the DOM, so scrolling stays smooth with thousands of rows.

Rows without fitment-relevant data are hidden by default to keep the table focused on useful evidence. The **Show sparse rows** toggle adds `show-sparse=1` to the URL and includes rows whose visible metrics are otherwise blank, such as catalog entries with only a name, brand, or incidental notes.

## Cloudflare D1

Create the database and update `wrangler.jsonc` with the returned `database_id`:

```powershell
npx wrangler d1 create sff-builder
npm run db:migrate:local
npm run db:seed:local
```

For production:

```powershell
npm run cf:deploy:prod
```

For a local Cloudflare Worker smoke test:

```powershell
npm run cf:dev
```

## Data Model

The catalog is stored in per-kind D1 tables (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`), each with columns optimized for that part type. The monolithic `sff_parts` table from earlier versions has been replaced by this kind-specific schema.

Rows with incomplete dimensions are imported and preserved. Rows that have enough fitment context to evaluate should surface uncertainty as warnings; rows with no fitment-relevant fields are hidden from `/build` by default but can be restored with `show-sparse=1`.

For the data model details, see [DATA.md](./DATA.md).

## Architecture Notes And TODOs

Architecture review artifacts are saved in [`docs/architecture/`](./docs/architecture/):

- [Client-side database selection](./docs/architecture/client-side-database-selection-20260910.md)
- [Browser-resident catalog feasibility](./docs/architecture/browser-resident-catalog-feasibility-20260910.md)
- [Architecture review HTML report](./docs/architecture/architecture-review-20260713.html)
- [Session handoff](./docs/architecture/session-handoff-20260713.md)
- [Continuation prompt](./docs/architecture/continuation-prompt-20260713.md)

Recent cleanup refactors extracted the fitment engine, added a catalog-store seam, centralized build query serialization, centralized numeric filter params, and replaced row-level evidence highlighting with cell-level evidence metadata. See [`docs/architecture/README.md`](./docs/architecture/README.md) for details.

Completed architecture cleanup:

- Reviewed the refactor series for standards and product-spec alignment.
- Replaced row-level `highlightCellIndex` with a cell-level evidence model while keeping `src/fitment/` UI-agnostic.
- Consolidated focused TypeScript suites behind `npm run test`.
- Moved view assembly out of `src/server/` into `src/lib/build-view.ts` so the same code serves the browser catalog worker and the in-memory test store.
- Replaced the single-writer OPFS catalog database with a Cache API artifact plus an in-memory sqlite-wasm database, so multiple tabs can load `/build` concurrently.

Current architecture TODOs:

- Implement constraint-aware empty-slot actions / constraint jumps without breaking the public URL query contract.
- Surface provenance/source attribution as a first-class fitment evidence feature.
