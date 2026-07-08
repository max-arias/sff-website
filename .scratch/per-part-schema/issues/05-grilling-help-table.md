Type: grilling
Status: resolved

## Answer

### Column help table schema

```sql
create table column_help (
  table_name text not null,
  column_name text not null,
  help_text text not null,
  primary key (table_name, column_name)
);
```

- **Flat structure** — no categorization into definition/computation/assumption/reference types. All help text is plain text. UI rendering is free to style it as needed from context.
- **Composite primary key** — `(table_name, column_name)` is the natural key. This is an intentional exception to the `id text` convention used by part tables, since help rows don't have a natural brand+name identity.
- **No metadata columns** — no `created_at`, `updated_at`, or `status`. This is a minimal reference table, not a part catalog table. The convention of metadata columns (`status`, timestamps) is scoped to the 7 part tables, not every table in the schema.

### Content to seed

The following domain notes should be seeded into `column_help` at migration time:

| table_name | column_name | help_text |
|------------|-------------|-----------|
| cases | style | APU = no GPU. Sandwich = GPU & MB back-to-back with riser (e.g. Dan A4-SFX). Console = GPU & MB side-by-side with riser or cases with LP slots laid horizontal/vertical similar to game consoles (e.g. Node 202/RVZ03). Reference = Tower/Cube layout without riser (e.g. SG13/NCase M1/NZXT H210). Open = Open air case/test bench. NAS = Network-Attached Storage, usually with Hot Swap drive bays for SOHO servers. |
| cases | footprint_cm2 | Approximate desk space (Length x Width) |
| cases | gpu_height_mm | Assume 20mm per PCIe slot by default unless mentioned otherwise |
| cases | motherboard | mSTX = 147x140mm. mITX = 170x170mm. mDTX = 203x170mm. FlexATX = 229x191mm. DTX = 203x244mm. mATX = 244x244mm. ATX = 305x244mm. SSI-CEB = 305x267mm. SSI-EEB = 305x330mm |
| cases | psu | Flex ATX = 81.5x40.5x150mm. TFX = 85x65x175mm. SFX = 125x63.5x100mm. SFX-L = 125x63.5x130mm. ATX = 150x86x140-200mm |

## Question

What is the schema for the column help/definitions table? The intent is to store domain knowledge notes about specific columns so they can be surfaced as tooltips or info text in the UI.

Domain notes to capture include:
- **Style** (cases): APU = no GPU, Sandwich = GPU & MB back-to-back with riser, Console = GPU & MB side-by-side with riser or LP slots, Reference = Tower/Cube without riser, Open = Open air/test bench, NAS = Network-Attached Storage
- **Footprint (cm²)** (cases): Approximate desk space (Length x Width)
- **GPU Height / Thickness (mm)**: Assume 20mm per PCIe slot by default unless mentioned otherwise
- **Motherboard** (cases): Form factor dimensions — mSTX 147x140, mITX 170x170, mDTX 203x170, FlexATX 229x191, DTX 203x244, mATX 244x244, ATX 305x244, SSI-CEB 305x267, SSI-EEB 305x330
- **PSU** (cases): Form factor dimensions — Flex ATX 81.5x40.5x150, TFX 85x65x175, SFX 125x63.5x100, SFX-L 125x63.5x130, ATX 150x86x140-200

Decisions:
1. Table name and columns: `column_help(table_name text, column_name text, help_text text, ...)`?
2. Scoping: Is help text keyed by `(table, column)` or just `column` (shared across tables)?
3. Additional metadata: display label, units, tooltip vs detail text distinction?
4. How to query: loaded alongside part data, or fetched separately by the UI?

Type: grilling
