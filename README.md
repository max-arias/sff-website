# SFF PC Builder

Astro 7 + Tailwind CSS 4 fitment engine for small-form-factor PC builds. The stateful builder lives at `/build`; the root route rewrites to `/build` so the builder is the primary experience. The catalog is stored in per-kind D1 tables (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`) with URL-backed filters, search, and build state.

For product intent, audience, and scope, see [PRODUCT.md](./PRODUCT.md).

## First Run

```powershell
npm install
npm run intake
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

The intake command fetches the public SFF Master List tabs, normalizes a broad generic part catalog plus the current case/GPU compatibility projections, and writes:

- `.data/intake-seed.sql`

## Search

The root route rewrites to `/build`, where a global autocomplete search is available. It queries D1 after 3 typed characters, shows a loading state while the request is in flight, and returns richer labels so builders can distinguish actual SKUs instead of vague display names alone.

## Build Table Filters

The `/build` table is URL-backed. Search, active kind, sort, pagination, selected parts, numeric filters, and sparse-row visibility are encoded in query params so the view can be shared and replayed.

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

- [Architecture review HTML report](./docs/architecture/architecture-review-20260713.html)
- [Session handoff](./docs/architecture/session-handoff-20260713.md)
- [Continuation prompt](./docs/architecture/continuation-prompt-20260713.md)

Recent cleanup refactors extracted the fitment engine, added a catalog-store seam, centralized build query serialization, centralized numeric filter params, and replaced row-level evidence highlighting with cell-level evidence metadata. See [`docs/architecture/README.md`](./docs/architecture/README.md) for details.

Completed architecture cleanup:

- Reviewed the refactor series for standards and product-spec alignment.
- Replaced row-level `highlightCellIndex` with a cell-level evidence model while keeping `src/fitment/` UI-agnostic.
- Consolidated focused TypeScript suites behind `npm run test`.

Current architecture TODOs:

- Implement constraint-aware empty-slot actions / constraint jumps without breaking the public URL query contract.
- Surface provenance/source attribution as a first-class fitment evidence feature.
- Continue shrinking `src/server/build-view.ts` through small, tested seams.
