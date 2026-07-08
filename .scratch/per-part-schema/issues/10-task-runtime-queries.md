Type: task
Status: resolved

## Answer

Rewrote `src/server/d1.ts` and `src/server/catalog-search.ts` for per-part-type tables.

**Changes:**
- `src/server/d1.ts` — per-table row mappers (`rowToCase`, `rowToGpu`, `rowToGenericPart`), per-table query functions in `loadCatalog`, `loadParts`, `loadCatalogPartsByIds`, `searchCatalogRows` with `kindToTable` routing, removed JSON blob parsing
- `src/server/catalog-search.ts` — generic `CatalogSearchRow` type, dynamic key-based Fuse.js search

**TypeScript:** zero errors. **Tests:** 11/11 search tests pass.

Blocked by: 08

## Question

Update `src/server/d1.ts` to query the new per-part-type tables instead of `sff_parts`.

Current state: 9 queries against `sff_parts` with a `kind` column, plus 3 row mapper functions (`rowToCase`, `rowToGpu`, `rowToGenericPart`).

New requirements:
- Replace each generic query with **per-table query functions** (e.g., `getCasesFiltered()`, `getGpusFiltered()`, etc.)
- Each function queries its specific table (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`) and returns typed objects
- Row mapper functions are replaced with per-table mappers that map the full typed column set — no more extracting generic dimensions from JSON
- Search/autocomplete (`getSearchSuggestions`) must search across all 7 tables
- The `getPartsByIds()` function must route IDs to the correct table (slug-based lookup)
- The `getCatalogSummary()` aggregation query must summarize across all tables
- TypeScript types for the returned rows should be derived from the DDL columns
- Volume tier filtering for cases: `WHERE volume_l < 10`, `WHERE volume_l >= 10 AND volume_l < 20`, `WHERE volume_l >= 20`
- Radiator size filtering: `WHERE radiator_240mm = 1`, etc.

Preserve the existing Astro API route interfaces — the functions are called from API routes. The function signatures should remain compatible or be updated cleanly.

Questions to resolve during implementation:
- What TypeScript types represent the per-table row shapes? Define inline or in a shared types module?
- How does search/autocomplete federate across 7 tables efficiently?
- How does `getPartsByIds` handle slugs that don't include the kind prefix?
