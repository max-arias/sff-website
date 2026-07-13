---
title: "Decide source precedence and merge policy for best user-facing data"
labels:
  - wayfinder:grilling
status: open
assignee:
blocked_by:
  - .issues/wayfinder-data-ingestion/source-roles-and-first-tranche.md
parent: .issues/wayfinder-data-ingestion-map.md
---

## Question

When multiple sources provide conflicting or overlapping values for the same part attribute, how should SFF Builder decide the fitment-facing current value while keeping uncertainty visible?

Resolve source precedence and merge policy for cases such as:

- SFF Master List case/GPU clearance versus manufacturer product pages;
- BuildCores component dimensions versus SFF Master List values;
- TechPowerUp/dbgpu GPU dimensions versus community GPU dimensions;
- SPL PSU tier data versus Cybenetics objective test data;
- missing fields, stale fields, ranges, approximations, and caveated notes.

The answer should define when to choose one value, when to keep a source disagreement as `conditional`, and what evidence should remain inspectable by later implementation.
