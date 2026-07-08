Status: ready-for-agent

# Per-Part Schema Redesign

## Problem Statement

Right now, every part in the **Component Catalog** — cases, GPUs, coolers, PSUs, motherboards, RAM, fans — lives in a single wide `sff_parts` table with a `kind` column. The table has grown organically: 63 columns in the initial migration, plus PSU tier enrichment columns and a release year column. GPU-specific fields (gpu_chipset, gpu_model, gpu_low_profile) sit next to case-specific fields (case_style, case_gpu_riser) in the same row, and most columns are empty for any given kind.

This causes three problems:
1. **Missing data**: The current schema captures only a subset of columns from the SFF Master List source sheets. Each sheet has 25–43 columns, but `sff_parts` flattens them into a lowest-common-denominator shape, discarding fan slot counts, I/O ports, drive bays, radiator support details, and more.
2. **Poor filterability**: Multi-value fields like AIO support or fan configuration are stuffed into JSON blobs (`specs_json`) or ignored entirely, making it impossible to filter candidates by radiator size or fan count.
3. **No future-proofing**: Adding a new part kind or new columns means another `ALTER TABLE` on a monolithic table, and the row mapping functions (`rowToCase`, `rowToGpu`) must filter out irrelevant columns.

The product direction calls for **Type-Specific Table Schemas** and **Kind-Specific Filter Sets** — each part kind should own its data shape. The current design blocks that.

## Solution

Replace the single `sff_parts` table with **7 dedicated tables**, one per part kind — each with URL-friendly slug-based primary keys, typed columns for every attribute from their SFF Master List source sheets, and parser-friendly columns for multi-value fields. Add a **column help table** for surfacing domain notes and definitions in the UI. Drop all existing migrations and start fresh.

## User Stories

