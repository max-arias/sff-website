---
title: "Plan Clearance Allocation implementation seams and regression coverage"
labels:
  - wayfinder:task
status: closed
assignee: max-arias
blocked_by: []
parent: https://github.com/max-arias/sff-website/issues/1
---

## Claim and evidence path

Implement clearance allocation as a domain rule, not a UI or database filter. The single source of truth will be `src/fitment/clearance-allocation.ts`: it normalizes sandwich style, validates positive finite dimensions, computes the shared cross-section and directional limits, falls back to scalar checks, and emits allocation evidence.

The catalog audit found 269 numeric-complete sandwich cases out of 433. That guard establishes data eligibility only; it does **not** prove physical additivity or mode safety. Runtime must evaluate every sandwich case: incomplete records remain scalar-plus-conditional and are never filtered out.

Eligibility is exact trimmed lower-case `style === "sandwich"` plus positive finite case GPU width and cooler height. No D1 migration or query guard is needed. Allocation applies only to GPU/cooler relationships:

- Candidate GPU: selected case + candidate GPU + selected cooler.
- Candidate cooler: selected case + selected GPU + candidate cooler.
- Candidate case with selected GPU and cooler: evaluate both directions.
- Other candidate kinds: scalar checks only.

Complete paired inputs replace the relevant scalar side limit with the calculated directional limit. Incomplete paired inputs retain the scalar check and add side-specific unknown evidence. Non-sandwich cases and relationships without an opposing selected part remain scalar-only with no allocation evidence. Exact equality passes; fail takes precedence over conditional. Retire `sandwich-layout-mode`, while preserving riser evidence separately.

## Ordered implementation phases

1. **Domain module — `src/fitment/clearance-allocation.ts`**
   - Define the normalized eligibility and positive-finite input checks.
   - Export directional GPU-width and cooler-height assessments using the settled evidence codes and metrics:
     `clearance-allocation-gpu-width`, `exceeds-clearance-allocation-gpu-width`, `unknown-clearance-allocation-gpu-width` with `gpuWidthMm`; and the parallel cooler codes with `coolerHeight`.
   - Keep all subtraction, scalar fallback, verdict precedence, and evidence construction here. No UI imports.

2. **Engine seam — `src/fitment/engine.ts`**
   - Replace only the scalar GPU-width and cooler-height paths with calls into the domain module.
   - Pass the selected opposing part for candidate GPU/cooler evaluation and evaluate both directions for candidate cases.
   - Preserve other scalar checks, existing summary precedence, and riser evidence. Remove the `sandwich-layout-mode` evidence path.

3. **Selected-build report — `src/fitment/types.ts`, `src/server/build-view.ts`**
   - Tighten `BuildFitmentReport` as selected-build domain output: aggregate verdict/evidence, per-slot decisions, and a `ClearanceAllocationAssessment`.
   - Make `getBuildView()` resolve IDs once into one immutable `BuildContext`; derive selected status/issues from the report rather than repeatedly evaluating each selected slot as a candidate.
   - In `build-view.ts`, project assessment/evidence into `ClearanceAllocationView` only. Do not subtract dimensions or determine verdicts there.
   - Preserve metric-cell mapping and catalog values. Add mobile metric evidence message and verdict fields, not just an alert boolean.

4. **Panel and placement — new `src/components/ClearanceAllocationCard.astro` and its page integration**
   - Render server-side only: no client state or controls.
   - Place after fixed selected/empty slots and before Build Issues.
   - Restore the documented fixed, visible empty-slot panel and URL-backed, non-blocking actions first; keep this restoration limited to the card’s placement prerequisite, not a generalized constraint system.
   - With no opposing part, show `INACTIVE` and available case scalar limits only: no subtraction or allocation evidence.
   - `remaining` means the calculated open-side limit only after an opposing selected dimension exists; never show pair headroom.
   - With both selected while table kind is neither GPU nor cooler, show relationship-local `PAIR` with both measured dimensions and their respective allocated limits; do not invent an active side or headroom.
   - Candidate-case rows evaluate both directions and attach evidence to their corresponding GPU-width and cooler-height metrics. Keep card verdict relationship-local; unrelated build failures remain in slot/build issues.
   - Render desktop evidence beyond hover-only titles and expose it to keyboard and screen-reader users. On mobile, GPU Width / cooler Height is the first metric and has a visible short message. Never hide failed or conditional rows.

