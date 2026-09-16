# SFF Builder

SFF Builder is a fitment engine for small-form-factor PC enthusiasts. It exists to turn fragmented hardware specs and community knowledge into precise, explainable clearance decisions.

## Language

**Fitment Engine**:
A system that evaluates whether a set of parts can physically work together in an SFF build and explains why.
_Avoid_: Catalog search, landing page, configurator

**Component Catalog**:
The searchable inventory of cases, GPUs, coolers, and related parts that feeds the fitment engine.
_Avoid_: Product database, listings

**Fitment Decision**:
The evaluated outcome for a part or combination, expressed as `pass`, `fail`, or `conditional`.
_Avoid_: Compatibility badge, recommendation

**Conditional Uncertainty**:
The rule that missing, incomplete, or caveat-heavy data remains within `conditional` rather than creating a separate verdict state.
_Avoid_: Fourth verdict, unknown-only status

**Hard Conflict**:
A known physical constraint violation derived from available data, such as a dimensional or slot mismatch that cannot coexist within the current build state.
_Avoid_: Risk, inconvenience, maybe-problem

**Filter And Explain**:
The product behavior of narrowing candidate parts to those relevant to a chosen constraint, then showing the evidence behind each fitment outcome.
_Avoid_: Ranking, best picks, recommendations

**Build Configuration**:
The current set of selected parts and constraints that the engine uses to evaluate what can still fit in a build.
_Avoid_: Pair, completed build, wishlist

**Candidate Part**:
A part shown to the user as a possible next selection within the current build state, along with its fitment evidence.
_Avoid_: Recommendation, approved part

**Fitment Evidence**:
The concrete dimensional checks, caveats, and uncertainty notes that explain why a part is marked `pass`, `fail`, or `conditional`.
_Avoid_: Score, magic result

**Non-Blocking Fitment**:
A product rule that no part is forbidden outright; the engine surfaces known issues and uncertainty but still allows the user to select it.
_Avoid_: Hard lock, prevented choice

**Adjacent Constraint**:
A non-primary rule related to a build, such as platform, electrical, or power considerations, that may be surfaced later but is not the core fitment problem the product is built around.
_Avoid_: Main fitment rule, full compatibility

**Provenanced Claim**:
A source-attributed assertion about a part attribute, measurement, or fitment observation that remains traceable to where it came from.
_Avoid_: Silent fact, untracked override

**Current View**:
The derived fitment-facing representation of a part or build state produced from one or more **Provenanced Claims** under explicit rules.
_Avoid_: Raw source dump, hidden normalization

**Contribution Intake**:
The v1 process for collecting proposed corrections or additions through GitHub issues, which are then reviewed and incorporated manually with provenance.
_Avoid_: Live wiki edit, direct public write access

**Catalog-Only Selection**:
The v1 rule that selected build parts must come from catalog records already present in the database, not from ad hoc user-entered custom parts.
_Avoid_: Manual shadow part, user-defined temporary part

**Catalog Record ID**:
The concrete catalog record ID used to identify a selected part in URL state and build selection.
_Avoid_: Abstract family ID, SQLite rowid

**Kind-Slot Equivalence**:
The v1 rule that the active table `kind` and the destination **Role Slot** are the same thing.
_Avoid_: Separate target selector, ambiguous selection destination

**Fixed Slot Order**:
The rule that the **Selected Build Panel** shows v1 slots in a stable predefined order rather than reordering them based on interaction history.
_Avoid_: Chronology-implying layout, shifting panel order

**Visible Empty Slot**:
An unfilled **Role Slot** that still appears in the **Selected Build Panel** so the remaining build structure, open constraints, and jump actions stay visible.
_Avoid_: Hidden missing slot, fill-only panel

**Empty Slot Action**:
The persistent action shown on an empty slot that opens the matching table kind, becoming a stronger compatibility jump when relevant constraints are available.
_Avoid_: Dead empty slot, constraint-only affordance

**Next-Part Question**:
The canonical user question for the product: what part can be added next to the current build, and what risk does each candidate introduce?
_Avoid_: Final verdict, best build question

**URL Build State**:
The serialized representation of the active product state in URL parameters so a build and its surrounding UI state can be restored and shared directly.
_Avoid_: Hidden session state, opaque blob

**Role Slot**:
A named build position such as `case`, `gpu`, `cooler`, or `psu` used to organize selected parts in the **Build Configuration** and its URL form.
_Avoid_: Generic part bucket, unordered param key

**Single-Selection Slot**:
A v1 rule that each **Role Slot** may hold at most one selected part at a time.
_Avoid_: Multi-select slot, repeated live slot values

**Canonical Slot Name**:
The public name for a **Role Slot**, which should match the underlying database kind name.
_Avoid_: UI alias, renamed URL slot

**Selectable Slot Set**:
The closed list of **Role Slots** that may appear in a v1 **Build Configuration**: `case`, `gpu`, `psu`, `cpu-cooler`, `motherboard`, and `ram`.
_Avoid_: Open-ended slot list, implicit slot support

