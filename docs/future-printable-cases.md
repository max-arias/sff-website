# Future Feature: 3D-Printable SFF Case Directory

## Summary

Add a future section for 3D-printable small-form-factor PC case projects. This should start as a separate informative directory, not as rows in the core `/build` fitment table.

The printable-case ecosystem is valuable, but the available data is uneven. Most public sources are good for discovery and source links, while only a smaller set of open-source repositories provide enough verified dimensional data for fitment decisions.

## Product Recommendation

Build this as a separate route first:

- `/printable-cases`, or
- `/cases/printable`

Treat printable cases as a **project directory** before treating them as fitment-engine cases.

Only graduate a printable case into the main `/build` case catalog when its constraints are manually verified well enough to support `pass`, `conditional`, and `fail` evidence.

## Why This Should Not Start In `/build`

The existing build experience is a fitment engine. Its case data is dimension-first and assumes a physical catalog part with known clearances.

3D-printable cases add a second product question: **can this case be fabricated from the available project files?** That requires metadata the current `cases` model does not track:

- print file URLs
- STL/STEP/F3D/3MF availability
- license and commercial-use restrictions
- source platform
- print volume requirements
- material assumptions
- print difficulty
- support/orientation notes
- remix/provenance status
- maintainer freshness

Most platform listings do not expose reliable, machine-readable fitment constraints. Adding weakly verified printable cases directly to `/build` would reduce trust in the core fitment engine.

## Data Sources Investigated

### Best Primary Sources

#### GitHub case repositories

GitHub is the strongest source for high-quality printable/open-source case projects because repositories often include README specs, CAD, BOMs, licenses, issues, releases, stars, and update history.

Useful examples found during investigation:

- `wintercharm/Winter-One` — strong single-case repository with CAD, manual, spec sheet, dimensions, volume, GPU/CPU/PSU/radiator support, and license.
- `berserkwarwolf/OpenCase` — modular Mini-ITX case with variant-specific support notes.
- `cokeeffekt/yasff` — 6.4L project with BOM, CAD, dimensions, and constraints.
- `NanyiJiang/Skyscraper` — open-source ITX case with CAD, but less structured fitment data.

GitHub is suitable for future ingestion because its APIs are stable and expose maintenance signals.

#### `help-14/sffpc`

Repository: <https://github.com/help-14/sffpc>

This is a useful seed list of DIY SFF case projects. It is mostly a directory of names, descriptions, images, and links rather than a structured fitment source, but it is a good starting point for manual enrichment.

### Useful Secondary Sources

#### Printables

Search: <https://www.printables.com/search/models?q=sff+case>

Good for discovering printable models and license information. No documented public API was found. Fitment data is usually not structured enough for automated compatibility decisions.

#### Thingiverse

Search: <https://www.thingiverse.com/search?q=sff+pc+case&type=things&sort=relevant>

Large legacy collection. The developer/API story appears unstable, and many older entries have inconsistent metadata. Useful as a referral/discovery source, not a trusted fitment source.

#### MakerWorld

Search: <https://makerworld.com/en/search?q=sff%20pc%20case>

Growing source, but access is more closed and client-side-heavy. Lower priority for ingestion.

### Community Sources

#### Reddit `r/sffpc`

Useful for discovery, project announcements, and occasional shared spreadsheets. Data is unstructured and prone to link rot.

#### SFF.Network

Very high-value community knowledge, build logs, and reference resources. Bulk ingestion is difficult because public access is limited and forum data is not structured.

## Proposed MVP Data Shape

For the first directory version, store project-level data rather than trying to force these into existing part rows.

Recommended fields:

- `id`
- `name`
- `creator`
- `summary`
- `source_url`
- `platform` — GitHub, Printables, Thingiverse, MakerWorld, SFF.Network, personal site, etc.
- `license`
- `file_formats` — STL, STEP, F3D, 3MF, CAD source, etc.
- `volume_l`
- `dimensions_mm`
- `motherboard_support`
- `psu_support`
- `gpu_length_mm`
- `gpu_width_mm`
- `gpu_thickness_mm`
- `cpu_cooler_height_mm`
- `radiator_support`
- `print_volume_required_mm`
- `material_notes`
- `print_difficulty`
- `last_updated`
- `last_verified`
- `fitment_ready` — boolean
- `verification_notes`
- `provenance` — source-attributed claims for important specs

## Directory UX Direction

The page should be informational and provenance-heavy:

- cards or a compact table of printable case projects
- source/platform badges
- license badges
- fitment-ready indicator
- known dimensions and limits when available
- clear “unverified” state for missing or uncertain claims
- links to files/project pages, not re-hosted print files unless licensing explicitly permits it

This should not rank or recommend cases. It should filter and explain, consistent with the rest of SFF Builder.

## Fitment Graduation Rule

A printable case can be added to the main `/build` case catalog only when it has enough verified physical constraints for evidence-based fitment:

- confirmed external dimensions or volume
- motherboard form factor support
- PSU support
- GPU clearance envelope
- CPU cooler clearance, if relevant
- PCIe slot/riser assumptions
- source URL and verification date
- known caveats represented as `conditional` evidence

Until then, it should remain in the printable-case directory with `fitment_ready = false`.

## Suggested Implementation Phases

### Phase 1 — Manual Directory

- Add a static or seeded printable-case data file.
- Seed from `help-14/sffpc` plus a small set of known GitHub case projects.
- Build a standalone directory route.
- Keep all entries out of `/build` unless manually verified.

### Phase 2 — Enrichment

- Add richer fields for license, file formats, source platform, and known dimensions.
- Add provenance for each important fitment claim.
- Add filters for platform, license, motherboard support, PSU support, volume, and fitment-ready status.

### Phase 3 — Verified Fitment Bridge

- Promote selected printable cases into the main case catalog only after manual verification.
- Preserve links back to the printable-case project record.
- Surface print-specific caveats as `conditional` evidence rather than hiding uncertainty.

### Phase 4 — Assisted Discovery

- Use GitHub API/search to discover candidate repositories.
- Use platform links as referral/discovery inputs.
- Keep human review as the gate before publishing fitment-ready data.

## Open Questions

- Should the first route be named `/printable-cases`, `/cases/printable`, or something else?
- Should printable case data live in D1 immediately, or start as a checked-in seed file?
- Should fitment-ready printable cases be duplicated into `cases`, or should `cases` reference a separate printable-project record?
- What minimum source quality is required before a case can become `fitment_ready`?
- How should non-commercial licenses be represented in the UI?