5. **Regression coverage — `src/fitment/clearance-allocation.test.ts`, existing engine/build-view/page tests**
   - Add the unit matrix below before broad integration coverage.
   - Extend engine candidate/selected tests, view-model and metric-cell tests, panel/empty-slot/action tests, visible-row and sorting tests, and URL selection-preservation tests.
   - Make the existing build-view async test harness deterministic before adding broad integration coverage.

## Test matrix

Use synthetic dimensions `case shared cross-section = 60 + 40 = 100` and explicit selected GPU/cooler dimensions.

| Case | Expected assertion |
| --- | --- |
| Exact equality at 100 | Pass; calculated limit replaces scalar limit. |
| GPU side overflows by 1 mm | Fail with `exceeds-clearance-allocation-gpu-width`, metric `gpuWidthMm`. |
| Cooler side overflows by 1 mm | Fail with the parallel cooler exceed code, metric `coolerHeight`. |
| Calculated GPU limit above scalar | Calculated limit is used; scalar does not cap it. |
| Calculated cooler limit below scalar | Calculated limit is used; scalar does not widen it. |
| Incomplete opposing GPU/cooler input | Scalar check remains and the side-specific unknown code is added. |
| Scalar fail plus unknown allocation | Overall result is fail, with scalar failure and unknown allocation evidence retained. |
| Missing, zero, negative, NaN, or infinite dimensions | No allocation eligibility; scalar behavior remains and allocation is conditional/unknown as applicable. |
| Non-sandwich style | Scalar only; no allocation evidence. |
| Sandwich with no opposing selected part | Scalar only; no allocation evidence. |
| Whitespace/case variant style | Trim and lowercase; classify as sandwich. |
| Evidence ordering | Assert the exact code → metric → message order for pass, fail, and unknown GPU and cooler evidence; assert the canonical short message is visible in desktop and mobile projections. |

Then cover:

- Engine candidate GPU, candidate cooler, and candidate-case-both-directions paths.
- Selected-build aggregate verdict, evidence, per-slot decisions, and `ClearanceAllocationAssessment` from one immutable `BuildContext`.
- View-model projection, metric-cell association, catalog values, and mobile message/verdict fields.
- Card states `INACTIVE`, directional active, and relationship-local `PAIR`.
- Fixed visible empty slots, URL-backed actions, and selection preservation after table navigation/replacement.
- Failed and conditional rows remaining visible, with stable fitment sorting and evidence attached to the correct metric.

## Verification

Run, without starting the dev server:

```sh
npm run test
npm run typecheck
npm run build
```

Before broad integration coverage, make the existing build-view async test harness deterministic. Manual local acceptance must then verify desktop and below-`lg` layouts for pass, fail, incomplete, and inactive states; keyboard access to evidence; screen-reader exposure of verdict, metric, and message; visible failed/conditional rows; fixed empty-slot actions; and preservation of URL-backed selections.

## Non-goals and top risks

Non-goals: new URL parameters, database fields, derived filters, tolerance, spine/mode controls, ranking, or a generic constraint framework.

Top risks:

- Accidentally capping a calculated limit with the scalar limit, or duplicating scalar checks in multiple layers.
- Treating the arithmetic as proof of physical additivity or mode safety.
- Losing evidence accessibility by leaving explanations hover-only or alert-only.
- Reintroducing allocation arithmetic in `build-view.ts`, Astro, or any other UI/server projection.
- Making unrelated build failures change the relationship-local card verdict.