**Mutable Build State**:
A product rule that the user may add, replace, or clear any selected **Role Slot** at any time.
_Avoid_: Locked build step, irreversible flow

**Full Re-evaluation**:
A product rule that any change to the **Build Configuration** immediately recomputes the fitment state across the whole build.
_Avoid_: Partial refresh, stale slot status

**Unresolved Slot**:
A **Role Slot** whose value is present in the **URL Build State** but cannot be loaded from the current catalog, and must remain visible with an explanation instead of being silently dropped.
_Avoid_: Discarded param, invisible error

**Replayable View State**:
The shareable UI context around a build, including filters, search, sort, focused views, and selected parts, so another user can open the same URL and see the same experience.
_Avoid_: Local-only UI state, non-shareable session

**Stable Query State**:
A human-readable and durable URL parameter contract for the product state, intended for sharing, debugging, and long-lived links.
_Avoid_: Encoded blob, opaque state token

**Public Query Contract**:
The rule that query parameter names and meanings are part of the public product interface and should not be renamed casually once shared links exist.
_Avoid_: Internal-only param naming, disposable URL shape

**Canonical Build Route**:
The dedicated route `/build` that hosts the stateful fitment experience and its shareable query state.
_Avoid_: Homepage-only tool route, ambiguous entry path

**Root Route**:
The root route `/` which rewrites to `/build`, making the builder the primary experience. The root may be revisited as a thin landing page in the future if needed.
_Avoid_: Separate homepage app surface

**Filter Table View**:
The primary `/build` interface: a data table of candidate parts controlled by URL-backed filters, selected slots, search, and sort state.
_Avoid_: Wizard pane, single-path flow

**Table Kind Filter**:
The URL-backed control that sets which part kind the main candidate table is currently showing, such as `case`, `gpu`, or `psu`.
_Avoid_: Mixed-kind table, hidden mode switch

**Kind Defaulting Rule**:
The rule that the initial `Table Kind Filter` may be inferred from the current build state, but any explicit user change becomes the active URL-backed choice.
_Avoid_: Constant auto-snapping, ignored user selection

**Selected Build Panel**:
A persistent sidebar or panel that lists the currently selected parts, keeps them visible regardless of the table kind, and surfaces slot-specific issues, constraints, and fitment context.
_Avoid_: Vanishing selections, table-only build state

**Part Issue List**:
The list of findings shown inside each selected part’s card in the **Selected Build Panel** — the warnings and errors that part owns, including ones the user has ignored. Findings stay on the part they belong to rather than moving to a separate build-wide panel.
_Avoid_: Separate build-wide issue section, auto-cleared problem parts, hidden findings

**Slot-Grouped Issues**:
The rule that findings are organized by selected **Role Slot** rather than by generic issue category, so each part card shows what the engine says about that part.
_Avoid_: Mixed global issue pile, type-first grouping

**Finding Ownership**:
The rule that every finding belongs to exactly one selected part — the part whose own data the finding is about — and is listed only on that part’s **Part Issue List**. A case condition (sandwich layout mode, riser requirement, unvalidated PSU support) belongs to the case; a measurement under comparison (GPU length, cooler height, RAM height, PSU form factor) belongs to the part being measured. Because a card’s verdict still reflects the whole relationship, a part can show `conditional` or `fail` while its own list is empty because the partner part owns the cause.
_Avoid_: The same warning on every card, ambiguous shared blame, hidden cross-slot dependency

**Open Constraint**:
A known limit or requirement inferred from the current build for an unfilled slot, such as maximum GPU length, cooler height, PSU form factor, or slot count.
_Avoid_: Hidden dependency, implied-only rule

**Constraint Jump**:
An action in the **Selected Build Panel** that switches the main table to a relevant kind and pre-applies filters derived from the current **Open Constraints**.
_Avoid_: Manual re-entry, disconnected panel action

**Editable Derived Filter**:
A filter pre-applied by a **Constraint Jump** that remains fully editable or removable by the user.
_Avoid_: Locked recommendation filter, forced constraint mode

**Constraint Overlay**:
A visual treatment inside a filter control that shows the physical boundary implied by the current build, including hard-fail regions and conditional caution zones.
_Avoid_: Hidden envelope, text-only limit cue

**Clearance Allocation**:
The GPU-side and CPU-cooler-side space split in a sandwich case. With the current catalog fields, its shared cross-section is the case's maximum GPU width plus its maximum CPU cooler height. A selected GPU consumes its actual GPU width and leaves the remainder for the CPU cooler; a selected CPU cooler consumes its actual height and leaves the remainder for the GPU.
_Avoid_: Independent maxima that are simultaneously assumed, unexplained generic layout warning

