# SFF PC Builder

Nuxt 4 + Nuxt UI MVP for checking small-form-factor case and GPU dimensional compatibility. The app targets Cloudflare Workers with D1, while keeping a local JSON snapshot fallback for fast development.

For product intent, audience, and scope, see [PRODUCT.md](./PRODUCT.md).

## First Run

```powershell
npm install
npm run intake
npm run dev
```

The intake command fetches the public SFF Master List tabs, normalizes a broad generic part catalog plus the current case/GPU compatibility projections, and writes:

- `.data/intake-snapshot.json`
- `.data/intake-seed.sql`

## Cloudflare D1

Create the database and update `wrangler.jsonc` with the returned `database_id`:

```powershell
npx wrangler d1 create sff-builder
npm run db:migrate:local
```

For production:

```powershell
npm run cf:deploy:prod
```

## Data Model

The importer stores the SFF Master List in one wide `sff_parts` table with a `kind` column, normalized fields for common filtering, and raw/link JSON for source provenance. The current case/GPU compatibility views are derived from the same table.

Rows with unknown dimensions are imported, flagged, and shown with warnings instead of being discarded.

For the v1 data direction, see [DATA_V1.md](./DATA_V1.md).
