---
title: "Audit sandwich cases for shared-cross-section assumptions"
labels:
  - wayfinder:research
status: closed
assignee: max-arias
blocked_by: []
parent: https://github.com/max-arias/sff-website/issues/1
---

## Question

Do the catalog's sandwich cases have sufficiently complete, positive GPU-width and CPU-cooler-height limits for a data-only shared-cross-section allocation guard?

## Authoritative local sources

- `.data/intake-snapshot.json:24357-24377` — SFF Case `<10L`, source row 485, including T1 Sandwich V2.1's style, dimensions, and `GPU Riser` value.
- `.data/intake-snapshot.json:3694-3714` — Velka 3 V3.0 source row and dimensions.
- `.data/intake-seed.sql:82,815,838,492` — seeded case records and IDs for Velka 3, M01, OTTO, and T1 Sandwich V2.1 respectively.
- `migrations/0001_initial.sql:21-40` — cases schema, including `style`, `cpu_cooler_height_mm`, `gpu_width_mm`, and `gpu_riser`; there is no dedicated mode/spine field.
- `src/lib/sheets.ts:264-298` — normalization of case dimensions, sandwich classification, and riser flags.
- `CONTEXT.md:187-189` — local definition of clearance allocation as the shared GPU-width plus cooler-height cross-section.

## Method and SQL predicate

Audited the seeded `cases` rows, normalized `style`, checked null and non-positive values, and counted missingness for the two allocation limits. The narrow eligibility predicate was:

```sql
SELECT COUNT(*)
FROM cases
WHERE lower(trim(style)) = 'sandwich'
  AND gpu_width_mm IS NOT NULL AND gpu_width_mm > 0
  AND cpu_cooler_height_mm IS NOT NULL AND cpu_cooler_height_mm > 0;
```

## Results

- 433 sandwich cases.
- 269 numeric-complete cases.
- GPU width missing: 162.
- Cooler height missing: 5.
- Both missing: 3.
- No zero or negative GPU-width or cooler-height values.
- All sandwich cases have `gpu_riser = Y`.

Representative records (GPU width / cooler height, in mm):

- T1 Sandwich V2.1 — 140 / 88; source `SFF Case <10L` row 485; seed ID `formd-t1-sandwich-v21`.
- Velka 3 V3.0 — 148 / 37; seed ID `velkase-velka-3-v30`.
- OTTO — null / null; raw `?`; seed ID `comino-otto`.
- M01 (Sandwich mode) — null / null; seed ID `sunmilo-studio-m01-sandwich-mode`.

Range and outlier context: GPU width is 69–180 mm and cooler height is 37–135 mm. NCORE 100 AIR is 180 / 70; Ophion is 175 / 90; Papyrus has a 135 mm cooler limit with GPU width missing; FF04 LP Horizontal/Vertical is 69 / 40. There is no dedicated mode field, and raw source notes/qualifiers exist only in the intake snapshot.

## Conclusion

The narrowest safe data-only eligibility guard is normalized sandwich style plus both positive numeric limits, using the SQL above; it yields 269 cases. This does **not** establish physical additivity or mode safety.

Rollout should retain an explicit sandwich classification and apply allocation only when case limits and selected-part dimensions are complete. All other records must retain scalar checks and allocation uncertainty.

## Risks for #5

- No mode/spine field.
- Raw source qualifiers are absent from D1.
- Variant-sensitive records.
- Zero GPU-riser differentiation.
