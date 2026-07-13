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

## Architecture TODOs

1. **Review the refactor series**
   - Run a code review across `308c88a..HEAD` or the four cleanup commits.
   - Check both standards and product-spec alignment.

2. **Column-Level Evidence Highlight model**
   - Current UI still adapts fitment evidence into `highlightCellIndex`.
   - Next direction: table cells should carry evidence metadata, while `src/fitment/` remains UI-agnostic.

3. **Constraint Jumps / Open Constraints**
   - Empty-slot actions should eventually pre-apply editable derived filters from current open constraints.
   - Preserve the public URL query contract and non-blocking fitment behavior.

4. **Provenance / raw source visibility**
   - Product docs define Provenanced Claims, but source attribution is not yet surfaced as a first-class UI feature.
   - This may touch intake, D1, types, and table/slot presentation.

5. **Further reduce `src/server/build-view.ts`**
   - Possible future seams: table row/view-model builder, filter option builder, PSU badge renderer, issue aggregation.
   - Prefer small tested extractions over broad rewrites.

## Constraints to preserve

- `/build` is the canonical stateful route.
- Query params are a public, human-readable, replayable contract.
- Keep `pass`, `conditional`, and `fail` visible together.
- Fitment is non-blocking: selected risky/failing parts stay selected and issues are surfaced.
- Keep `src/fitment/` pure: no D1, Astro, URL state, table columns, or `cellIndex` imports.
