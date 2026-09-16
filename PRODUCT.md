# SFF PC Builder Product Brief

## What This Website Is

SFF PC Builder is a fitment engine for small-form-factor PC builds. It helps people understand whether a set of parts can physically work together before they buy parts, tear apart a build, or spend hours digging through forum posts.

The site starts with a simple idea: in SFF builds, physical space is the real constraint. A part is not compatible just because the motherboard socket, PCIe generation, or PSU wattage looks reasonable. Millimeters matter. GPU length, width, thickness, bracket height, riser requirements, case layout, cooler clearance, RAM height, PSU form factor, and incomplete manufacturer data can decide whether a build is possible.

The Release Scope covers fitment between all major part categories: case↔GPU, cooler↔case, PSU↔case, motherboard↔case, RAM↔motherboard, and RAM↔cooler. The engine evaluates a full build configuration, not just case/GPU pairs.

## Who It Helps

This product is for PC builders who care about compact builds, especially:

- First-time SFF builders trying to avoid expensive compatibility mistakes.
- Enthusiasts comparing cases like FormD, Ncase, Velkase, Louqe, Sliger, Dan, and smaller community designs.
- Builders working with discontinued, imported, DIY, or niche cases where documentation is fragmented.
- People starting from a specific GPU and trying to find a case that can actually fit it.
- People starting from a case and trying to understand the practical GPU envelope.
- Community maintainers who need a cleaner way to turn spreadsheet data into useful build guidance.

It is not designed as a general PCPartPicker replacement. It is narrower, more physical, and more transparent about uncertainty.

## The Problem

SFF builds fail in ways normal compatibility tools do not model well:

- A GPU can be short enough but too thick.
- A case can support a discrete GPU only with a riser.
- A case may be low-profile only.
- A sandwich case can change CPU cooler or GPU clearance depending on slot mode.
- A watercooled GPU may fit by card dimensions but still need radiator and tubing clearance.
- A GPU may need power connectors or cable bend space the case data does not describe.
- Source data often contains blanks, ranges, question marks, discontinued products, and ambiguous notes.

The product should not pretend these problems are cleaner than they are. If the data is incomplete, the user should see that directly.

## Product Principle

The core principle is: **never hide uncertainty**.

The site should distinguish between:

- `pass`: the known dimensions fit.
- `fail`: the known dimensions do not fit.
- `conditional`: the combination might work, but there are warnings, missing values, layout dependencies, or practical build risks.

This is more useful than a simple compatible/incompatible badge because SFF builders often make informed tradeoffs. The product should give them the evidence, not make a vague promise.

## Release Scope

The current release scope supports:

- Importing every exported SFF Master List worksheet except the workbook index tab.
- Normalizing dirty spreadsheet values into structured fields.
- Preserving source hyperlinks for product, seller, and other linked sheet cells.
- Searching across all part kinds with D1-backed autocomplete after 3 typed characters.
- Starting from any part kind (case, GPU, PSU, cooler, motherboard, RAM).
- Building a full multi-slot build configuration with fitment evaluation across all selected parts.
- Selecting incompatible combinations intentionally.
- Showing exact fit issues and warning messages.
- Showing each selected part's warnings and errors on that part's card in the build panel, with a per-warning ignore control. A finding that involves two parts is listed once, on the part whose data caused it.
- Copying the selected build as a plain-text part list for sharing, carrying the build URL and one line per selected part.
- Letting users ignore a warning they have already verified, so the build stops reporting a warning they have resolved. Hard conflicts (`fail`) stay visible and cannot be ignored.
- Displaying clearance values for case, GPU, cooler, PSU, and motherboard dimensions.
- Hiding rows with no fitment-relevant data from the default `/build` table while keeping them available through the URL-backed **Show sparse rows** toggle.
- Storing production data in Cloudflare D1 across per-kind tables (`cases`, `gpus`, `cpu_coolers`, `fans`, `motherboards`, `psus`, `ram`).
- Running locally against a seeded Cloudflare D1 database.

