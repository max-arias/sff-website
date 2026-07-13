---
title: "Plan the BuildCores adapter and field mapping"
labels:
  - wayfinder:research
status: open
assignee:
blocked_by:
  - .issues/wayfinder-data-ingestion/catalog-identity-and-deduplication.md
  - .issues/wayfinder-data-ingestion/provenance-and-current-view-schema.md
parent: .issues/wayfinder-data-ingestion-map.md
---

## Question

How should BuildCores OpenDB be ingested into SFF Builder's catalog model?

Resolve the practical adapter plan:

- fetch strategy: git clone, GitHub raw files, package/API, pinned commit, or cached snapshot;
- category mapping to `cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, and `ram`;
- field mapping for dimensions and fitment-relevant attributes;
- fields that should be ignored, stored as raw claims, or deferred;
- expected data-quality gaps in BuildCores for SFF-specific fitment;
- how BuildCores records merge with existing SFF Master List records.
