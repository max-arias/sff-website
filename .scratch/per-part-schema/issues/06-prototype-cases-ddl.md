Type: prototype
Status: resolved

## Answer

```sql
create table if not exists cases (
  -- Primary key (slug: brand-name, globally unique)
  id                        text primary key,

  -- Identity
  seller                    text    not null default '',
  name                      text    not null default '',

  -- Layout & materials
  style                     text    not null default '',
  side_panel                text    not null default '',
  case_material             text    not null default '',

  -- Dimensions
  length_mm                 real,
  width_mm                  real,
  height_mm                 real,
  volume_l                  real,
  footprint_cm2             real,
  weight_kg                 real,

  -- Clearances
  cpu_cooler_height_mm      real,
  gpu_length_mm             real,
  gpu_width_mm              real,
  gpu_height_mm             real,
  pcie_slots                integer,
  lp_pcie_slots             integer,

  -- Compatibility flags
  gpu_riser                 text    not null default '',   -- 'Y', 'Optional', '-'
  motherboard               text    not null default '',   -- e.g. 'mITX', 'mITX / mATX'
  psu                       text    not null default '',   -- e.g. 'SFX / SFX-L'

  -- Radiator support (raw + boolean flags per size)
  radiator_support_raw      text    not null default '',   -- original value e.g. '120 / 240'
  radiator_120mm            boolean not null default 0,
  radiator_140mm            boolean not null default 0,
  radiator_200mm            boolean not null default 0,
  radiator_240mm            boolean not null default 0,
  radiator_280mm            boolean not null default 0,
  radiator_360mm            boolean not null default 0,
  radiator_420mm            boolean not null default 0,
  radiator_top_hat          boolean not null default 0,    -- requires top-hat accessory

  -- Drive bays (max counts, parsed from '0 to X' patterns)
  drive_2_5_max             integer,
  drive_3_5_max             integer,
  drive_5_25_max            integer,

  -- Fan slots (count of supported positions per size)
  fan_40mm_count            integer,
  fan_60mm_count            integer,
  fan_80mm_count            integer,
  fan_92mm_count            integer,
  fan_120mm_count           integer,
  fan_140mm_count           integer,
  fan_180mm_count           integer,
  fan_200mm_count           integer,

  -- Front I/O
  usb_a_2_0_count           integer,
  usb_a_3_2_count           integer,
  usb_c_count               integer,
  jack_3_5mm                boolean not null default 0,

  -- Pricing
  price_cny                 real,
  price_usd                 real,

  -- Links
  sff_net_link              text    not null default '',

  -- Status & metadata
  status                    text    not null default '',   -- '' = active, 'Discontinued', 'Concept', 'Prototype'
  last_update               text    not null default '',   -- source sheet date, e.g. '01 Aug 2023'
  created_at                text    not null default current_timestamp,
  updated_at                text    not null default current_timestamp
);
```

**Design notes:**

- **52 columns** total: `id` + 41 source-derived + 8 radiator booleans + `created_at`/`updated_at`.
- `gpu_riser` is a tristate text column (`Y`/`Optional`/`-`), not boolean — "Optional" is a meaningful third state.
- Radiator support: `radiator_support_raw` preserves the original human-readable text; 8 boolean columns enable SQL filtering (`WHERE radiator_240mm = 1`).
- Drive bays store parsed maximum count. Values like `0 to 2` from the source sheet → `drive_2_5_max = 2`. Optional raw companion columns (e.g., `drive_2_5_raw`) could be added later if the source qualifier text needs preservation.
- Fan/I/O columns are already atomic per-size and map 1:1 from the source. No expansion needed.
- `last_update` is the source sheet's human-edited date; `updated_at` is the import pipeline's DB write timestamp. Both are useful — one for data freshness, one for pipeline auditing.
- `status` carries the source sheet value directly. Empty string = active/normal.
- Foreign keys are absent intentionally — no `import_runs`, no inter-table references. The import pipeline owns the relationship between source and row.

## Question

What does the `cases` table DDL look like, as a concrete artifact to react to?

This is a prototype — write the actual `CREATE TABLE cases (...)` statement based on:
- The unified column list from research ticket "Unify all case columns" (blocked by it)
- The slug ID scheme from "Specify slug generation algorithm" (blocked by it)
- The cross-table conventions from "Cross-table naming and provenance conventions" (blocked by it)

It should demonstrate: typed columns for every sheet attribute, boolean+count columns for multi-value fields, slug-based primary key, source provenance columns, and any convention-driven metadata columns.

The prototype exists to make the abstract decisions concrete — we react to it, adjust, and then use it as the template for the other 6 tables.


