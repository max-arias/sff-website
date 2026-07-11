---
target: src/pages/build.astro
total_score: 28
p0_count: 0
p1_count: 0
timestamp: 2026-07-09T02-43-29Z
slug: src-pages-build-astro
---
## Re-Critique: SFF PC Builder — Build Page (post-fixes)

**Method:** degraded (A: inline · B: ses_0bcb0cc7affeTgA7QMZb6fF4Gd)

**Previous score: 26/40 → New score: 28/40 (+2)**

### Design Health Score

| # | Heuristic | Prev | New | What changed |
|---|-----------|------|-----|--------------|
| 1 | Visibility of System Status | 3 | 3 | Getting-started block makes empty state clearer, but still no loading skeleton |
| 2 | Match System / Real World | 3 | 4 | CLEAR/No conflicts found are builder-intuitive; verdict tooltips explain in plain terms |
| 3 | User Control and Freedom | 3 | 3 | No change |
| 4 | Consistency and Standards | 3 | 3 | Border-l jump fixed (3px consistent) |
| 5 | Error Prevention | 2 | 2 | No change |
| 6 | Recognition Rather Than Recall | 3 | 3 | Getting-started block teaches workflow; tooltips + ARIA improve discoverability |
| 7 | Flexibility and Efficiency of Use | 2 | 2 | 2-char minimum removes a blocker, still no shortcuts/bulk |
| 8 | Aesthetic and Minimalist Design | 3 | 3 | Mobile note cleanup, consistent borders, favicon |
| 9 | Error Recovery | 2 | 2 | No change |
| 10 | Help and Documentation | 2 | 3 | Getting-started block teaches interface + verdicts; tooltips provide contextual help |
| **Total** | **26** | **28** | **Good** |

### Anti-Patterns Verdict

Side-tab border gone (removed from mobile notes). Eyebrow repetition gone (homepage removed). Only Inter font warning remains (borderline). Detector: 1 warning (down from 2).

### Overall Impression

Cleaner and more approachable. Getting-started block is the most impactful change. Verdict copy + tooltips make fitment legible. Surgical fixes, no regressions.

### Priority Issues

[P2] No keyboard navigation for autocomplete results (arrow-key selection missing)
[P2] Conditional verdicts flatten all risk tiers (tight clearance and missing-data warning show same badge)
[P3] No loading skeleton during tab switches or full-page nav

### Persona Red Flags

Alex: Same — no shortcuts, no bulk clear, no arrow-key autocomplete.
Jordan: Improved — getting-started block explains the tool, tooltips explain verdicts, progressive reveals reduce intimidation.
Sam: Improved — ARIA roles, aria-busy, aria-live, aria-label, focus-visible ring. Still no arrow-key nav.

### Minor Observations

Sidebar header correctly toggles "SFF Builder" (empty) vs "Current Build" (with selections).
Getting-started block could use a subtle visual anchor.
Autocomplete redirects correctly to `/?...`.
