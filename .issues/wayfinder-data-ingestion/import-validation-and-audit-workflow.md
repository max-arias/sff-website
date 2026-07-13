---
title: "Decide import validation and audit workflow"
labels:
  - wayfinder:research
status: open
assignee:
blocked_by:
  - .issues/wayfinder-data-ingestion/buildcores-adapter-field-map.md
  - .issues/wayfinder-data-ingestion/provenance-and-current-view-schema.md
parent: .issues/wayfinder-data-ingestion-map.md
---

## Question

What validation, audit, and review workflow is required so expanded ingestion improves user data without silently lowering fitment quality?

Resolve the checks and artifacts needed for implementation, including:

- row counts and field coverage by source and kind;
- changed fitment-relevant values between imports;
- unmatched or ambiguously matched records;
- source conflicts that should become `conditional` evidence;
- sparse-row behavior for newly imported records;
- CI/local commands that should fail versus produce review reports.