**Verdict Row State**:
The visual treatment of a candidate row in the table based on its fitment outcome, such as neutral for `pass`, amber for `conditional`, and red for `fail`.
_Avoid_: Uniform rows, hidden risk state

**Fitment-First Sort**:
The default table ordering that prioritizes clearer fitment outcomes, such as `pass` before `conditional` before `fail`, before applying stable secondary sorts.
_Avoid_: Random default order, implicit overall recommendation

**Column-Level Evidence Highlight**:
A table treatment where the overall row shows a light verdict state, while the specific failing or cautionary metric or caveat cell is emphasized more strongly.
_Avoid_: Row-only verdict, detached explanation text

**Direct Table Selection**:
The primary interaction where a candidate row can be selected straight from the table into its matching **Role Slot** without requiring a separate details step.
_Avoid_: Forced modal drill-down, detail-first selection flow

**Immediate Slot Replacement**:
The rule that selecting a candidate from the table immediately fills or replaces the matching **Role Slot** and triggers a new evaluation.
_Avoid_: Confirmation gate, staged replacement flow

**Local Slot Clear**:
The rule that removing a selected part clears only that **Role Slot**, while preserving the rest of the URL-backed view state.
_Avoid_: Cascading reset, surprise filter wipe

**Type-Specific Table Schema**:
The rule that each table kind uses its own column set and evidence layout based on the metrics that matter for that part type.
_Avoid_: One generic sparse table, lowest-common-denominator columns

**Kind-Specific Filter Set**:
The rule that each table kind has its own relevant URL-backed filters based on the attributes that matter for that part type.
_Avoid_: One universal filter model, irrelevant shared controls

**Shared Filter Control**:
A filter that remains visible across multiple table kinds because it applies broadly, such as search or sort.
_Avoid_: Kind-only control masquerading as universal

**Sparse Row Visibility**:
The URL-backed control that determines whether the table includes catalog rows with no fitment-relevant metric data. Sparse rows are hidden by default to keep the fitment table evidence-focused, and `show-sparse=1` restores them for full catalog auditing.
_Avoid_: Permanently discarding sparse imports, confusing sparse rows with `conditional` fitment uncertainty

**Always-Visible Verdicts**:
The rule that the table keeps `pass`, `conditional`, and `fail` rows visible together, relying on sort and visual state rather than a separate visibility toggle.
_Avoid_: Hidden verdict mode, filtered-away fitment state

**Kind-Scoped Search**:
The rule that `search` is a text filter applied within the current `Table Kind Filter`, while `kind` remains the controlling type filter.
_Avoid_: Auto-jumping kind, search-overrides-kind behavior

**Full Result Set**:
The table renders the entire filtered result set in one virtualized list; there is no pagination and no `page` URL parameter. Only rows near the viewport exist in the DOM, so a shared link always shows every matching row from the top.
_Avoid_: Paginated slices, page-index URL state, "load more" stepping

**Kind Filter Cleanup**:
The rule that when the table `kind` changes, kind-specific filters that no longer apply are removed from URL state while shared filters and selected parts remain.
_Avoid_: Dead filter params, misleading stale URL state

**Ignored Warning**:
A non-`fail` finding the user has explicitly set aside after verifying it themselves — for example a sandwich-layout caveat once they have confirmed the slot mode, or a riser advisory once they have the cable. An ignored warning stops counting toward slot and build verdicts, but stays listed on its **Part Issue List** in an ignored state with a restore action, so a build never looks clean by accident.
_Avoid_: Deleted issue, silently suppressed warning, auto-corrected build

**Warning Ignore State**:
The browser-local record of **Ignored Warnings**, keyed by engine evidence code and persisted in browser storage. It applies to every build on that browser, never travels in the URL, and is the only scope an ignore has: there is no per-build or server-side suppression.
_Avoid_: Per-build dismissal, server-side suppression, expiring acknowledgement

**Warning Copy Map**:
The code-to-friendly-text map that gives each engine evidence code a stable short heading for issue rendering, with unmapped codes falling back to the engine message.
_Avoid_: Inline per-component warning text, copy duplicated between engine and UI

**Copyable Part List**:
The plain-text summary of the current **Build Configuration** that "Copy your build" puts on the clipboard: a title line carrying the **URL Build State**, one line per selected **Role Slot** in **Fixed Slot Order**, and a provenance line. It carries only what the **Component Catalog** knows — no prices, no parts the product does not model — and it is generated, never stored.
_Avoid_: Saved build, exported project file, catalog-wide shopping list

## Relationships

