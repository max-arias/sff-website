# Architecture Review Notes

This directory preserves the architecture review and follow-up handoff from the July 2026 cleanup session.

## Artifacts

- [Architecture review HTML report](./architecture-review-20260713.html)
  - Original temp artifact was `/tmp/architecture-review-20260713-173619.html`.
  - This report predates the refactor commits below, so treat it as historical context plus a remaining-work map.
- [Session handoff](./session-handoff-20260713.md)
- [Continuation prompt](./continuation-prompt-20260713.md)

## Cleanup commits from the session

- `617c0d1 refactor: extract fitment engine`
- `da1249e refactor: add catalog store seam`
- `f5106ec refactor: centralize build query serialization`
- `de4605a refactor: centralize numeric filter params`

## Current architecture improvements

- Fitment rules live behind a pure module seam in `src/fitment/`.
- Generic part accessors live in `src/lib/generic-part.ts`.
- `getBuildView` can be tested with `InMemoryCatalogStore` instead of Cloudflare D1.
- URL query serialization is centralized in `buildSearchParams` / `buildUrl`.
- Numeric filter params and filter groups are centralized in `src/lib/build-filter-params.ts`.
- Fitment evidence now flows through cell-level table metadata instead of row-level `highlightCellIndex`.
- `src/fitment/` keeps UI-agnostic domain metric keys; table-column mapping stays in `src/server/build-view.ts`.
- Focused TypeScript suites are available through one command: `npm run test`.

## Architecture TODOs

### Done

- **Review the refactor series**
  - Reviewed the cleanup series for standards and product-spec alignment.
  - Addressed review findings around `unscored`, conditional advisory semantics, stale numeric filters, and evidence highlighting.
- **Column-Level Evidence Highlight model**
  - Replaced `highlightCellIndex` with per-cell evidence metadata in the table view model.
  - Evidence verdict/messages now attach to the relevant table cell while `src/fitment/` remains independent of table columns and cell indexes.

### Remaining

1. **Constraint Jumps / Open Constraints**
   - Empty-slot actions should eventually pre-apply editable derived filters from current open constraints.
   - Preserve the public URL query contract and non-blocking fitment behavior.

2. **Provenance / raw source visibility**
   - Product docs define Provenanced Claims, but source attribution is not yet surfaced as a first-class UI feature.
   - This may touch intake, D1, types, and table/slot presentation.

3. **Further reduce `src/server/build-view.ts`**
   - Possible future seams: table row/view-model builder, filter option builder, PSU badge renderer, issue aggregation.
   - Prefer small tested extractions over broad rewrites.

## Constraints to preserve

- `/build` is the canonical stateful route.
- Query params are a public, human-readable, replayable contract.
- Keep `pass`, `conditional`, and `fail` visible together.
- Fitment is non-blocking: selected risky/failing parts stay selected and issues are surfaced.
- Keep `src/fitment/` pure: no D1, Astro, URL state, table columns, or `cellIndex` imports.
