# SFF Builder Data Model

## Product Direction

SFF Builder is a constraint-first compatibility tool. Users should be able to start with any parts they already own or want to keep, then ask what remaining parts can work around those constraints.

The first-class object is a partial build, not a case.

Examples:

- A user has a GPU and PSU, then searches for compatible cases.
- A user has a case, then searches for compatible coolers, GPUs, PSUs, and radiators.
- A user has a CPU and motherboard, then searches for realistic cooling and case options.
- A user has RAM with known height, then checks cooler clearance risk.

## Source Data

The current catalog is imported from the SFF PC Master List workbook. The importer downloads the workbook as an XLSX so Google Sheets cell hyperlinks are preserved, and processes every exported worksheet except the workbook index tab.

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

The catalog is stored in per-kind database tables within Cloudflare D1, each with columns specific to that part type:

```txt
cases           — SFF cases with dimensions, GPU envelope, motherboard/PSU form factor,
                  radiator support, fan counts, drive bays, I/O, pricing
gpus            — Graphics cards with dimensions, chipset, TDP, PCIe pins, outputs
cpu_coolers     — Air and liquid coolers with dimensions, socket support, TDP,
                  fan specs, RAM clearance
fans            — Case fans with size, airflow, static pressure, noise, control type
motherboards    — Motherboards with form factor, socket, chipset, expansion slots,
                  RAM support, I/O, headers
psus            — Power supplies with form factor, wattage, efficiency rating,
                  modular cabling, connector counts
ram             — Memory kits with type, height, RGB
```

Each table uses a text primary key (`id`) derived from the source import. Rows also carry `status`, `created_at`, and `updated_at` columns for lifecycle tracking, plus data attribution fields sourced from the original import.

There is no monolithic `sff_parts` table. Each kind lives in its own schema-optimized table so columns, filters, and evidence displays stay relevant to that part type.

## Sparse Rows

Rows with no fitment-relevant metric data are still imported so the source catalog remains auditable. The `/build` UI hides those sparse rows by default and exposes them with the URL-backed `show-sparse=1` toggle; this keeps empty rows from crowding the fitment table without treating missing data as a hard incompatibility.

## Compatibility Model

Compatibility is evaluated between selected constraints and candidate parts:

```txt
selected parts + candidate part -> verdict + issues + unknowns
```

Supported relationship engines:

- GPU ↔ case
- PSU ↔ case
- CPU cooler ↔ case
- AIO/radiator/fans ↔ case
- Motherboard ↔ case
- CPU ↔ motherboard
- RAM ↔ CPU cooler
- PCIe riser ↔ case/GPU/motherboard

Rules return `pass`, `fail`, or `conditional`. Missing or ambiguous source data should produce visible warnings rather than silent filtering.

## Data Attribution

The build panel credits the sources whose values reach the catalog: the SFF PC
Master List workbook, the PSU tier list, and Cybenetics (PSU ETA and Lambda
grades, shown as the `Cyb η` and `Cyb λ` columns). That list lives in
`src/lib/data-sources.ts`, which also owns the workbook id the intake fetches.

Sources named in the workbook but not credited are those the pipeline cannot yet
surface. The intake reads cell *text*, not the hyperlink target, so link-only
cells arrive as their visible label — the word "Link" — or as empty:

```txt
psus.review_by_aris            "Link"   58/261   rendered as the word "Link"
cases.sff_net_link             "Link"  117/1119   no column renders it
psus.cybenetics_report_url     ""        0/261
psus.efficiency_80plus_report  ""        0/261
```

The hyperlink targets themselves are in the workbook and in
`.data/intake-snapshot.json` (hwbusters.com, smallformfactor.net,
clearesult.com, cybenetics.com), but no per-kind table stores them, so the
browser artifact has no URL to link. The same gap empties `productUrl` and
`sellerUrl` for every part. Crediting a source, and linking a record to its
origin, needs those hyperlink targets persisted as columns first.
