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

## Out of scope

- Building a general PCPartPicker replacement or price tracker.
- Adding saved builds, user accounts, affiliate routing, or public wiki-style direct edits.
- Thermal simulation, radiator placement modeling, fan curve recommendations, and exact 12VHPWR cable bend modeling; these can be future layers but are not part of this ingestion spec.
