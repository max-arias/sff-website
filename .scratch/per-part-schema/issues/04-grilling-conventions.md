Type: grilling
Status: resolved

## Answer

### Cross-table schema conventions

1. **Table names**: Plural (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`).

2. **Primary key**: `id text primary key` on every table — stores the slug.

3. **Timestamp columns**:
   - `created_at text not null default current_timestamp` — auto-populated by D1 on insert
   - `updated_at text not null default current_timestamp` — updated by the import pipeline when an existing row's data changes during ingestion

4. **Source provenance**: Dropped. No `source_sheet`, no `source_row_number` columns. The import script hardcodes which sheet maps to which table.

5. **Import tracking**: Dropped. No `import_runs` table, no `import_run_id` FK. No use case identified that justifies the tracking overhead.

6. **Status column**: Every table gets a `status text not null default ''` column. Values carry over from the source sheet (empty = active, `Discontinued`, `Concept`, `Prototype`, etc.).

7. **JSON blobs**: Eliminated entirely. No `specs_json`, `dimensions_json`, `flags_json`, `links_json`, or `raw_json` columns on any table. All data lives in typed columns.

8. **Column ordering convention**: ID columns first → data columns (dimensions, specs) → metadata (timestamps, status, links). Consistent across all 7 tables.

## Question

What are the cross-table schema conventions for the new design?

Decisions to pin down:
1. **Table naming**: Plural? (`cases`, `gpus`) or singular? (`case`, `gpu`)? Prefix convention?
2. **Primary key column**: Always `id`? Type `text`? 
3. **Timestamp columns**: `created_at` / `updated_at`? ISO 8601 text? Auto-populated by D1?
4. **Source provenance**: Every table keeps `source_sheet` (text) and `source_row_number` (integer) for traceability? Or does this move to an import_runs junction?
5. **Import tracking**: Does `import_run_id` (FK to `import_runs`) stay? Per-table or global import runs?
6. **Soft delete / status**: Every table has a `status` column? Values: `active`, `discontinued`, etc.?
7. **Specs/dimensions/flags JSON**: These are being replaced with typed columns for cases. Do they persist in any form for other tables, or are they dropped entirely?
8. **Column ordering**: Is there a convention (IDs first, then foreign keys, then attributes, then metadata)?

These decisions apply to all 7 tables, so they should be settled before any DDL is written.

Type: grilling
