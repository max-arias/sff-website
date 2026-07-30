---
title: "Present sandwich clearance allocation in the build workspace"
labels:
  - wayfinder:prototype
status: closed
assignee: max-arias
blocked_by: []
parent: https://github.com/max-arias/sff-website/issues/1
---

## Purpose

Make the shared cross-section decision legible without turning `/build` into a layout simulator. The experience should answer one practical question: **with this case and one selected part, how much room remains for the other part?** Keep the existing fitment-first table, persistent selected-build panel, non-blocking selection, and visible `pass` / `conditional` / `fail` model.

This is a presentation specification, not a new verdict model. It applies only to cases explicitly classified as `sandwich`; do not infer sandwich behavior from size, riser presence, or a generic case note.

## Settled product rules

- A sandwich case's shared cross-section is `case GPU width limit + case CPU cooler height limit`.
- Allocation is eligible only when the case has both positive limits and the selected part's dimension is known. The audit found **269 of 433** catalog sandwich cases meet the complete case-limit guard.
- With a selected GPU, the GPU width is the consumed side and the remaining cooler limit is calculated. With a selected CPU cooler, the cooler height is the consumed side and the remaining GPU-width limit is calculated.
- The calculated limit replaces the scalar case limit on the active/open side. If the calculation cannot be completed, retain the scalar limit where it exists and label the result `CONDITIONAL` because allocation is uncertain.
- A known hard conflict wins over uncertainty. A pair can therefore show `FAIL` as its primary result and retain a secondary conditional explanation; never soften a known fail into conditional.
- Riser evidence remains a separate fitment item. Do not fold “requires a riser” into the allocation card.
- Do not show a generic “sandwich layout may vary” advisory. Do not add a spine selector, side toggle, mode switch, or manual allocation control. There is no mode/spine field in the data.

## Placement and hierarchy

On desktop, keep the selected-build panel persistent in the existing left sidebar. Keep its fixed slot order. Place the allocation card:

1. after the selected `case`, `gpu`, and `cpu-cooler` slot cards (and after visible empty slots),
2. before **Build Issues**,
3. only when the selected case is explicitly `Sandwich`.

The card is a focused relationship summary, not a replacement for the three slot cards. The panel hierarchy is:

1. build status and short status copy;
2. selected parts and their individual verdicts;
3. **Clearance allocation** (the cross-section explanation);
4. grouped build issues, including relational echoes;
5. empty-slot actions remain available and never disappear because the card is conditional.

When no sandwich case is selected, omit the card entirely. Do not leave a generic sandwich hint in its place. When a sandwich case is selected but the pair is incomplete, show the card in an inactive or conditional state so the missing dependency is explicit.

## Card anatomy and feel

Use a compact, technical instrument card: white/base surface, 1px border, 12–14px internal padding, a small monospace uppercase eyebrow, and a clear title. Give the card enough breathing room from slot cards (`12px` gap) and separate its equation from supporting copy with a subtle rule. Avoid a large illustration or decorative 3D layout.

Recommended anatomy:

- eyebrow: `CLEARANCE ALLOCATION`;
- title: `Sandwich cross-section`;
- primary state line: a text verdict badge plus a short sentence;
- allocation strip: two labeled segments, `GPU width` and `CPU cooler height`, with values in `mm`; the consumed side is visually emphasized and the remaining side is outlined/hatched;
- equation/details line, for example `148 mm GPU limit + 37 mm cooler limit = 185 mm shared space`;
- remaining-space line, for example `CPU cooler clearance: 45 mm remaining`;
- a small `Why?` / details disclosure only if the full evidence message is longer than the card can comfortably carry. The primary answer must not be hidden behind it.

Use a restrained accent for the active/open side, a neutral treatment for the consumed side, and a visible hatch or `REMAINING` label for the remainder. Never make the strip the only indicator of state. Values must remain readable when color is removed.

“Active side” means the open side currently being evaluated: GPU when browsing GPUs with a selected cooler, or CPU cooler when browsing coolers with a selected GPU. Name it in text (`Active side: GPU width`) rather than exposing a control. The current table kind may make the side obvious visually, but it must not be the only cue.

## Grounded UI copy

Use concise copy and replace placeholders with the actual part labels and millimeter values. Avoid “compatible”, “best”, “safe”, and “layout mode” as blanket claims.

### Complete / pass

Badge: `PASS`

Primary copy: **`{active side} fits with {remaining} mm remaining.`**

Detail: `Shared space: {case GPU limit} mm GPU + {case cooler limit} mm cooler = {total} mm. {consumed part} uses {used} mm; {open part} is limited to {calculated limit} mm.`

Use `PASS` only when the relevant dimensions and both case limits are complete and no hard conflict exists. A tight-but-fitting ordinary dimension check may retain its existing advisory evidence; do not invent a new “tight allocation” state.

### Complete / fail

Badge: `FAIL`

Primary copy: **`{active side} exceeds its allocated limit by {over} mm.`**

Detail: `{open part} measures {used} mm; the calculated limit is {calculated limit} mm.`

Keep the selection and show the failure. The action remains replaceable/removable; no blocking confirmation or auto-correction.

### Missing data / conditional

Badge: `CONDITIONAL`

Primary copy: **`Allocation cannot be fully checked — {missing dimension or case limit} is missing.`**

If a scalar limit remains usable: `Using the case's {scalar} mm scalar limit for now; the shared allocation is uncertain.`

If no usable scalar exists: `No calculated limit is available for the {active side}; verify the case and selected-part dimensions.`

Do not call this `UNKNOWN`, and do not imply that a missing value passes. Keep the affected metric cell marked conditional with the same grounded explanation.

