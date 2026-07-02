# SFF PC Builder

Astro 7 + Tailwind CSS 4 for checking small-form-factor case and GPU dimensional compatibility. The current product shell is a single homepage route with light/dark themes, D1-backed search, and API routes that target Cloudflare Workers for both local development and deployment.

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

## Homepage Search

The homepage currently exposes one technical entry surface:

- A global component search.
- A case-first search input.
- A GPU-first search input.

All three autocomplete inputs query D1 after 3 typed characters, show a loading state while the request is in flight, and return richer labels so builders can distinguish actual SKUs instead of vague display names alone.

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

The importer stores the SFF Master List in one wide `sff_parts` table with a `kind` column, normalized fields for common filtering, and raw/link JSON for source provenance. The current case/GPU compatibility views are derived from the same table.

Rows with unknown dimensions are imported, flagged, and shown with warnings instead of being discarded.

For the v1 data direction, see [DATA_V1.md](./DATA_V1.md).
