Type: task
Status: resolved

## Answer

Replaced all 5 `casePart.flags.includes(...)` checks in `checkCaseGpuCompatibility` with typed column reads:

1. `possibly-no-discrete-gpu-support` → `gpuLengthMm === null && pcieSlots === null`
2. `low-profile-only` → LP slots > 0 and full-height slots === 0
3. `sandwich-layout` → `style.toLowerCase() === "sandwich"`
4. `requires-riser` → `gpuRiser === "Y"`
5. `riser-optional` → `gpuRiser === "Optional"`

Dimensional checks (`compareMax`) and GPU/PSU direct checks unchanged. Zero type errors.

Blocked by: 10

## Question

Update the fitment engine to read case attributes from the `cases` table instead of `sff_parts`.

Current state: The fitment engine (in `src/server/d1.ts` or related modules) evaluates case→GPU compatibility by reading `case_gpu_length_mm`, `case_gpu_width_mm`, `case_gpu_thickness_mm`, `case_pcie_slots`, `case_style`, `case_gpu_riser`, etc. from the monolithic table.

New requirements:
- All case attribute reads must come from the `cases` table
- GPU attribute reads from the `gpus` table
- The engine's interface should work with typed row objects from the new query functions (ticket 10)
- No other fitment rules change — only the data source changes
- Existing fitment logic (length, width, thickness checks, riser warnings, sandwich warnings, low-profile checks, etc.) remains the same

Scope: Only the case↔GPU fitment path. Other paths (case↔cooler, case↔PSU) are out of scope — they didn't exist in the old engine either.

Questions to resolve:
- Where exactly does the fitment logic live? (in `src/server/d1.ts` row mappers? separate module? API route logic?)
- Should the engine be extracted from `d1.ts` into its own module during this change, or stay inline?
