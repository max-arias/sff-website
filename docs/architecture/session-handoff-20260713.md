# SFF Website Architecture Handoff — 2026-07-13

## Repo / state at handoff

- Repo: `/home/max/dev/sff-website`
- Working tree was clean after the final cleanup commit.
- Main saved report: [`architecture-review-20260713.html`](./architecture-review-20260713.html)
- Original temp report path: `/tmp/architecture-review-20260713-173619.html`

## Suggested skills for a new session

- `codebase-design` — use for any next module/interface/seam decisions.
- `simplify` — use for tightly scoped behavior-preserving cleanup.
- `code-review` — useful now to review the refactor commits as a batch.
- `improve-codebase-architecture` — rerun only if a fresh report is needed; otherwise reuse the saved HTML report.

## What happened

The session started with a skills-based architecture critique because the codebase had accumulated many patches. The review identified a god module in `src/server/build-view.ts`, duplicated GenericPart helpers, fragmented fitment logic, duplicated URL serialization, missing D1 test seam, and fragmented numeric filter registration.

The highest-value recommendations were implemented in verified, committed slices.

## Commits created

1. `617c0d1 refactor: extract fitment engine`
   - Added pure Fitment Engine under `src/fitment/`.
   - Added `src/fitment/engine.ts`, `src/fitment/types.ts`, `src/fitment/engine.test.ts`.
   - Deleted old `src/lib/compatibility.ts`.
   - Added shared GenericPart accessors in `src/lib/generic-part.ts` plus tests.
   - Adapted `src/server/build-view.ts`, `src/lib/sql.ts`, and `src/pages/api/compatibility.ts`.
   - Note: this commit also included already-present/intertwined availability/PSU changes from the working tree; they were verified as part of the clean state.

2. `da1249e refactor: add catalog store seam`
   - Added `src/server/catalog-store.ts` interface.
   - Added D1 adapter: `src/server/d1-catalog-store.ts`.
   - Added in-memory adapter: `src/server/in-memory-catalog-store.ts`.
   - Updated `getBuildView(context, url, store?)` to accept an optional store.
   - Updated compatibility API to use the store seam.
   - Added `src/server/build-view.test.ts`.

3. `f5106ec refactor: centralize build query serialization`
   - Added `buildSearchParams(state, patch?)` to `src/lib/build-state.ts`.
   - `buildUrl` now delegates to `buildSearchParams`.
   - `src/server/build-view.ts` hidden inputs now derive from canonical params.
   - Added `src/lib/build-state.test.ts`.

4. `de4605a refactor: centralize numeric filter params`
   - Added `src/lib/build-filter-params.ts`.
   - Moved `NUMERIC_FILTER_PARAM_NAMES` and `FILTER_GROUPS` into a shared pure-data module.
   - Updated `src/lib/build-state.ts` and `src/server/build-view.ts` to import from it.
   - Added `src/lib/build-filter-params.test.ts`.

## Verification performed

The following passed during the final verification pass:

```bash
npm run test
npm run typecheck
```

Observed totals:

- `test`: all focused TypeScript suites passed
- `typecheck`: 0 errors

`astro check` still reported non-blocking hints about unused variables in `scripts/enrich-psu-tiers.ts` and `src/lib/sql.ts`.

## Recommended next work

See [`README.md`](./README.md) in this directory for the current TODO list.

Since this handoff was written, the refactor-series review and **Column-Level Evidence Highlight** cleanup have been completed. The likely next move is now:

1. Design **Constraint Jumps / Open Constraints**; or
2. Plan **Provenance / raw source visibility**.

## Cautions

- Do not undo Fitment Engine purity: no D1, Astro, URL state, table columns, or `cellIndex` imports in `src/fitment/`.
- Keep UI-specific evidence mapping outside the engine.
- Keep cell-level evidence mapping in the table/view-model layer; `src/fitment/` should expose domain metric keys only.
- Add tests for any URL query contract change.
- Treat the saved HTML report as historical context: several findings have already been resolved by the commits listed above.