- The **Component Catalog** supplies the part records used by the **Fitment Engine**
- The **Fitment Engine** produces a **Fitment Decision** for a selected part, combination, or **Build Configuration**
- The **Fitment Engine** uses **Filter And Explain** instead of ranking parts by an implicit notion of "best"
- A **Build Configuration** narrows which records in the **Component Catalog** remain valid candidates for the next selection
- A **Candidate Part** is shown with its **Fitment Decision** and underlying **Fitment Evidence**
- **Non-Blocking Fitment** means even failing parts remain selectable when the user wants to inspect or accept the risk
- `fail` corresponds to a **Hard Conflict**, while `conditional` covers uncertainty or practical build risk
- Missing or incomplete data follows **Conditional Uncertainty**
- The current product scope is physical fitment first; **Adjacent Constraints** are secondary and should stay explicitly labeled
- A **Current View** is derived from one or more **Provenanced Claims** rather than flattening source disagreement into an untraceable fact
- **Contribution Intake** feeds future **Provenanced Claims**, but does not directly mutate the live **Current View**
- The primary interaction loop is the **Next-Part Question** asked against the current **Build Configuration**
- A **Build Configuration** is an unordered set of selected parts and constraints
- The active **Build Configuration** should round-trip through **URL Build State**
- **URL Build State** should use explicit **Role Slots** like `case=...` and `gpu=...` rather than opaque repeated part parameters
- In v1, each **Role Slot** is a **Single-Selection Slot**
- Each **Canonical Slot Name** should match the corresponding database kind name
- The v1 **Selectable Slot Set** is `case`, `gpu`, `psu`, `cpu-cooler`, `motherboard`, and `ram`
- `fan` and `reference` remain catalog kinds, not v1 **Role Slots**
- The **Build Configuration** is a **Mutable Build State** rather than a locked step-by-step flow
- Any change to the **Build Configuration** triggers **Full Re-evaluation**
- Invalid or stale URL part IDs should remain visible as an **Unresolved Slot**
- **URL Build State** should carry **Replayable View State** so a shared URL restores the same experience, not just the selected parts
- **URL Build State** should remain a **Stable Query State**
- **URL Build State** is a **Public Query Contract**
- The stateful fitment experience lives on the **Canonical Build Route** at `/build`
- The root route `/` rewrites to `/build`, keeping the builder as the primary experience. A thin landing page may be revisited later if needed.
- The primary `/build` surface is a **Filter Table View** powered by URL state
- The main candidate table is scoped by a **Table Kind Filter**
- The **Table Kind Filter** follows the **Kind Defaulting Rule**
- Selected parts remain in URL state and stay visible in a **Selected Build Panel** regardless of the current table kind
- The **Selected Build Panel** should surface **Open Constraints** for unfilled slots
- The **Selected Build Panel** should offer **Constraint Jumps** such as "View compatible GPUs"
- Selected parts remain selected even when their current fitment state is `conditional` or `fail`
- Current build errors, warnings, and caveats should appear on each selected part’s **Part Issue List**
- The **Part Issue List** should use **Slot-Grouped Issues**
- Every finding follows **Finding Ownership**: it is listed on the one part whose data caused it
- Filters created by a **Constraint Jump** are **Editable Derived Filters**
- Physical limits from the current build should appear in filter controls through a **Constraint Overlay**
- Candidate rows should communicate fitment outcome through **Verdict Row State**
- The default table ordering should use **Fitment-First Sort**
- The table should use **Column-Level Evidence Highlight** so the exact failing metric is visible at scan speed
- Candidate rows should support **Direct Table Selection**
- **Direct Table Selection** uses **Immediate Slot Replacement**
- Removing a selected part should use **Local Slot Clear**
- Each `Table Kind Filter` should use a **Type-Specific Table Schema**
- Each `Table Kind Filter` should also use a **Kind-Specific Filter Set**
- Irrelevant kind-only filters should be hidden, while **Shared Filter Controls** remain visible
- In v1, `search` and `sort` are **Shared Filter Controls**
- **Sparse Row Visibility** defaults to hidden and is replayed with the `show-sparse=1` URL parameter when enabled
- Table verdict states follow **Always-Visible Verdicts**
- `search` follows **Kind-Scoped Search** inside the active table kind
- Table paging follows the **Full Result Set**
- Kind changes follow **Kind Filter Cleanup**
- V1 build selection follows **Catalog-Only Selection**
- Selected slots should store a **Catalog Record ID**
- V1 uses **Kind-Slot Equivalence**
- The **Selected Build Panel** should use **Fixed Slot Order**
- The **Selected Build Panel** should show **Visible Empty Slots**
- Each **Visible Empty Slot** should expose an **Empty Slot Action**
- An **Ignored Warning** is identified by engine evidence code, so the same warning is ignored wherever it appears
- Only `conditional` evidence can become an **Ignored Warning**; a `fail` **Hard Conflict** stays visible and cannot be ignored away
- An **Ignored Warning** is excluded from verdict computation but remains listed on its **Part Issue List** with a restore action
- **Ignored Warnings** live in the **Warning Ignore State** and are a browser-local preference, not part of **URL Build State**
- Each engine evidence code should have an entry in the **Warning Copy Map** for issue rendering
- The **Copyable Part List** is generated from the current **Build Configuration** and carries its **URL Build State**, so a pasted list still points back to the build

