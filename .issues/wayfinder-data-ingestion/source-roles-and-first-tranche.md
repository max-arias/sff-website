---
title: "Decide source roles and the first ingestion tranche"
labels:
  - wayfinder:research
status: open
assignee:
blocked_by: []
parent: .issues/wayfinder-data-ingestion-map.md
---

## Question

Which 2025+ data sources should be part of the first expanded ingestion plan, and what role should each source play for SFF Builder?

Resolve this by comparing at least: SFF Master List, BuildCores OpenDB, SPL PSU Tier List, Cybenetics PSU Database, Cybenetics Fan Database, TechPowerUp GPU Database / dbgpu, Noctua Compatibility Centre, docyx/PCPartPicker snapshots, and manufacturer spec pages.

Return a decision that separates:

- primary source of record for each part kind or fitment-relevant field;
- supplemental/validation-only sources;
- sources to avoid or defer;
- the smallest first tranche that improves user-facing fitment data without overbuilding the pipeline.
