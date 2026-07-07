# SFF PC Builder Product Brief

## What This Website Is

SFF PC Builder is a compatibility tool for small-form-factor PC builds. It helps people understand whether a graphics card and a compact PC case can physically work together before they buy parts, tear apart a build, or spend hours digging through forum posts.

The site starts with a simple idea: in SFF builds, physical space is the real constraint. A part is not compatible just because the motherboard socket, PCIe generation, or PSU wattage looks reasonable. Millimeters matter. GPU length, width, thickness, bracket height, riser requirements, case layout, and incomplete manufacturer data can decide whether a build is possible.

The MVP focuses on cases and GPUs because that is the highest-friction dimensional conflict in most SFF builds.

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

## MVP Scope

The current MVP supports:

- Importing every exported SFF Master List worksheet except the workbook index tab.
- Normalizing dirty spreadsheet values into structured fields.
- Preserving source hyperlinks for product, seller, and other linked sheet cells.
- Searching across cases and GPUs with D1-backed autocomplete after 3 typed characters.
- Starting from either a case or a GPU.
- Selecting incompatible combinations intentionally.
- Showing exact fit issues and warning messages.
- Displaying clearance values for length, width, thickness, and PCIe slots.
- Storing production data in Cloudflare D1.
- Running locally against a seeded Cloudflare D1 database.

Imported data is stored in one wide `sff_parts` table with a `kind` column. The current case/GPU compatibility experience is derived from that catalog.

## MVP Compatibility Rules

The first engine checks:

- GPU length against case GPU length.
- GPU width against case GPU width.
- GPU thickness against case GPU height/thickness.
- GPU PCIe bracket slots against case PCIe slot support.
- Low-profile-only case support.
- Possible no-discrete-GPU/APU-only cases.
- Sandwich layout warnings.
- Riser requirement warnings.
- Watercooled GPU warnings.
- Power connector warnings in constrained PSU contexts.
- Tight-fit warnings when clearance is very small.
- Case status and availability warnings.

These rules are intentionally conservative. The goal is to prevent false confidence.

## Out Of Scope For Now

The MVP does not yet validate:

- CPU cooler compatibility.
- Motherboard compatibility.
- PSU wattage or connector compatibility beyond warnings.
- Thermal performance.
- Radiator placement.
- Fan, drive, and cable-routing tradeoffs.
- Exact 12VHPWR bend radius.
- Riser PCIe generation compatibility.
- Saved builds or user accounts.
- Affiliate routing.
- Manual community overrides.

These are future layers once the case/GPU engine is trustworthy.

## Future Ideas

- Community-intent filters: support saved, named filter bundles for common builder goals that show up repeatedly in forums and Reddit threads. For example, a `console-like SFF` filter could narrow the case table to living-room or console-style cases, then let users inspect which GPUs and other parts fit those cases. These should remain filter-and-explain tools, not ranked recommendations: failing and conditional rows should stay visible with evidence, and any subjective labels such as "console-like", "sandwich style", or "vertical footprint" should be treated as explicit, reviewable catalog attributes with provenance.

## User Experience Direction

The interface should feel like a fast technical instrument, not a lifestyle configurator.

The preferred direction is:

- Search first.
- Keep the homepage utilitarian and tool-like rather than marketing-led.
- Dense, scan-friendly data.
- Stark visual hierarchy.
- Ghost incompatible parts instead of hiding them.
- Explain every failure with a concrete reason.
- Let users choose invalid combinations so they can learn why they fail.
- Treat warnings as first-class information, not footnotes.
- Make autocomplete labels specific enough to distinguish real variants, not just family names.

The target user values speed, clarity, and specificity over decorative 3D renders.

## Why This Can Matter

SFF building is a community knowledge problem as much as a shopping problem. The best information is spread across spreadsheets, product pages, Discord messages, Reddit posts, build logs, and forum corrections.

This website can become the layer that turns that scattered knowledge into a practical decision tool: not just “will it fit?”, but “what do we know, what is uncertain, and what should I verify before buying?”