## Example dialogue

> **Dev:** "If the user searches for a GPU, are we mainly helping them browse the catalog?"
> **Domain expert:** "No, the **Component Catalog** is just the entry point. The product is the **Fitment Engine** because the real value is the **Fitment Decision** and the reasoning behind it."

> **Dev:** "Should the engine rank the best GPUs for a case?"
> **Domain expert:** "Not by default. We use **Filter And Explain** so builders can judge the tradeoffs themselves."

> **Dev:** "Is the engine just about case and GPU pairs?"
> **Domain expert:** "No. The engine evaluates a **Build Configuration** so a user can start from any selected part and keep narrowing the remaining valid choices."

> **Dev:** "If a cable bend or routing issue might make the build hard, do we block the part?"
> **Domain expert:** "No. **Non-Blocking Fitment** means we still show the **Candidate Part**, but we attach the relevant **Fitment Evidence** so the builder understands the risk."

> **Dev:** "When do we use `fail` instead of `conditional`?"
> **Domain expert:** "Use `fail` for a **Hard Conflict** in the known data. Use `conditional` when the issue is uncertainty, tolerance, or practical build risk."

> **Dev:** "Do missing dimensions need their own verdict like `unknown`?"
> **Domain expert:** "No. Use **Conditional Uncertainty** so incomplete data stays inside `conditional` rather than creating a fourth state."

> **Dev:** "Are we building full PC compatibility from day one?"
> **Domain expert:** "No. The core problem is physical fitment. **Adjacent Constraints** may appear later, but they should stay clearly separate from the main fitment model."

> **Dev:** "When spreadsheet data, vendor specs, and community notes disagree, do we pick one fact and overwrite the rest?"
> **Domain expert:** "No. We keep **Provenanced Claims** and derive a **Current View** explicitly so disagreement stays inspectable."

> **Dev:** "Can users edit component records directly in v1?"
> **Domain expert:** "No. V1 uses **Contribution Intake** through GitHub issues. Proposed changes are reviewed manually, then added back with provenance."

> **Dev:** "Can users enter custom one-off parts in v1?"
> **Domain expert:** "No. V1 uses **Catalog-Only Selection** so chosen build parts come from existing catalog records."

> **Dev:** "What exact identifier should a selected slot store in the URL?"
> **Domain expert:** "Use the concrete **Catalog Record ID**, not an abstract family identifier or database rowid."

> **Dev:** "When the table is on `gpu`, what slot does row selection write into?"
> **Domain expert:** "Use **Kind-Slot Equivalence**. In v1, the table kind and the destination slot are the same."

> **Dev:** "Should the selected-parts panel reorder itself based on what the user clicked first?"
> **Domain expert:** "No. Use **Fixed Slot Order** so the build panel stays stable and does not imply chronology."

> **Dev:** "If a slot is empty, should it disappear from the build panel?"
> **Domain expert:** "No. Keep it as a **Visible Empty Slot** so builders can still see the structure, constraints, and possible next actions."

> **Dev:** "Should empty slots only show an action when constraints exist?"
> **Domain expert:** "No. Each empty slot should always have an **Empty Slot Action**. When constraints exist, that action becomes a stronger compatibility jump."

> **Dev:** "What is the core question the product answers in one session?"
> **Domain expert:** "The **Next-Part Question**: what can I add next to this build, and what risk does each option introduce?"

> **Dev:** "Does the order a user picked parts become part of the model?"
> **Domain expert:** "No. A **Build Configuration** is unordered. The current state should be restorable from **URL Build State** like `/build?case=case123&gpu=gpu456`."

> **Dev:** "Should the URL encode a generic list of parts or named build roles?"
> **Domain expert:** "Use **Role Slots**. URLs should read like `/build?case=...&gpu=...&cooler=...&psu=...`."

> **Dev:** "Can a slot hold multiple selected parts in v1?"
> **Domain expert:** "No. In v1, each **Role Slot** is a **Single-Selection Slot**, even if that expands later."

> **Dev:** "Should URL slot names be friendlier than the database kinds?"
> **Domain expert:** "No. Use the **Canonical Slot Name** from the database so URLs, code, and data stay aligned."

> **Dev:** "Which slots are actually selectable in v1?"
> **Domain expert:** "Use the v1 **Selectable Slot Set**: `case`, `gpu`, `psu`, `cpu-cooler`, `motherboard`, and `ram`. Keep `fan` and `reference` out of the build state for now."

> **Dev:** "Once the user starts filling slots, do they have to follow a guided sequence?"
> **Domain expert:** "No. The **Build Configuration** is a **Mutable Build State**. Users can choose, replace, or clear any part whenever they want."

> **Dev:** "If the user changes one slot, do we only refresh that part of the UI?"
> **Domain expert:** "No. Use **Full Re-evaluation** so every slot and candidate view reflects the current build immediately."

