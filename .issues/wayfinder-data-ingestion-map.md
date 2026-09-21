---
title: "Wayfinder Map: Expanded Data Ingestion For Better Fitment Data"
labels:
  - wayfinder:map
status: open
children:
  - .issues/wayfinder-data-ingestion/source-roles-and-first-tranche.md
  - .issues/wayfinder-data-ingestion/source-precedence-and-merge-policy.md
  - .issues/wayfinder-data-ingestion/catalog-identity-and-deduplication.md
  - .issues/wayfinder-data-ingestion/provenance-and-current-view-schema.md
  - .issues/wayfinder-data-ingestion/buildcores-adapter-field-map.md
  - .issues/wayfinder-data-ingestion/import-validation-and-audit-workflow.md
  - .issues/wayfinder-data-ingestion/attribution-and-license-boundaries.md
---

## Destination

Produce an implementation-ready specification for expanding SFF Builder's data ingestion beyond the SFF Master List and PSU Tier List, with BuildCores OpenDB as the most promising new source and other 2025+ sources compared for usefulness.

The map is complete when the remaining implementation can be handed to an agent with clear decisions about source priority, source merging, catalog identity, schema/provenance changes, BuildCores field mapping, validation, and attribution boundaries.

## Notes

- Product goal: give users the best fitment-facing data possible, not merely the cleanest import pipeline.
- SFF Builder is a fitment engine, not a generic component catalog or recommendation site.
- Prefer sources that improve `pass` / `conditional` / `fail` evidence for case↔GPU, cooler↔case, PSU↔case, motherboard↔case, RAM↔motherboard, and RAM↔cooler checks.
- Preserve the product rule that incomplete or caveat-heavy data becomes `conditional`, not hidden or overconfident.
- Current pipeline ingests SFF Master List XLSX via `src/lib/sheets.ts`, PSU Tier List CSV via `src/lib/psu-tier-list.ts`, writes `.data/intake-snapshot.json`, then generates D1 seed SQL through `src/lib/sql.ts`.
- Current D1 tables are per-kind: `cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, and `ram`.
- Current D1 tables mostly lose source provenance; raw source metadata survives only in `.data/intake-snapshot.json`, except `cases.sff_net_link` and PSU tier values.
- Use `CONTEXT.md`, `PRODUCT.md`, `README.md`, `DATA.md`, and `docs/adr/0001-build-route-and-url-state.md` when resolving tickets.
- Planning only: do not implement the ingestion changes while working this map unless the destination is explicitly redrawn.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

## Not yet specified

- Exact D1 migration statements and TypeScript edits after the source/provenance model is chosen.
- Whether source attribution becomes visible in the UI during this ingestion effort or remains a near-future layer.
- Whether automated recurring sync is needed for BuildCores and other sources, or whether manual import snapshots are enough initially.
- Whether multi-source imports should remain seed-only or gain an admin/reconciliation workflow.
- Exact source-specific update cadence and failure handling once source roles are decided.

## Next ingestion plan

1. Freeze the current baseline: record the SFF Master List workbook timestamp, tab counts, normalized row counts, and the current D1/catalog artifact counts.
2. Define the per-kind dimensional eligibility contract before importing any new source records:
   - cases: physical dimensions or a usable clearance/support limit;
   - GPUs: length, width, thickness, or slot count;
   - CPU coolers: height/depth/width or RAM-clearance data;
   - PSUs: physical dimensions or form factor;
   - motherboards: physical dimensions or form factor;
   - RAM: module height;
   - fans: diameter/thickness when fan fitment is modeled.
3. Run the SFF Master List through that contract and classify every existing tab/row as accepted, rejected, or accepted-with-conditional-data. Do not remove source rows from raw audit output.
4. Build a read-only BuildCores adapter that downloads a pinned snapshot, maps only the fields in the dimensional contract, and emits coverage, rejected-row, unmatched-record, and conflict reports. Do not seed D1 yet.
5. Compare accepted BuildCores records against the SFF Master List by kind and deterministic identity keys. Review dimension conflicts instead of silently choosing a value.
6. Decide source precedence and provenance for each accepted field, then add the minimum schema needed to preserve source record IDs and claims.
7. Generate a reviewable merged seed, validate row counts and fitment-field coverage, run the existing fitment tests plus targeted dimensional boundary checks, and rebuild the browser catalog.
8. Only after the audit is accepted, seed local D1 and verify the actual `/build` surface. Promote the same reviewed snapshot to preview/production.

The next run should stop after step 4 if BuildCores does not provide enough usable dimensional coverage for the supported fitment relationships.

## Initial dimensional audit run

- Baseline: current SFF snapshot generated `2026-09-21T16:52:00.894Z`, with 10,029 generic parts, 1,119 cases, 5,050 GPUs, and 1,094 PSU tier entries.
- BuildCores snapshot: `main`, audited with `npm run intake:buildcores:audit`; no D1 seed was changed.
- Accepted dimensional records: 1,217/3,784 cases; 3,854/3,862 GPUs; 1,679/2,405 CPU coolers; 3,292/3,297 PSUs; 3,699/3,701 motherboards; 782/4,876 RAM records; and 3,454/3,465 fans.
- The accepted BuildCores records are mostly new relative to the current catalog under exact normalized manufacturer/name matching. This is an audit signal, not proof that they are safe to merge; identity matching and field-level conflict review remain required.
- Reports are written to `.data/buildcores-dimensional-audit.json` and `.data/buildcores-catalog-comparison.json`.

- The normalized review artifact now carries projected fitment dimensions per accepted source record. The source is not promoted to D1 because the current exact-name comparison leaves identity and conflict resolution unresolved.
- `npx tsc --noEmit --pretty false` passes. The existing `npm test` suite reaches the remote D1 budget test but fails because the remote `sff-builder` query is unavailable; no BuildCores code path caused that failure.

- The comparison matcher now reports exact matches, unique same-manufacturer token matches, ambiguous matches, and unmatched records. BuildCores has 28 ambiguous case matches, 2,150 GPU matches, 151 cooler matches, 522 motherboard matches, 366 RAM matches, and 159 fan matches; these require review before any merge.

- Candidate validation found 17,977 accepted records with projected dimensions and one duplicated OpenDB ID across categories (`CPUCooler` and `CaseFan`). Case promotion now requires at least one physical outer dimension; GPU-only case records are rejected.

## BuildCores promotion

- The accepted BuildCores records were promoted as namespaced additions alongside the existing SFF catalog, not used to overwrite existing rows.
- Local D1 was reseeded from `.data/intake-seed-buildcores.sql`; the merged seed contains 10,029 existing records plus 17,977 BuildCores records.
- Local browser catalog rebuilt successfully with 26,466 records, including 2,336 cases; the promoted catalog has zero case rows with all three outer dimensions empty.
- BuildCores GPU `total_slot_width` remains evidence text (`pcie_bracket`, for example `2 slots`); it is not incorrectly stored as a millimetre thickness.
- This promotion intentionally accepts unresolved and ambiguous identities as separate namespaced records. It does not claim source agreement or deduplicate records.

## Sparse-row visibility

- D1 retains accepted records even when a part lacks the minimum fitment field; the browser hides those rows by default behind the existing `Sparse` toggle.
- Default visibility requires GPU length plus width or thickness; PSU form factor; CPU cooler height; motherboard form factor; and RAM height.

## Jev GPU normalization probe

- Added `npm run intake:gpu:normalize`, which uses TypeSafe Jev to choose among deterministic name/token candidates for length-only GPU records.
- The probe writes `.data/typesafe-gpu-normalization-probe.json`; it does not mutate D1 or copy dimensions.
- A 40-record sample produced 24 candidate matches and 12 high-confidence decisions in the final run. Lower-confidence decisions vary across repeated calls, so only the gated subset is eligible for local overrides.

## Jev GPU dimension application

- Applied only the conservative subset where Jev confidence was at least `0.90`, the candidate had width and thickness, and the source and candidate lengths matched exactly.
- This produced 117 local D1 overrides in `.data/typesafe-gpu-dimension-overrides.sql`, with provenance decisions in `.data/typesafe-gpu-dimension-overrides.json`.
- Local GPU coverage changed from 3,853 length-only records to 3,736; 4,976 records now have complete length, width, and thickness values.

## Out of scope

- Building a general PCPartPicker replacement or price tracker.
- Adding saved builds, user accounts, affiliate routing, or public wiki-style direct edits.
- Thermal simulation, radiator placement modeling, fan curve recommendations, and exact 12VHPWR cable bend modeling; these can be future layers but are not part of this ingestion spec.
