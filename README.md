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
npm run db:migrate:remote
npm run cf:deploy
```

## Data Model

The importer keeps optimized compatibility projections for:

- `SFF Case <10L`
- `SFF Case 10L-20L`
- `SFF GPU <215mm`
- `GPU >215mm`

It also ingests the broader SFF Master List into generic `sff_parts`, `sff_part_specs`, `sff_part_dimensions`, and `sff_part_source_rows` tables so future compatibility engines can support coolers, AIOs, fans, RAM, risers, motherboards, PSUs, CPUs, chipsets, storage, radiators, and related references.

Rows with unknown dimensions are imported, flagged, and shown with warnings instead of being discarded.

For the v1 data direction, see [DATA_V1.md](./DATA_V1.md).
