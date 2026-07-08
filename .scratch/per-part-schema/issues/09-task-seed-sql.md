Type: task
Status: resolved

## Answer

Created `src/lib/slug.ts` with `generateSlug` and `uniqueSlug` functions. Rewrote `src/lib/sql.ts` to replace `genericPartInsert` with 7 per-table INSERT generators and updated `buildSeedSql` to route parts by `kind` using a switch statement with global slug uniqueness tracking.

**Files changed:**
- `src/lib/slug.ts` — new file, slug normalization + collision-safe generation
- `src/lib/sql.ts` — per-table insert functions, removed `sff_parts` and `import_runs` references

**TypeScript:** `npx tsc --noEmit` passes with zero errors.

Blocked by: 08

## Question

Update `src/lib/sql.ts` to generate seed SQL for the new 7-table schema.

Current state: `genericPartInsert()` builds INSERT statements for `sff_parts`, and `buildSeedSql()` assembles DELETE+INSERT for `sff_parts` and `import_runs`.

New requirements:
- Remove all `sff_parts` and `import_runs` SQL generation
- Replace with per-table INSERT generators for `cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`
- The `buildSeedSql()` function should produce DELETE + INSERT per table
- Slug generation logic is included here — the SQL builder (or a companion module) must normalize brand+name into a globally unique slug before generating the INSERT
- Radiator boolean flags, drive max counts, fan/I/O counts are parsed from raw source values by the import pipeline before reaching the SQL generator

The function signature may need to change to accept per-kind typed objects rather than a flat `GenericPart` + optional `CasePart`/`GpuPart`.