> **Dev:** "What if a shared build URL references a part ID that no longer exists?"
> **Domain expert:** "Keep it visible as an **Unresolved Slot**. Explain that the part could not be loaded from the current catalog instead of silently removing it."

> **Dev:** "Should the URL only store selected parts, or the full UI state too?"
> **Domain expert:** "Store the full **Replayable View State**. A shared URL should reproduce the same filters, search, sort, chosen parts, and overall experience."

> **Dev:** "Can we compress the URL state into an encoded blob?"
> **Domain expert:** "No. Keep it as **Stable Query State** so it stays human-readable and durable."

> **Dev:** "Can we rename query params whenever the UI changes?"
> **Domain expert:** "No. The URL is a **Public Query Contract**, so parameter names and meanings should stay stable once links are in the wild."

> **Dev:** "Where does the real build experience live?"
> **Domain expert:** "On the **Canonical Build Route** at `/build`, where the full shareable fitment state belongs."

> **Dev:** "What does the root route `/` do?"
> **Domain expert:** "It rewrites to `/build`, so the builder experience is the primary entry point. A thin landing page may be revisited later if it makes sense."

> **Dev:** "Is `/build` mainly a single active-slot picker?"
> **Domain expert:** "No. The primary interface is a **Filter Table View** powered by URL state, with build selections and filters shaping the candidate table."

> **Dev:** "How does the user switch between cases, GPUs, PSUs, and other part types?"
> **Domain expert:** "Use a **Table Kind Filter**. Changing it updates the table so it only shows candidate parts of that selected kind."

> **Dev:** "Should the table kind keep auto-switching based on what the app thinks is next?"
> **Domain expert:** "Only on first load if needed. After that, the **Kind Defaulting Rule** applies: an explicit user choice wins and stays in URL state."

> **Dev:** "If the table is showing PSUs, do the selected case and GPU disappear from view?"
> **Domain expert:** "No. The selected parts stay in URL state and remain visible in a **Selected Build Panel**, along with issues and constraints like supported GPU clearance."

> **Dev:** "If a selected part becomes conditional or failing, do we clear it from the build?"
> **Domain expert:** "No. It remains selected, and the resulting errors or caveats appear on that part's **Part Issue List**."

> **Dev:** "Should the issues list be grouped by error type or by selected part?"
> **Domain expert:** "Use **Slot-Grouped Issues** so builders can see what is wrong with each selected slot directly."

> **Dev:** "If a problem involves both the case and the GPU, do we show it on both cards?"
> **Domain expert:** "No. **Finding Ownership** puts it on the one part whose data caused it — sandwich mode and riser requirements belong to the case, lengths and heights belong to the part being measured. The other card keeps the verdict it earns from the relationship."

> **Dev:** "If the selected case defines a GPU envelope, does the user have to re-enter those limits manually in the table?"
> **Domain expert:** "No. Show those as **Open Constraints** and provide a **Constraint Jump** like 'View compatible GPUs' that switches the table to `gpu` and pre-applies the derived filters."

> **Dev:** "Once a constraint jump applies those filters, are they locked?"
> **Domain expert:** "No. They are **Editable Derived Filters**. The user can loosen or remove them at any time."

> **Dev:** "How should the UI show the difference between a physical limit and a filter value?"
> **Domain expert:** "Use a **Constraint Overlay** inside the filter control itself, such as coloring the invalid side of a range red and showing caution zones separately, so the physical boundary stays visible while filters remain editable."

> **Dev:** "If the user widens the filters into risky or impossible territory, do those rows disappear?"
> **Domain expert:** "No. Keep them in the table and show their state through **Verdict Row State**, such as amber for `conditional` and red for `fail`."

> **Dev:** "Should the table sort neutrally by name, or put the clearest fits first?"
> **Domain expert:** "Use **Fitment-First Sort** by default. That improves scanning without turning the product into a recommendation engine."

> **Dev:** "Should a failing row just be red, or should the specific bad metric stand out too?"
> **Domain expert:** "Use **Column-Level Evidence Highlight**. The row can carry a light red or amber state, while the actual failing column, such as GPU length, gets a stronger emphasis."

> **Dev:** "Can that highlight only apply to numeric thresholds?"
> **Domain expert:** "No. **Column-Level Evidence Highlight** should work for both measurable metrics and caveat/status fields like riser mode, routing concerns, or missing data."

> **Dev:** "Do users need to open a detail view before choosing a row?"
> **Domain expert:** "No. Use **Direct Table Selection** so the main build workflow stays fast and table-driven."

> **Dev:** "If a slot already has a selected part, do we ask for confirmation before replacing it?"
> **Domain expert:** "No. Use **Immediate Slot Replacement** so slot changes stay fast, reversible, and consistent with full re-evaluation."

> **Dev:** "When a selected part is removed, do we reset the rest of the current table state too?"
> **Domain expert:** "No. Use **Local Slot Clear** so only that slot is cleared while the rest of the URL-backed state remains intact."