## Compatibility Rules

The engine checks:

- GPU ↔ case: length, width, thickness, PCIe slot count, low-profile/APU-only, sandwich/riser warnings, watercooled GPU, power connectors, tight-fit warnings.
- CPU cooler ↔ case: cooler height against case CPU cooler clearance.
- PSU ↔ case: PSU form factor against case PSU support.
- Motherboard ↔ case: motherboard form factor against case motherboard support.
- RAM ↔ motherboard: RAM type compatibility.
- RAM ↔ CPU cooler: RAM height against cooler RAM clearance.
- Case status and availability warnings.

These rules are intentionally conservative. The goal is to prevent false confidence.

## Out Of Scope For Now

The engine does not yet validate:

- Thermal performance modeling.
- Radiator placement within case layouts.
- Fan, drive, and cable-routing tradeoffs.
- Exact 12VHPWR bend radius.
- Riser PCIe generation compatibility.
- Saved builds or user accounts.
- Affiliate routing.
- Manual community override entries.
- Formal data/source attribution display in the UI (raw provenance is preserved in the pipeline; surfacing it visibly is a near-future goal).

These are future layers once the core fitment engine behavior is stable.

## Future Ideas

- **Data Attribution**: The build panel now credits the sources behind the catalog — SFF PC Master List, PSU tier list, Cybenetics, HWBusters reviews, and smallformfactor.net — and links back to each. Per-claim traceability is still ahead: showing the origin of an individual measurement or fitment claim needs the pipeline's per-record links persisted to the catalog tables first (see [DATA.md](./DATA.md)).
- **Community-intent filters**: support saved, named filter bundles for common builder goals that show up repeatedly in forums and Reddit threads. For example, a `console-like SFF` filter could narrow the case table to living-room or console-style cases, then let users inspect which GPUs and other parts fit those cases. These should remain filter-and-explain tools, not ranked recommendations: failing and conditional rows should stay visible with evidence, and any subjective labels such as "console-like", "sandwich style", or "vertical footprint" should be treated as explicit, reviewable catalog attributes with provenance.
- 3D-printable SFF case directory: start printable/open-source case projects as a separate informative directory rather than adding them directly to the `/build` fitment table. Only promote printable cases into the core case catalog after their dimensional constraints are manually verified. See [Future Feature: 3D-Printable SFF Case Directory](./docs/future-printable-cases.md).

## User Experience Direction

The interface should feel like a fast technical instrument, not a lifestyle configurator.

The preferred direction is:

- Search first.
- Keep the homepage utilitarian and tool-like rather than marketing-led.
- Dense, scan-friendly data.
- Stark visual hierarchy.
- Ghost incompatible parts instead of hiding them.
- Hide rows that have no fitment-relevant evidence by default, with a visible toggle to include them when auditing the full catalog; this must not hide `pass`, `conditional`, or `fail` rows.
- Explain every failure with a concrete reason.
- Let a user dismiss a warning they have verified, since a researched riser cable or confirmed slot mode is no longer an open question. Keep the dismissed warning on the part card marked as ignored, with a restore control, instead of deleting it.
- Keep hard conflicts non-negotiable: `fail` stays visible and cannot be dismissed.
- Let users choose invalid combinations so they can learn why they fail.
- Treat warnings as first-class information, not footnotes.
- Make autocomplete labels specific enough to distinguish real variants, not just family names.

The target user values speed, clarity, and specificity over decorative 3D renders.

## Why This Can Matter

SFF building is a community knowledge problem as much as a shopping problem. The best information is spread across spreadsheets, product pages, Discord messages, Reddit posts, build logs, and forum corrections.

This website can become the layer that turns that scattered knowledge into a practical decision tool: not just “will it fit?”, but “what do we know, what is uncertain, and what should I verify before buying?”
