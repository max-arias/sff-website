---
title: "Decide provenance and current-view schema changes"
labels:
  - wayfinder:grilling
status: open
assignee:
blocked_by:
  - .issues/wayfinder-data-ingestion/source-precedence-and-merge-policy.md
  - .issues/wayfinder-data-ingestion/catalog-identity-and-deduplication.md
parent: .issues/wayfinder-data-ingestion-map.md
---

## Question

What schema shape should support multi-source ingestion while keeping the app fast and fitment-focused?

Resolve whether to:

- extend the existing per-kind D1 tables with source/provenance columns only;
- add separate source-claim tables and derive current per-kind views;
- use a hybrid where per-kind tables remain the fast current view and claim/provenance data is stored alongside them;
- preserve raw source rows, source URLs, source row numbers, source IDs, import run IDs, and selected field-level claim metadata.

The answer should be implementation-ready enough to guide migrations and `src/lib/sql.ts` seed generation without designing UI attribution in detail.
