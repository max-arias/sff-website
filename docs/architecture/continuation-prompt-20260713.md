# Continuation Prompt

Use this prompt to start a fresh LLM session for continuing the architecture cleanup.

```text
You are continuing architecture cleanup work in `/home/max/dev/sff-website`, the SFF Builder fitment engine.

First read:
- `AGENTS.md`
- `CONTEXT.md`
- `PRODUCT.md`
- `README.md`
- `docs/adr/0001-build-route-and-url-state.md`
- `docs/architecture/README.md`
- `docs/architecture/session-handoff-20260713.md`

There is also a saved visual architecture report at:
- `docs/architecture/architecture-review-20260713.html`

Important recent commits:
- `617c0d1 refactor: extract fitment engine`
- `da1249e refactor: add catalog store seam`
- `f5106ec refactor: centralize build query serialization`
- `de4605a refactor: centralize numeric filter params`

Current architecture state:
- Fitment rules now live in pure `src/fitment/` modules. Do not import D1, Astro, URL state, table columns, or `cellIndex` into `src/fitment/`.
- GenericPart helpers are centralized in `src/lib/generic-part.ts`.
- `getBuildView` accepts a `CatalogStore`; tests can use `InMemoryCatalogStore`.
- URL serialization is centralized in `buildSearchParams` / `buildUrl`.
- Numeric filter params/groups are centralized in `src/lib/build-filter-params.ts`.

Before changing code, run or inspect:
- `git status --short`
- `git log --oneline -8`

Recommended next work, in priority order:
1. Run a code review of the refactor series (`308c88a..HEAD` or the four cleanup commits) for standards and product-spec alignment.
2. Design the next seam for Column-Level Evidence Highlight: move from row-level `highlightCellIndex` toward cell-level evidence metadata in the table view model, while keeping the Fitment Engine UI-agnostic.
3. Consider Constraint Jumps / Open Constraints, but treat this as product-facing UI work and preserve the public URL query contract.
4. Consider Provenance / raw source visibility, but expect it to touch intake, D1, types, and UI.

Use the `codebase-design` skill before designing a new module/interface seam. Use `simplify` for behavior-preserving cleanups. Use `code-review` if reviewing the refactor commits. Do not start the Astro dev server unless explicitly asked.

Always preserve these product rules:
- `/build` is the canonical stateful route.
- Query params are a public, human-readable, replayable contract.
- Keep `pass`, `conditional`, and `fail` visible together.
- Fitment is non-blocking; selected risky/failing parts stay selected and issues are surfaced.

Verification commands used recently:
- `npm run test:build-filter-params`
- `npm run test:build-state`
- `npm run test:build-view`
- `npm run test:fitment`
- `npm run test:generic-part`
- `npm run test:search`
- `npm run typecheck`
```
