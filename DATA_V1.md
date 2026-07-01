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

The importer should ingest every SFF Master List tab that can describe parts, constraints, or build-relevant references:

- `SFF Case <10L`
- `SFF Case 10L-20L`
- `MFF Case >20L`
- `CPU Cooler <70mm`
- `CPU Cooler >70mm`
- `AIO`
- `Slim Fan`
- `Fans`
- `RAM Height`
- `PCIe Riser`
- `SFF GPU <215mm`
- `GPU >215mm`
- `GPU Spec`
- `mITX Boards`
- `mATX Boards`
- `PSU`
- `CPU`
- `Chipset`
- `Wi-Fi`
- `Console & Pre-Built`
- `SSD`
- `CPU Cooler Chart`
- `Thermalright Coolers & Fans`
- `Radiators`
- `Recommended Components for SFF Cases`
- `1151 v2 Motherboard List`
- `AM4 Motherboard List`
- `VLP RAM`

## Data Shape

The app keeps the current optimized `cases` and `gpus` tables for the existing MVP, but adds a generic part model for broad ingestion.

```txt
sff_parts
  one normalized record per imported row

sff_part_specs
  key/value specs copied from sheet columns

sff_part_dimensions
  parsed numeric dimension-like values

sff_part_source_rows
  raw source row JSON for every imported tab
```

This lets us ingest broadly first, then promote heavily queried fields into category-specific tables when compatibility rules need them.

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
