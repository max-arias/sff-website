---
target: src/pages/index.astro
total_score: 26
p0_count: 0
p1_count: 1
timestamp: 2026-07-08T20-22-04Z
slug: src-pages-index-astro
---
## Design Critique: SFF PC Builder — Homepage

**Method:** degraded (A: inline · B: ses_0bcb0cc7affeTgA7QMZb6fF4Gd)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Autocomplete feedback good; no loading skeleton for table. |
| 2 | Match System / Real World | 3 | SFF terminology correct. Pass/Conditional/Fail maps to builder mental model. |
| 3 | User Control and Freedom | 3 | Filters clearable, selections have clear buttons. No undo after clear. |
| 4 | Consistency and Standards | 3 | DaisyUI vocabulary consistent. Verdict badges, mono labels repeat predictably. |
| 5 | Error Prevention | 2 | Intentional non-blocking. No confirmation on part clear. |
| 6 | Recognition Rather Than Recall | 3 | Kind tabs show all options. Autocomplete surfaces names. Empty slots show "Find X". |
| 7 | Flexibility and Efficiency of Use | 2 | No keyboard shortcuts. No bulk actions. Search requires 3 chars minimum. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean daisyUI vocabulary. Muted palette appropriate. |
| 9 | Error Recovery | 2 | Errors surface but no inline recovery suggestions. |
| 10 | Help and Documentation | 2 | PSU tier popover only contextual help. No tooltips on filters. |
| **Total** | | **26/40** | **Acceptable** |

### Anti-Patterns Verdict

**LLM assessment:** Does not immediately read as AI-generated. However, two patterns are present:
1. Eyebrow repetition on homepage (index.astro:145, 162): Both launch-path cards have identical mono uppercase tracked eyebrows.
2. Identical sibling cards (index.astro:140-213): Two cards with exact same visual structure (icon, eyebrow, title, copy, search, badges, CTA) — "identical card grid" at n=2.

**Deterministic scan:** Side-tab accent border flagged on build.astro:159 — false positive (editorial note callout, not card accent). Inter font flagged — borderline (pragmatic for data-table tool, but overused).

### Overall Impression

Build page is stronger. Homepage is competent but generic — doesn't telegraph the fitment engine. Biggest missed opportunity: homepage doesn't preview what makes the tool special.

### What's Working

1. Verdict system (pass/conditional/fail) with clear color coding and visible failing rows.
2. Sidebar slot cards — empty vs filled states are visually distinct with useful at-a-glance data.
3. Mono-font data differentiation (mono for machine labels, Inter for content).

### Priority Issues

**[P1] Homepage doesn't telegraph the fitment engine:** Presents as generic parts search. No preview of fitment analysis.
Fix: Show evidence strip previewing what /build does. Command: /impeccable bolder

**[P2] "Unscored" verdict is a domain leak:** Reads as dismissive. Actually means "no known conflicts."
Fix: Rename to "No conflicts found." Command: /impeccable clarify

**[P2] Autocomplete minimum 3 chars blocks valid 2-char queries:** GPU model "RT", case "A4" die silently.
Fix: Lower to 2 chars. Command: /impeccable harden

**[P3] No loading states for table or search:** Bare "Searching..." text; no transition indicator between kind tabs.
Fix: Skeleton grid during transitions. Command: /impeccable harden

### Persona Red Flags

**Alex (Power User):** No keyboard shortcuts. No bulk clear. No arrow-key autocomplete navigation.
**Jordan (First-Timer):** Homepage doesn't explain fitment. "Conditional" has no hover tooltip.
**Sam (Accessibility):** Theme toggle has no state indication. Sort direction is SVG opacity only. Autocomplete panel uses hidden toggling (removed from a11y tree).

### Minor Observations

- 3-eyebrow sandwich on homepage (Build wizard label + 2 card eyebrows).
- Mobile note italic + border-l-2 feels heavy.
- Body gradient may band on low-quality dark displays.
- Sidebar border-l jumps 3px→4px for currently-viewed kind.
- No favicon.

### Questions to Consider

1. What if the homepage WAS the build page?
2. Should conditional verdicts carry severity levels?
3. What would a confident empty-state sidebar look like?
4. What do you lose by removing the homepage entirely?