### Inactive / no paired part

Badge: `INACTIVE`

Primary copy: **`Select a GPU and CPU cooler to allocate this shared space.`**

If one side is selected: **`Select a {missing part} to calculate the remaining {active side}.`**

Show known case limits beneath this copy when available, but label them `Case scalar limits`, not `Remaining`. “Remaining” is reserved for an actual subtraction from the shared cross-section.

## GPU and cooler table presentation

Keep type-specific schemas. The GPU table continues to foreground `Length`, `Width`, `Thickness`, and `Slots`; the cooler table foregrounds `Height` and its existing relevant metrics. Do not create a generic cross-kind “clearance” column.

For GPU rows:

- map `gpuWidthMm` evidence to the **Width** cell;
- when a cooler is selected and the case is allocation-eligible, compare width with the calculated GPU-width limit and put the calculated-limit message in that cell;
- leave the displayed part value as the measured width (for example `140 mm`), and express the limit in the evidence message (`limit 132 mm`) so the catalog value is not rewritten;
- keep length, thickness, slot, and other evidence in their existing cells.

For CPU-cooler rows:

- map `coolerHeight` evidence to the **Height** cell;
- when a GPU is selected and the case is allocation-eligible, compare height with the calculated cooler-height limit and put that message in the Height cell;
- leave the displayed height unchanged and state the allocated limit in the evidence message.

Cell treatment follows the existing cell-level evidence mapping: a light row tint communicates the overall verdict, while the evidence cell gets the stronger border/background, a short visible marker, and an accessible message. `FAIL` evidence outranks conditional evidence when both map to the same cell. The cell title/description may carry the complete calculation, but essential text must also be available to keyboard and screen-reader users; do not rely on hover-only tooltips.

The row note can summarize the first decisive issue, but must not replace the highlighted metric cell. In mobile cards, turn each evidence-bearing metric into a labeled metric block with the same marker and put the short evidence sentence directly below the value. This prevents Width/Height evidence from being lost when the table becomes a card.

## Pair with fail plus uncertainty

Render one primary verdict, not two competing badges:

- primary: `FAIL` and the concrete hard-conflict sentence;
- secondary line: `Also conditional: {uncertainty message}`;
- evidence list/order: hard conflict first, then missing-data or advisory uncertainty, then pass confirmations only if useful.

The panel may repeat the relationship under both implicated slot labels, consistent with relational issue echo, but the copy should identify both parts. Example: `GPU width exceeds the allocated sandwich limit by 4 mm. Also conditional: GPU riser requirement is separate and not validated here.` Do not let the conditional line hide or downgrade the fail. Keep both cells/metrics marked where they apply: the failing Width or Height cell is fail; a separate unresolved metric or note is conditional.

## Responsive behavior

At the current desktop breakpoint (`lg`), the left panel remains open and independently scrollable. The allocation card should stay near the selected slots while the table scrolls; it should not become a floating overlay over table content.

Below `lg`, the selected-build panel remains the existing drawer. Opening it should reveal the same order as desktop: status, fixed-order slots, allocation card, then Build Issues. The allocation card is full-width within the drawer, not a horizontal mini-table. Keep the equation and two-segment strip readable at narrow widths; stack the detail line if needed.

The mobile candidate view remains cards rather than a horizontally scrolling desktop table. Order each GPU/cooler card as: action, part name, verdict, evidence-bearing metrics (Width for GPU; Height for cooler) first, remaining metrics, then note/evidence. Show `Active side` and the allocated limit in the relevant metric block. Do not hide failing or conditional cards.

At very narrow widths, allow long model names and evidence to wrap; never truncate the only failure reason. Preserve a minimum 44px target for drawer, clear, add, swap, and close actions. The drawer toggle must announce its expanded/open state and the close control must have a specific accessible name.

## Accessibility and non-color indicators

- Use a real `section` with an accessible heading, such as `Clearance allocation`, and a short state sentence that can be read without inspecting styling.
- Use text badges (`PASS`, `CONDITIONAL`, `FAIL`, `INACTIVE`) plus distinct icons or symbols: check, warning triangle, cross, and pause/neutral mark. Never rely on green/amber/red alone.
- Give the allocation strip a text alternative: `GPU width: 140 mm used of 148 mm case limit; CPU cooler: 45 mm remaining.` If it is a progress-like visual, provide an accessible name/value, but do not imply a percent is a physical guarantee.
- Use `aria-describedby` from the affected Width/Height cell to its evidence message, or render the message in the cell. Tooltips may add detail but cannot be the only channel.
- Ensure focus-visible outlines remain apparent on dark/light themes, and maintain sufficient contrast for muted labels and hatched/outlined segments.
- Do not announce an inactive card as a failure. Do not announce a conditional missing value as a pass.

## Explicitly out of scope

- Manual spine, side, or sandwich-mode controls.
- A generic sandwich-layout advisory or a claim that catalog classification proves physical additivity.
- Allocation for cases without explicit sandwich classification.
- Allocation when case limits or the selected GPU/cooler dimension are absent/non-positive; use scalar fallback plus conditional uncertainty where a scalar exists.
- Replacing the scalar case GPU-width or cooler-height column values with calculated values; calculated limits belong in fitment evidence and the panel, while part dimensions remain catalog facts.
- Folding riser requirements, PCIe generation, thermal performance, radiator/tubing, cable routing, or 12VHPWR bend radius into this card.
- Hiding, disabling, or auto-removing a failing/conditional selection.
- A new recommendation score, “best fit” ranking, or fourth verdict state.
- Provenance/source display beyond the current product scope.
