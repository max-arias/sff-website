---
title: "Decide catalog identity and deduplication across sources"
labels:
  - wayfinder:research
status: open
assignee:
blocked_by:
  - .issues/wayfinder-data-ingestion/source-roles-and-first-tranche.md
parent: .issues/wayfinder-data-ingestion-map.md
---

## Question

How should SFF Builder identify, match, and deduplicate the same real-world component across SFF Master List rows, BuildCores JSON records, PSU tier rows, Cybenetics rows, TechPowerUp/dbgpu rows, and manufacturer references?

Resolve the desired identity model for catalog records and source claims, including:

- whether selected build URLs should continue storing concrete local catalog record IDs;
- whether source-specific IDs should be stored separately from catalog record IDs;
- matching keys per kind (`brand`, `model`, `name`, chipset, form factor, dimensions, wattage, etc.);
- how to handle variants, aliases, regional names, color variants, and family-level rows;
- how much matching can be deterministic versus requiring review reports.