1. As a builder browsing cases on `/build`, I want to see fan slot counts (how many 120mm, 140mm, etc. fans a case supports) so I can plan cooling without leaving the table.
2. As a builder, I want to filter cases by AIO radiator size (e.g., "supports 240mm AIO") so I can find cases compatible with my cooler.
3. As a builder, I want to filter cases by volume tier (sub-10L, 10–20L, over 20L) so I can find cases that match my size goals.
4. As a builder, I want to filter cases by motherboard form factor (mITX, mATX, ATX) so I can narrow cases to ones that fit my board.
5. As a builder, I want to see I/O port counts (USB-A, USB-C, audio jack) so I know what front panel connectivity a case offers.
6. As a builder, I want to filter cases by style (Sandwich, Console, Reference, APU, Open, NAS) so I can find layouts that match my build intent.
7. As a builder, I want to see and filter drive bay counts (2.5", 3.5", 5.25") so I can plan storage in my SFF build.
8. As a builder, I want to see case material and side panel type so I can assess build quality and aesthetics.
9. As a builder, I want the case table to show prices in both CNY and USD so I can evaluate cost regardless of the seller's listed currency.
10. As a builder, I want to see and filter by PSU form factor support (Flex ATX, SFX, SFX-L, ATX) in cases so I can match my PSU to the case.
11. As a builder, I want to see tooltips or info text on ambiguous columns (e.g., "GPU Height / Thickness assumes 20mm per PCIe slot") so I understand what the numbers mean.
12. As a builder browsing GPUs on `/build`, I want to see GPU-specific attributes (chipset, TDP, PCIe power pins, watercooled flag, low-profile flag) in dedicated columns so I can filter and compare GPUs meaningfully.
13. As a builder browsing CPU coolers, I want to see cooler height, fan size, and socket compatibility so I can find coolers that fit my case and CPU.
14. As a builder browsing PSUs, I want to see form factor, wattage, and tier ratings in dedicated columns so I can match my case and power requirements.
15. As a builder browsing motherboards, I want to see form factor, socket, and chipset in dedicated columns so I can match my case and CPU.
16. As a builder browsing RAM, I want to see module height so I can check clearance against my CPU cooler.
17. As a builder browsing fans, I want to see fan size, thickness (slim vs standard), and RPM so I can match my case's fan slots.
18. As a builder, I want shareable URLs to use human-readable part IDs (e.g., `/build?case=formd-t1`) instead of opaque import-derived IDs so links are self-documenting.
19. As a developer, I want each part kind to have its own database table so I can add kind-specific columns without affecting other kinds.
20. As a developer, I want the fitment engine to query type-safe tables instead of filtering a monolithic table by `kind`, so engine logic is simpler and less error-prone.
21. As a developer, I want the import pipeline to map each source sheet directly to its corresponding table, so adding or changing a sheet only touches one import path.
22. As a contributor submitting a correction via **Contribution Intake**, I want the part identity (slug) to be stable and human-readable so my issue references a clear, recognizable part.

## Implementation Decisions

### Schema Architecture

- **7 tables** replace `sff_parts`: `cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`. Each source sheet tab maps to its kind's table, with multiple tabs of the same kind (e.g., 3 case tabs, 2 GPU tabs) merging into one table.
- All existing migrations (`0001_initial.sql`, `0002_psu_tier_enrichment.sql`, `0003_release_year.sql`) are dropped. A fresh `0001_initial.sql` creates all 7 tables plus the import tracking and help tables.
- Every sheet attribute gets a **dedicated typed column** (integer, real, text, boolean). No JSON blob catch-alls for part data. The `specs_json`, `dimensions_json`, and `flags_json` columns are eliminated.

### ID Scheme

- Primary keys are **text slugs** generated from the source data: `brand-name-modifier` (e.g., `formd-t1`, `ncase-m1`).
- Slugs are lowercase, with spaces/hyphens/underscores normalized to hyphens and special characters stripped.
- A "modifier" portion is extracted from the model name where applicable (e.g., "RTX 4070 OC Edition" → modifier "oc-edition").
- When `brand-name-modifier` collides, a numeric suffix is appended (e.g., `formd-t1-2`). This is the last-resort fallback.
- Slugs are unique per table (not globally across all tables).
- Slugs are stable across re-imports — tied to the part's identity, not its row position.

### Multi-Value Field Strategy

Multi-value fields like AIO support (`120 / 240 / 4 x 240`) and fan counts (`1-3`) are stored as **boolean + count columns per variant** rather than raw text, to enable direct SQL filtering:

- AIO/radiator support becomes: `radiator_120 boolean`, `radiator_140 boolean`, `radiator_240 boolean`, `radiator_280 boolean`, `radiator_360 boolean`, `radiator_420 boolean`.
- Fan support (per size) becomes: `fan_40_count integer`, `fan_60_count integer`, `fan_80_count integer`, `fan_92_count integer`, `fan_120_count integer`, `fan_140_count integer`, `fan_180_count integer`, `fan_200_count integer`.
- Drive bays become: `drive_25_count integer`, `drive_35_count integer`, `drive_525_count integer`.
- I/O ports become: `io_usb_a_20_count integer`, `io_usb_a_32_count integer`, `io_usb_c_count integer`, `io_35mm_jack boolean`.

### Volume Tier

- The three case volume tiers (<10L, 10L–20L, >20L) are **not stored as a column**. They are derived at query time from the `volume_l` column.
- UI filters for volume tier translate to `WHERE volume_l < 10`, `WHERE volume_l >= 10 AND volume_l < 20`, etc.

### Column Help Table

- A new `column_help` table stores domain knowledge notes keyed by `(table_name, column_name)`:
  - Style definitions (APU, Sandwich, Console, Reference, Open, NAS)
  - Footprint calculation note ("Approximate desk space (Length × Width)")
  - GPU Height/Thickness assumption ("Assume 20mm per PCIe slot")
  - Motherboard form factor dimensions
  - PSU form factor dimensions
- The runtime queries this table alongside part data so the UI can surface tooltips and info text.

### Cross-Table Conventions

- Table names: **plural** (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`).
- Primary key column: `id text primary key` on every table.
- Every table includes: `source_sheet text not null` (which source tab the row came from), `source_row_number integer not null` (row position in that tab), `created_at text not null default current_timestamp`, `updated_at text not null default current_timestamp`.
- `status` column on every table: stores the part's availability (`active`, `discontinued`, `unreleased`, etc.).
- Import runs remain tracked via an `import_runs` table. Each table tracks its own `import_run_id` as a foreign key.
- `specs_json`, `dimensions_json`, `flags_json`, `links_json` columns are eliminated. Hyperlinks become typed columns (e.g., `product_url text`, `sffnet_url text`).

### Code Changes

The following modules will be built or modified:

- **D1 migrations**: A single new `migrations/0001_initial.sql` replaces all existing migrations. Creates all 7 tables, `import_runs`, and `column_help`.
- **Runtime queries** (`src/server/d1.ts`): Each kind gets its own query function (e.g., `getCasesFiltered()`, `getGpusFiltered()`) instead of the generic `getPartsFiltered()` with a `kind` parameter. Row mapper functions (`rowToCase`, `rowToGpu`, `rowToGenericPart`) are replaced with per-table mappers that use the full typed column set.
- **Seed SQL generation** (`src/lib/sql.ts`): The `genericPartInsert()` and `buildSeedSql()` functions are replaced with per-table INSERT generators. The output SQL deletes from and inserts into each table independently.
- **Import pipeline** (`scripts/seed-d1.ts`): Updated to handle per-table seed SQL. May split seeding into multiple D1 execute calls, one per table.
- **Fitment engine**: Case→GPU clearance checks read from the `cases` table instead of `sff_parts`. Future engine expansions (case→cooler, case→PSU) join against the appropriate tables.
- **Kind-specific filter sets**: URL filter parameters become kind-aware. Case filters (volume, style, AIO support, fan counts) are distinct from GPU filters (chipset, length, TDP).

## Testing Decisions

- **What makes a good test**: Tests assert on the external behavior of the data layer — given a known database state, queries return correctly shaped results with correct fitment data. Tests do not assert on internal SQL string construction or implementation details.
- **Seam 1 — D1 query functions**: Seed the database with known data, call the query function, assert the returned objects have the expected shape and values. This covers schema correctness, query correctness, and row mapping.
- **Seam 2 — Seed SQL generator**: Call the SQL builder with known input data, assert the output SQL string contains the correct INSERT statements with expected columns and values per table.
- Tests should live alongside the modules they test (e.g., a `d1.test.ts` next to `d1.ts`, a `sql.test.ts` next to `sql.ts`).
- Prior art: The codebase currently has no formal test suite. These will be the first tests for the data layer.

## Out of Scope

- The UI layer — table column layout, filter controls, and tooltip rendering — is not in this spec. The schema design enables these UI features but does not implement them.
- The fitment engine rules beyond the existing case→GPU clearance checks. New engine rules (case→cooler, case→PSU) are future work.
- Fan, reference, and other catalog-only part kinds that are not v1 **Role Slots** still get tables in the schema, but their runtime query functions and UI integration are deferred.
- The import pipeline's Google Sheets reading logic. The transformation layer (raw sheet row → typed part object) changes, but the Google Sheets API integration is assumed to work as-is.
- Non-case tables get their DDL in the migration, but the detailed column mapping (boolean+count parsing for GPU/cooler/fan fields) is deferred to follow-up specs after the column research tickets are resolved.
- Any existing build URLs using old `sff_parts.id` values will hit the **Unresolved Slot** handling — no redirect or migration of URL state is provided.

## Further Notes

- The column research tickets in the wayfinding map (`.scratch/per-part-schema/issues/01-research-case-columns.md` and `02-research-remaining-columns.md`) must be resolved before any table DDL can be finalized. The column lists in this spec are based on the two case HTMLs that have been analyzed; the full unified column set may differ once all three tabs are reconciled.
- The slug generation algorithm details (normalization rules, modifier extraction, collision handling) are deferred to ticket `03-grilling-slug-generation.md` in the wayfinding map.
- The column help table exact schema is deferred to ticket `05-grilling-help-table.md`.
- The import pipeline and seed SQL generator changes are the largest code change surface. Consider implementing and testing the seed SQL generator first (seam 2), then the D1 query functions (seam 1), then the import pipeline.
- The `DATA_V1.md` documentation file should be updated or replaced to reflect the new schema design.
