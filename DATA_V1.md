# SFF Data System V1

## Product Direction

SFF Builder is a constraint-first compatibility tool. Users should be able to start with any parts they already own or want to keep, then ask what remaining parts can work around those constraints.

The first-class object is a partial build, not a case.

Examples:

- A user has a GPU and PSU, then searches for compatible cases.
- A user has a case, then searches for compatible coolers, GPUs, PSUs, and radiators.
- A user has a CPU and motherboard, then searches for realistic cooling and case options.
- A user has RAM with known height, then checks cooler clearance risk.

## Source Priority

V1 uses the SFF PC Master List as the compatibility baseline.

The `docyx/pc-part-dataset` catalog can be added as enrichment later, but it should not replace SFF-specific fit fields automatically. It is useful for broader catalog metadata, aliases, chipsets, prices, and missing mainstream parts.

## V1 Sheet Coverage

The importer downloads the SFF Master List as an XLSX workbook so Google Sheets cell hyperlinks are preserved. It imports every exported worksheet except the workbook index tab named `Sheets`.

Use this audit command to see the current exported tab set, row counts, and hyperlink counts:

```powershell
npm run intake:audit
```

The audit writes:

```txt
.data/sff-workbook-tabs.json
```

This avoids a stale hard-coded tab list and makes renamed or hidden sheets visible during ingest review.

## Data Shape

The app stores imported catalog data in one wide table:

```txt
sff_parts
  one normalized record per imported part/reference row
```

Each row has:

- A `kind` column such as `case`, `gpu`, `psu`, `cpu-cooler`, `fan`, `motherboard`, `ram`, or `reference`.
- Common identity and provenance columns: `source_sheet`, `source_row_number`, `brand`, `name`, `display_name`, `seller_url`, and `product_url`.
- Canonical nullable fields for fields we expect to filter/query, such as dimensions, case GPU clearance, GPU chipset/TDP/slots, cooler height, fan size, PSU wattage, motherboard form factor, and RAM height.
- `raw_json`, `links_json`, `flags_json`, `specs_json`, and `dimensions_json` for source provenance, messy sheet leftovers, and auditability.

The current case/GPU compatibility API derives its case and GPU projections from `sff_parts`; there are no separate `cases` or `gpus` database tables. This keeps D1 seed writes close to one inserted row per imported part while still allowing SQL filtering on promoted fields.

## Compatibility Model

Compatibility should be evaluated between selected constraints and candidate parts:

```txt
selected parts + candidate part -> verdict + issues + unknowns
```

Initial relationship engines:

- GPU <-> case
- PSU <-> case
- CPU cooler <-> case
- AIO/radiator/fans <-> case
- motherboard <-> case
- CPU <-> motherboard
- RAM <-> CPU cooler
- PCIe riser <-> case/GPU/motherboard

Rules should return `pass`, `fail`, or `conditional`. Missing or ambiguous source data should produce visible warnings rather than silent filtering.

## V1 Build Workbench

The user experience should support locked parts:

```txt
Locked Parts
[Case] [GPU] [PSU] [CPU] [Motherboard] [Cooler] [RAM] [Riser]

Results
Cases
GPUs
Coolers
PSUs
Motherboards
Warnings
Unknowns
```

Every result category updates around whatever the user has already locked.
