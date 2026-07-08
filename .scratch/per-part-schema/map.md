## Destination

A complete database schema redesign with 7 dedicated tables (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`), each with URL-friendly slug-based IDs, typed columns for every attribute from their SFF Master List source sheets, a column help table for surfacing domain notes to users, fresh D1 migrations, an updated import pipeline that merges multiple source tabs into each table, updated runtime queries and row mappers, and an updated fitment engine — a full replacement of the current `sff_parts` design.

## Notes

- Domain: SFF Builder fitment engine (read CONTEXT.md, PRODUCT.md before any work)
- Source of truth: Google Sheets SFF PC Master List (online), local HTML/CSV for reference
- 7 tables: `cases` (3 source tabs), `gpus` (2 source tabs), `cpu_coolers` (3 source tabs), `fans` (2 source tabs), `motherboards` (2 source tabs), `psus` (1 source tab), `ram` (1 source tab)
- ID scheme: `brand-name` slug, globally unique, with numeric collision fallback
- Multi-value fields (AIO support, fan counts, drive bays): boolean + count columns per variant
- Column domain notes (Style definitions, footprint formula, size assumptions): stored in a DB help table for UI surfacing
- Volume tier (<10L / 10L-20L / >20L): derived from `volume_l` at query time, not a column
- Migrations: drop all existing migrations, fresh start, no backwards compat

## Decisions so far

1. [Unify all case columns](.scratch/per-part-schema/issues/01-research-case-columns.md) — 41 identical columns across all 3 tabs.
2. [Specify slug generation algorithm](.scratch/per-part-schema/issues/03-grilling-slug-generation.md) — `brand-name` slug, globally unique.
3. [Cross-table naming and provenance conventions](.scratch/per-part-schema/issues/04-grilling-conventions.md) — plural names, `id text` PK, `created_at`/`updated_at`, no source provenance, no import_runs, `status` on every table.
4. [Design column help table schema](.scratch/per-part-schema/issues/05-grilling-help-table.md) — flat `column_help` table with composite PK, seeded with domain notes.
5. [Get remaining sheet columns](.scratch/per-part-schema/issues/02-research-remaining-columns.md) — full column lists for all 7 tables (242 total columns).
6. [Prototype cases table DDL](.scratch/per-part-schema/issues/06-prototype-cases-ddl.md) — 53-column cases table.
7. [Prototype remaining table DDLs](.scratch/per-part-schema/issues/07-prototype-remaining-ddls.md) — DDLs for gpus, cpu_coolers, fans, motherboards, psus, ram.
8. [Write migration SQL](.scratch/per-part-schema/issues/08-task-migration-sql.md) — `migrations/0001_initial.sql` deployed.
9. [Update seed SQL generator](.scratch/per-part-schema/issues/09-task-seed-sql.md) — `src/lib/sql.ts` + `src/lib/slug.ts` deployed.
10. [Update runtime queries](.scratch/per-part-schema/issues/10-task-runtime-queries.md) — `src/server/d1.ts` + `src/server/catalog-search.ts` deployed.

## Files changed

| File | Status |
|------|--------|
| `migrations/0001_initial.sql` | Deployed (replaces 3 old migrations) |
| `migrations/0002_psu_tier_enrichment.sql` | Deleted |
| `migrations/0003_release_year.sql` | Deleted |
| `src/lib/slug.ts` | Created |
| `src/lib/sql.ts` | Rewritten (per-table INSERT generators) |
| `src/server/d1.ts` | Rewritten (per-table queries + row mappers) |
| `src/server/catalog-search.ts` | Updated (generic CatalogSearchRow) |
| `src/lib/compatibility.ts` | In progress (flag checks → typed columns) |

## Not yet specified

<!-- All fog graduated to tickets. All tickets resolved or in progress. -->

## Out of scope

<!-- deliberately excluded from this effort -->