> **Dev:** "Should every part kind share one generic table layout?"
> **Domain expert:** "No. Use a **Type-Specific Table Schema** so each kind shows the metrics and evidence that actually matter for that part type."

> **Dev:** "Do those schema differences also affect filters, or only columns?"
> **Domain expert:** "They affect filters too. Each kind should have a **Kind-Specific Filter Set** in URL state."

> **Dev:** "Should irrelevant filters stay on screen disabled when the table kind changes?"
> **Domain expert:** "No. Hide irrelevant kind-only filters and keep only **Shared Filter Controls** visible across kinds."

> **Dev:** "Which filters are definitely shared across kinds?"
> **Domain expert:** "In v1, treat `search` and `sort` as **Shared Filter Controls**."

> **Dev:** "Should the table hide some verdict states by default?"
> **Domain expert:** "No. Use **Always-Visible Verdicts** and let sorting plus row state present the clearest fits first."

> **Dev:** "If the URL says `kind=gpu`, can search silently switch the table to cases?"
> **Domain expert:** "No. Use **Kind-Scoped Search**. `kind` is the type filter, and `search` narrows rows within that kind."

> **Dev:** "Should a shared URL reopen the table at a particular page?"
> **Domain expert:** "No. Use the **Full Result Set**: the URL carries the filters, and the table always shows every matching row from the top of one virtualized list."

> **Dev:** "If the user switches the table from GPUs to cases, do old GPU-only filters stay in the URL?"
> **Domain expert:** "No. Use **Kind Filter Cleanup** so irrelevant kind-specific filters are removed while shared filters and selected parts stay intact."

> **Dev:** "The user checked their sandwich case and knows the slot mode is fine. Does the warning have to stay amber forever?"
> **Domain expert:** "No. Let them turn it into an **Ignored Warning**. The verdict clears, and the issue stays listed with a restore action."

> **Dev:** "Should an always-ignored warning travel with a shared build link?"
> **Domain expert:** "No. An **Ignored Warning** lives in the browser-local **Warning Ignore State** and never enters **URL Build State**."

> **Dev:** "Can the user ignore a `fail` the same way?"
> **Domain expert:** "No. A **Hard Conflict** is a known physical constraint, so only `conditional` evidence can be ignored."

> **Dev:** "Where does the text for a warning live?"
> **Domain expert:** "The engine owns the code and the detailed sentence. The **Warning Copy Map** owns the short heading rendered in the issue list, so copy can change without touching fitment rules."

## Flagged ambiguities

