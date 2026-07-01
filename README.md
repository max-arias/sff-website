# SFF PC Builder

Nuxt 4 + Nuxt UI MVP for checking small-form-factor case and GPU dimensional compatibility. The app targets Cloudflare Workers with D1, while keeping a local JSON snapshot fallback for fast development.

## First Run

```powershell
npm install
npm run intake
npm run dev
```

The intake command fetches the public SFF Master List tabs, normalizes cases and GPUs, and writes:

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

The importer reads four public Google Sheet tabs:

- `SFF Case <10L`
- `SFF Case 10L-20L`
- `SFF GPU <215mm`
- `GPU >215mm`

Rows with unknown dimensions are imported, flagged, and shown with warnings instead of being discarded.
