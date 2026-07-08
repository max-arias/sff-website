---
target: src/pages/build.astro
total_score: 26
p0_count: 0
p1_count: 1
timestamp: 2026-07-08T20-22-05Z
slug: src-pages-build-astro
---
## Design Critique: SFF PC Builder — Build Page

**Method:** degraded (A: inline · B: ses_0bcb0cc7affeTgA7QMZb6fF4Gd)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Build status in sidebar clear; no loading skeleton. |
| 2 | Match System / Real World | 3 | SFF terminology correct. Pass/Conditional/Fail maps to builder intuition. |
| 3 | User Control and Freedom | 3 | Filters clearable, clear buttons on slots. No undo. |
| 4 | Consistency and Standards | 3 | DaisyUI vocabulary consistent across tabs, table, sidebar. |
| 5 | Error Prevention | 2 | Intentional non-blocking. No destructive guardrails. |
| 6 | Recognition Rather Than Recall | 3 | Tabs visible, slots prompt "Find X", info popover teaches PSU tier. |
| 7 | Flexibility and Efficiency of Use | 2 | No keyboard shortcuts, no bulk actions, 3-char search minimum. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean. Dense sidebar but scannable. Muted palette serves the tool feel. |
| 9 | Error Recovery | 2 | Errors surface in sidebar issues + table notes. No inline recovery. |
| 10 | Help and Documentation | 2 | Only PSU tier popover. No inline tooltips on verdicts or sliders. |
| **Total** | | **26/40** | **Acceptable** |

### Anti-Patterns Verdict

**LLM assessment:** Build page avoids most AI tells cleanly. No gradient text, glassmorphism, hero metrics, numbered markers. The table-first layout reads as a real tool.

**Deterministic scan:** One false positive (border-l-2 on note callout). Inter font flagged as overused — borderline.

### Overall Impression

The stronger surface. Clear mental model (sidebar = selected, table = catalog). Non-blocking philosophy is executed well. Needs onboarding guidance for empty state.

### What's Working

1. Verdict system with visible failing rows and color-coded badges.
2. Sidebar slot cards communicate state clearly (empty vs filled, verdicts, specs grid).
3. Mono-font data differentiation creates clean machine/human distinction.

### Priority Issues

**[P1] Sidebar empty-state lacks guidance:** Six empty slots with "Find X" prompts. First-timer doesn't know where to start.
Fix: Getting-started prompt guiding user to search case or GPU first. Command: /impeccable onboard

**[P2] "Unscored" verdict is a domain leak:** Reads as dismissive. Means "no known conflicts."
Fix: Rename to "No conflicts found." Command: /impeccable clarify

**[P2] Autocomplete min 3 chars:** Blocks 2-char model numbers (RT, A4).
Fix: Lower to 2 chars. Command: /impeccable harden

**[P3] No loading states:** Bare "Searching..." text. No transition indicator between tabs.
Fix: Skeleton grid during transitions. Command: /impeccable harden

### Persona Red Flags

**Alex:** No keyboard shortcuts, no bulk clear, no arrow-key autocomplete.
**Jordan:** "Conditional" has no hover tooltip. Slot labels use domain shorthand.
**Sam:** Sort direction is SVG opacity only. Autocomplete panel hidden toggling removes from a11y tree. No focus-visible overrides.

### Minor Observations

- Sidebar border-l jumps 3px→4px for currently-viewed kind (build.astro:308-314).
- Mobile note italic + border-l-2 feels heavy.
- No favicon.

### Questions to Consider

1. What if the homepage WAS the build page?
2. Should conditional verdicts carry severity levels?
3. What would a confident empty-state sidebar look like?
4. What do you lose by removing the homepage entirely?