- "search" was used as if it were the product itself; resolved: search is an entry path into the **Component Catalog**, not the core product.
- "best components" was used to imply ranking; resolved: the current product uses **Filter And Explain**, not recommendations.
- "pair" was too narrow for the intended scope; resolved: the engine evaluates a **Build Configuration** across all relevant PC parts.
- "filtered recommendations" implied the system would choose for the user; resolved: the system returns **Candidate Parts** with **Fitment Decisions** and **Fitment Evidence**.
- "`fail` could have mixed hard constraints with softer risk; resolved: `fail` means **Hard Conflict**, while risk and uncertainty stay `conditional`."
- "missing data" could have become a fourth verdict; resolved: incomplete data uses **Conditional Uncertainty** inside `conditional`.
- "compatibility" could have expanded into a general PC builder; resolved: the current scope is physical fitment first, with **Adjacent Constraints** kept secondary.
- "source disagreement" could have been silently normalized away; resolved: the model keeps **Provenanced Claims** and derives a **Current View**.
- "wiki-style edits" was too broad for v1; resolved: v1 uses **Contribution Intake** via GitHub issues, with manual review before the **Current View** changes.
- "is this build compatible?" was too binary for the product loop; resolved: the canonical interaction is the **Next-Part Question**.
- "build flow" could have implied chronology mattered; resolved: the **Build Configuration** is unordered and serialized as **URL Build State**.
- "URL state" could have drifted into generic repeated part params; resolved: v1 uses explicit **Role Slots**.
- "slot state" could have expanded into multi-select too early; resolved: v1 uses **Single-Selection Slots**.
- "slot naming" could have drifted away from the schema; resolved: each **Canonical Slot Name** matches the database kind name.
- "supported slots" could have stayed fuzzy; resolved: v1 uses a closed **Selectable Slot Set**, while `fan` and `reference` stay out of build state.
- "next part" could have implied a locked wizard; resolved: the build is a **Mutable Build State** and any slot can change at any time.
- "slot edits" could have left stale results behind; resolved: every build change triggers **Full Re-evaluation**.
- "invalid URL state" could have been silently discarded; resolved: stale or unknown IDs remain visible as an **Unresolved Slot**.
- "URL state" could have been limited to build IDs only; resolved: v1 shares full **Replayable View State** through the URL.
- "shareable state" could have become opaque; resolved: URL parameters remain **Stable Query State**.
- "query params" could have been treated as internal details; resolved: the URL shape is a **Public Query Contract**.
- "the homepage" could have become the permanent stateful app surface; resolved: the canonical fitment experience lives at the **Canonical Build Route** `/build`.
- "current code shape" conflicted with the intended product model; resolved: `/build` is the real app, and `/` rewrites to it.
- "next-part UI" could have implied a slot-by-slot wizard; resolved: `/build` is a **Filter Table View** driven by URL state.
- "table scope" could have mixed multiple part kinds at once; resolved: the main table is controlled by a **Table Kind Filter**.
- "smart defaults" could have overridden the user repeatedly; resolved: the **Kind Defaulting Rule** allows inferred first load defaults, then respects explicit user choice.
- "table filtering" could have hidden the actual build; resolved: selections persist in URL state and remain visible in a **Selected Build Panel**.
- "constraints" could have remained passive notes; resolved: the panel shows **Open Constraints** and supports **Constraint Jumps** back into the table.
- "selected failures" could have been auto-corrected away; resolved: selected parts remain, and problems are aggregated on each part's **Part Issue List**.
- "issue summaries" could have become a mixed global pile; resolved: findings use **Slot-Grouped Issues** on the part they belong to.
- "a separate issues panel" duplicated what the part cards already show; resolved: findings render on the **Part Issue List** instead of a build-wide section.
- "cross-slot issues" could have been duplicated on every implicated card; resolved: **Finding Ownership** attributes each finding to the single part whose data caused it.
- "derived filters" could have become hidden locks; resolved: **Constraint Jumps** create **Editable Derived Filters**.
- "constraints versus filters" could have been expressed only as labels; resolved: physical limits should be shown directly in controls via a **Constraint Overlay**.
- "control overlays" could have shown only one threshold; resolved: **Constraint Overlays** should represent both hard-fail boundaries and conditional caution zones.
- "risky rows" could have been hidden after filter widening; resolved: the table keeps them visible and marks them with **Verdict Row State**.
- "default sorting" could have implied recommendation logic; resolved: the table uses **Fitment-First Sort**, not a global best-part ranking.
- "row explanations" could have relied only on prose; resolved: the table uses **Column-Level Evidence Highlight** to show exactly which metric is failing or risky.
- "evidence highlighting" could have been limited to numeric cells; resolved: **Column-Level Evidence Highlight** applies to both metric and caveat/status cells.
- "selection flow" could have required a details detour; resolved: the main interaction uses **Direct Table Selection**.
- "slot replacement" could have introduced confirmation friction; resolved: table selection uses **Immediate Slot Replacement**.
- "slot clearing" could have caused broad resets; resolved: removal uses **Local Slot Clear** and preserves the rest of the URL state.
- "table design" could have collapsed into one generic schema; resolved: each part kind uses a **Type-Specific Table Schema**.
- "filter design" could have collapsed into one generic set; resolved: each part kind uses a **Kind-Specific Filter Set**.
- "inactive filters" could have cluttered the UI; resolved: kind-only filters hide when irrelevant, while **Shared Filter Controls** persist.
- "shared filters" could have stayed vague; resolved: v1 shares `search` and `sort` across kinds.
- "verdict visibility" could have added an unnecessary mode; resolved: use **Always-Visible Verdicts** with fitment-first sorting.
- "search" could have overridden the current table kind; resolved: use **Kind-Scoped Search** where `kind` remains authoritative.
- "pagination" could have been kept as page-index URL state; resolved: use the **Full Result Set**, since a virtualized list makes page slicing unnecessary.
- "kind switches" could have left dead filter params behind; resolved: use **Kind Filter Cleanup** for kind-specific URL filters.
- "custom parts" could have introduced a second selection model in v1; resolved: use **Catalog-Only Selection**.
- "part identity" could have drifted toward abstract family IDs; resolved: selected slots store the concrete **Catalog Record ID**.
- "row selection target" could have required a second control; resolved: v1 uses **Kind-Slot Equivalence**.
- "panel order" could have drifted with interaction history; resolved: the **Selected Build Panel** uses **Fixed Slot Order**.
- "empty slots" could have vanished from the panel; resolved: the **Selected Build Panel** shows **Visible Empty Slots**.
- "empty slot actions" could have appeared only when constraints existed; resolved: every empty slot has an **Empty Slot Action**.
- "dismissing a warning" could have deleted the issue outright; resolved: an **Ignored Warning** stops affecting the verdict but stays listed on the **Part Issue List** with a restore action.
- "ignore once versus ignore always" split one outcome into two controls; resolved: a single ignore writes to the **Warning Ignore State**, and every ignored row can be restored.
- "always ignore" could have been stored per build or per selected part; resolved: the **Warning Ignore State** keys ignore state to the engine evidence code, so it follows the condition across builds.
- "ignoring a failure" could have hidden a **Hard Conflict**; resolved: only `conditional` evidence can be ignored.
