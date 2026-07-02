# AGENTS.md

This repo is for **SFF Builder**, a fitment engine for small-form-factor PC builds.

## Start Here

Read these files before making product or UX changes:

- [CONTEXT.md](./CONTEXT.md)
- [PRODUCT.md](./PRODUCT.md)
- [README.md](./README.md)
- [docs/adr/0001-build-route-and-url-state.md](./docs/adr/0001-build-route-and-url-state.md)

## Product Shape

- The product is a **fitment engine**, not a generic component catalog or recommendation site.
- The canonical stateful experience is intended to live at `/build`.
- The root route `/` is intended to be a thin launcher into `/build`.
- URL query params are treated as a **public, human-readable, replayable contract**.

## Important Domain Rules

- Keep `pass`, `conditional`, and `fail` visible. Do not hide failing rows by default.
- `fail` means a known hard conflict.
- `conditional` covers uncertainty, incomplete data, and practical build risk.
- The system is **non-blocking**: users can still select risky or failing parts.
- Selected parts remain selected; issues should be surfaced, not auto-corrected away.
- V1 uses **catalog-only selection** from `sff_parts.id`.

## UI Direction

- `/build` should behave like a **filterable data table** driven by URL state.
- The selected build should remain visible in a persistent panel.
- Empty slots should stay visible and expose actions into the table.
- Fitment evidence should be visible in the table itself, especially at the failing or cautionary column.

## Current Reality Vs Intended Direction

- Some current code may still reflect the older one-route homepage implementation.
- When product docs and current UI code disagree, prefer the documented direction in `CONTEXT.md` and the ADR unless the user explicitly says otherwise.

## Data Notes

- The main table is `sff_parts`.
- Selected part identity should use the concrete `sff_parts.id`.
- Those IDs are currently import-derived, so upstream sheet changes may affect long-term stability.

## Local Development

- Do not start the Astro dev server unless the user explicitly asks for it. It is flaky in this workspace; make changes and use static checks, then let the user run and test the app locally.

## Contribution Model

- V1 contribution intake is via GitHub issues plus manual review.
- Do not assume wiki-style direct editing exists in the shipped product.
