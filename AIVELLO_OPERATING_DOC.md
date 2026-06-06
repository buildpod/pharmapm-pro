# AIVELLO_OPERATING_DOC.md

**Project:** AivelloStudio RIM — pharma project management tool
**Owner:** Vineet Pathak
**Started:** Apr 2026
**Last updated:** May 11, 2026

---

> **HOW TO USE THIS DOCUMENT (read this first, every session)**
>
> This is the single source of truth for what we are building, what has been decided, and what comes next.
>
> When Vineet says **"refer to AIVELLO_OPERATING_DOC"**, Claude must:
>
> 1. Read this document end to end before doing anything else.
> 2. Identify the **Current Module** in section 4.
> 3. Confirm with Vineet what the goal of this session is. If it is anything other than what is stated as Current Module, stop and ask. Do not begin work on a new module without updating section 4 first.
> 4. Stay strictly within scope. Anything new goes into section 7 (Backlog), not into the current session.
> 5. End the session by updating sections 5 (Last Session Log) and 4 (Current Module → Next Module).
>
> If Claude proposes building anything not listed in this document, Vineet should reply **"check the operating doc"**, and Claude must stop and re-read it.

---

## 1 — What we are building

A modern, modular project management tool for pharma/biotech regulated system implementations.

**It must:**
- Run as a deployable single-tenant app (each customer or deployment = one workspace)
- Be portable across local browser, customer-hosted, and we-hosted modes
- Look enterprise-grade — comparable to Linear, Stripe Dashboard, Vercel — not naive
- Reuse the proven v1 domain logic (scheduling, dependency engine, settings, document workflow)
- Replace the v1 vanilla-JS UI layer with React + shadcn/ui + Tailwind + TypeScript

**It is NOT:**
- A multi-tenant SaaS (rejected in ADR-001)
- A new product built from scratch — it is a UI rewrite of the existing v1 logic
- A backend project (database/auth comes later, not now)
- An Excel template (that was the original PROD-002 path; we have moved past it)

---

## 2 — What is already built (v1, deployed and working)

**URL:** `https://buildpod.github.io/pharmapm-pro/`
**Repo:** `github.com/buildpod/pharmapm-pro`
**State:** 305 tests passing, deployed, functioning

**What v1 has that the rewrite must preserve:**
- Schema definitions (projects, milestones, tasks, risks, documents, costs)
- Dependency engine (FS dependencies + lag, cascade preview, backward scheduling, lockDate)
- Working days + holidays calendar with country presets (15 countries × 2 years)
- Document review/approval workflow (currently with comma-string limitation — see section 6)
- Settings service, project service, view service, edit service
- 305 unit tests in `src/test/test.js`

**What v1 has that the rewrite must improve:**
- Vanilla JS UI → must become React + shadcn
- Comma-separated reviewer/approver string → must become per-person decision rows
- Custom CSS → must become Tailwind + design tokens
- Plain HTML tables → must become a real data grid with pinned columns, density modes, proper density

**What v1 has that we are keeping as-is:**
- Hosted on GitHub Pages
- localStorage for persistence
- Mock/imported data, no backend yet
- Single-user, no auth

---

## 3 — Confirmed architectural decisions

These are locked. Do not re-debate without writing a new ADR.

| # | Decision | Why | When |
|---|---|---|---|
| ADR-001 | **Single-tenant deployable**, schema is tenant-aware so multi-tenant remains optional later | Pharma sales prefer isolated deployments; multi-tenant complexity unjustified for current scope | May 5, 2026 |
| ADR-002 | **Per-person decision rows for documents** (one DB row per reviewer/approver per cycle), not comma-separated strings | Pharma practice requires tracking each decision separately | May 5, 2026 |
| ADR-003 | **UI stack: Next.js (static export) + TypeScript + Tailwind + shadcn/ui + Lucide icons** | Industry standard for modern enterprise SaaS UI; ports cleanly to any backend later | May 6, 2026 |
| ADR-004 | **Hosting: GitHub Pages** for the rewrite (same as v1) | No new accounts needed; static export of Next.js works on Pages | May 6, 2026 |
| ADR-005 | **Keep v1 deployed and working** as reference; do not delete | v1 has real working features; useful as a comparison and as a fallback | May 6, 2026 |
| ADR-006 | **Mock data first, backend later** | UI quality is the current bottleneck, not persistence | May 6, 2026 |
| ADR-007 | **Reuse v1 domain logic verbatim** by porting the JS modules into the new repo's `domain/` folder | Logic is solid (305 tests pass); rewriting it would be wasted effort | May 6, 2026 |
| ADR-008 | **Defer the `CascadeDisplay` separation layer.** Drawer rendering remains coupled to engine output; engine-error states use targeted callsite fallbacks (as in M20.7) rather than a formal display-state abstraction. Re-evaluate if a future module introduces a third engine consumer beyond the two grids. | The seam (M20.7 surfaced it) is real but doesn't bite at our current scale — two callsites, both fixed inline. A `CascadeDisplay` layer would be ~150 lines of indirection for a benefit only the third consumer would feel. YAGNI applies. The decision can flip if M21+ needs another cascade-consuming surface (e.g. a SteerCo what-if simulator). | May 17, 2026 (M21-Checkpoint) |

---

## 4 — Current Module + Next Module

> This is the **only** part of the doc Claude updates without explicit Vineet input. Update at end of every session.

### Current Module

**Module:** M31 — Variance attribution (PT-6) + Anomaly rules (PT-7): pure domain modules
**Goal:** Two more pure `v2/lib/domain/` modules off the TRANSPARENCY_MODEL spec, extending the M30 EVM engine. PT-6 decomposes a cost variance into rate / volume / scope (the CFO "bridge" waterfall, spec §4). PT-7 is the 8-rule anomaly engine (spec §5) — heuristic, no ML, each a computable threshold over EVM snapshots + history. Builder-domain role: pure functions, tests alongside, no UI/store.

**DoD:**
- `v2/lib/domain/variance.ts` — `rateVariance`, `volumeVariance`, `scopeVariance`, `attributeVariance` returning a bridge { total, rate, volume, scope, per-line detail }. Sign convention: positive = over budget (CFO mental model); documented vs EVM CV.
- `v2/lib/domain/variance.test.ts` — formula isolation + the spec's worked bridge example + zero/edge cases.
- `v2/lib/domain/anomaly.ts` — rules A1–A8 as pure evaluators over an `EvmSnapshot` + optional history (prior periods). Returns `AnomalyFlag[]` with rule id, severity, plain-language message, computed values.
- `v2/lib/domain/anomaly.test.ts` — each rule fires on its threshold, stays quiet below it, multi-period rules (A1, A4, A5, A6) tested with history.
- Build clean; all tests green; v1 stays 305/305.

**Out of scope:** CostBaseline entity/store (PT-1), UI surfaces (PT-9/10), AI-cost A8 wiring to real AgentRun data (rule defined; live data is M27 territory).

### Earlier Current Module — M30 EVM engine (shipped, commit `0e86956`)

**Module:** M30 — EVM engine (PT-3): pure domain module + test matrix
**Goal:** Build the Earned Value Management compute layer specified in `TRANSPARENCY_MODEL.md` (§2/§3) as a standalone, fully-tested pure-function module — the M20.4 cascade-engine pattern. No UI, no entity-store coupling yet; takes a baseline + items + status date, returns the full EVM snapshot. This is the algorithmic core every transparency surface will read from. Codex works the UX-audit presentation track in parallel.

**DoD:**
- `v2/lib/domain/evm.ts` — pure functions: `plannedValue`, `earnedValue`, `costVariance`, `scheduleVariance`, `cpi`, `spi`, EAC variants (1/2/3), `etc`, `vac`, `tcpi`, Earned Schedule (`earnedSchedule`, `svt`, `spit`), and a `computeEvm(input)` orchestrator returning the full snapshot + a `forecastRange`. Divide-by-zero guards throughout. Canonical formula names in comments for PMBOK/AACE cross-check.
- `v2/lib/domain/evm.test.ts` — ~25-30 cases: each formula in isolation, on-plan / over-budget / behind-schedule / ahead scenarios, EAC variant selection, Earned Schedule interpolation, TCPI unrecoverable signal, edge cases (zero AC, EV=BAC, empty curve).
- Build clean; all existing 133 tests still pass; new EVM tests green.
- B1 (linear PV curve) + B2 (per-workstream budgets) proceed on recommended defaults — engine is input-agnostic so both are swappable.

**Out of scope:** `CostBaseline` entity/store (PT-1, next), UI surfaces (PT-9/10), variance attribution (PT-6), anomaly engine (PT-7). Pure compute only this module.

### Earlier Current Module — M29 CALENDAR_INTEGRATION spec (shipped, commit `c91d5df`)

**Module:** M29 — Spec phase: `CALENDAR_INTEGRATION.md`
**Goal:** Third and final architectural spec. Lock how the product syncs meetings + availability with external calendars — EU-sovereignty-first (iCalendar / CalDAV open standards lead; M365 Graph + Google Calendar optional plugins). Includes the meeting→decision→task flow that closes the loop our Decisions register currently leaves open, and a per-member capacity/load view. Standards-stable (RFC 5545 iCalendar, RFC 4791 CalDAV); written directly, no synthesis round needed. No code this session.

**DoD:**
- `v2/docs/CALENDAR_INTEGRATION.md` (~280 lines): integration tiers (ICS export → ICS feed import → CalDAV two-way → M365/Google optional), data model (`MeetingSource`, `CalendarLink`, extended `RecurringMeeting`), meeting→decision→task flow, capacity/load view, sovereignty rationale (CADA), worked example, non-goals, punch list, open questions.
- Build clean; 133 tests pass (docs only).
- After M29, all three specs locked → implementation can begin.

**Out of scope:** implementation code; real OAuth wiring; the heuristic-audit findings (separate track via NotebookLM).

### Earlier Current Module — M28 TRANSPARENCY_MODEL spec (shipped, commit `0fa2850`)

**Module:** M28 — Spec phase: `TRANSPARENCY_MODEL.md`
**Goal:** Second of three architectural specs. Lock how the product computes and displays cost/schedule transparency to CFOs and CTOs — Earned Value Management, Earned Schedule, Forecast-at-Completion, variance attribution, decision-cost lineage, anomaly detection. Standards-grounded (PMBOK §7, AACE, Earned Schedule, SPC) so the implementation is auditable. Confirmed (NotebookLM + Codex review): NEITHER fork has any EVM today — both do backward-looking tallies only. This makes predictive forecasting a clean differentiator. No code this session.

**DoD:**
- `v2/docs/TRANSPARENCY_MODEL.md` (~450 lines): EVM formula set (PV/EV/AC/CV/SV/CPI/SPI/BAC/EAC variants/ETC/VAC/TCPI), Earned Schedule (ES/SV(t)/SPI(t)), variance attribution (rate/volume/scope decomposition), FAC with confidence ranges, anomaly-rule set (concrete thresholds, no ML), decision-cost lineage, the AI-cost forecasting tie-back to M27, what our entities have vs need, UI sketches, non-goals, punch list.
- Build clean; 133 tests pass (docs only).

**Out of scope:** implementation code; the third spec (CALENDAR_INTEGRATION); ML-based forecasting.

### Earlier Current Module — M27 AGENT_AS_RESOURCE spec (shipped, commits c9260b0 + f162bdc)

**Module:** M27 — Spec phase: `AGENT_AS_RESOURCE.md`
**Goal:** Before any more feature code, write the first of three architectural specs that lock how this product handles the dimensions a CTO/CFO actually care about. M27 = AI agents as first-class resources with full cost attribution. M28 = transparency model (variance attribution, FAC, decision-cost lineage). M29 = calendar integration (ICS / CalDAV / M365 / Google with EU-sovereignty-first). Each spec follows the M20.4 pattern: data model + lifecycle + worked example + open questions + punch list. No code this session.

**DoD:**
- `v2/docs/AGENT_AS_RESOURCE.md` (~400 lines, 8 sections):
  1. Why this matters (CTO/CFO transparency + AI-augmented enterprise + CADA sovereignty)
  2. Data model — `Resource.kind`, `AgentDefinition`, `AgentRun`, cost-line type extension, audit-log source extension
  3. Lifecycle — agent registration → task assignment → execution → cost capture → audit
  4. Cost attribution — token spend → project / workstream / task / module rollup
  5. UI surfaces (sketch only, no code) — Resources page, Tasks assignee picker, Costs page, audit log filter
  6. Worked example — exactly how Claude Code's work on M26.1 would have been logged
  7. Non-goals — what we explicitly aren't doing (auto-pricing, agent marketplace, etc.)
  8. Punch list — every implementation item the spec implies, ordered by dependency
- Build clean, all 133 tests still pass (no code changes; specs only).
- Operating doc §8 entry references the spec + the punch list. Subsequent modules pick items off the punch list.

**Out of scope:**
- Any implementation code — strictly docs
- The other two specs (TRANSPARENCY_MODEL, CALENDAR_INTEGRATION) — separate modules
- Pricing strategy / commercial model
- Cascade engine port from Codex (still queued, separate)

### Earlier Current Module — M26.1 Tasks page refactor (shipped, commit `21132f6`)

**Module:** M26.1 — Tasks page refactored to new design system
**Goal:** Second page in the design-system refactor (after M26 Dashboard). Apply the AivelloStudio design tokens to the Tasks page per `design/tasks-reference.html`. Visual chrome only — every handler, the cascade ImpactDrawer wiring, and the TaskFormDrawer wiring preserved verbatim.

**DoD:**
- `v2/app/styles/tasks.css` — tasks-specific patterns from the reference (toolbar, filter-chip, summary-strip, summary, tasks table, ws group, task row, priority pill, owner avatar, due column, progress, deps chips, footer).
- `tasks/page.tsx` — `.page-header` eyebrow + serif title + meta row.
- `tasks-grid.tsx` visual rewrite: workstream summary strip, filter-chip toolbar, `.tasks` table with collapsible `.ws` groups, 9-column `.task` rows.
- Cascade ImpactDrawer IIFE + TaskFormDrawer + all handlers unchanged.
- Build clean; 133 tests pass. Stop for review before M26.2 (Milestones).

**Out of scope:** other pages; topbar internals; cascade-drawer visual restyle.

### Earlier Current Module — M25 Decisions register (shipped, commit `42cd472`)

**Module:** M25 — Decisions register
**Goal:** Pharma regulatory audits literally request "show me the decision log" — currently we'd reconstruct from meeting minutes. M25 adds a Decisions register as a first-class entity that records the *what*, *when*, *who*, *alternatives considered*, *rationale*, and *what it supersedes*. Mirrors the M24 Issues pattern (cross-entity-parity skill); completes the Risks + Issues + Decisions trio.

**DoD:**
- **New `DecisionRecord` entity** in `lib/mockData.ts` 1:N with Project. Named `DecisionRecord` to avoid collision with existing `Decision` value type used for document RACI rows. Fields: `id` · `title` · `context` · `decidedDate` · `decidedBy` · `alternatives[]` · `chosenOption` · `rationale` · `status` (`Pending` | `Approved` | `Rejected` | `Superseded`) · `supersedesId?` · `linkedMilestoneId?` · `linkedRiskId?` · `linkedIssueId?` · `projectId`.
- **Seed 4–5 realistic decisions** for Veeva RIM (vendor pick, validation methodology, training delivery format, environment cutover window, etc.) — at least one Superseded to demonstrate the supersession chain.
- **Entity store slice** following M20.2 pattern + `LocalStorageRepository<DecisionRecord>` + `decision` added to `EntityKind`. Audit log captures every save.
- **`/decisions` route** with `DecisionsGrid` — flat table view, filter by status + decidedBy + Mine. Counts pill (Pending / Approved / Rejected / Superseded).
- **`DecisionFormDrawer`** following the Issue form pattern: required-field validation per `error-message-pattern` skill, list-of-strings field for alternatives, optional supersedes-link to a prior decision, optional linkage to milestone/risk/issue.
- **Sidebar nav**: new "Decisions" entry under DOCUMENTATION (next to Documents — semantically closer than RISK & FINANCE; Decisions are the audit record).
- **Tone discipline**: slate Pending · emerald Approved · rose Rejected · muted Superseded.
- **Plain language strings** per `ui-string-audit`.
- All 133 tests still pass. Build clean. `simplify` invoked on diff before commit.

**Out of scope:**
- Decisions Excel export sheet (M19 exporter extension — defer)
- Bi-directional supersession UI (clicking a superseded decision jumps to its replacement) — backlog
- Decision↔Risk impact analysis ("which decisions affect this risk")
- Assumptions register (4th RAID element) — separate module
- Audit-log signoff PDF generation — separate module
- Decision approval workflow (multi-signoff) — current model is single `decidedBy`

**Why this matters:** completes the Risks + Issues + Decisions trio that every pharma audit + SteerCo review expects. Together with Charter and existing surfaces, the product now covers PMBOK §4 (Integration), §6 (Schedule), §11 (Risk), §13 (Stakeholder), and the audit trails inspectors require.

**Started:** (this session)
**Status:** in progress

### M24 Completion summary (2026-05-18)

**Module:** M24 — Issues register
**Status:** ✅ Complete (commit `0fa3aae`)
**Outcome:** New `Issue` entity, lifecycle (Open → In Progress → Resolved / Won't Fix), severity-based prioritisation, optional milestone/task linkage, 5 realistic seed issues, full grid + form + sidebar nav + audit-log integration. Clean break from cascade arc; exercised cross-entity-parity skill against existing Risk pattern.

### M24 original goal/DoD (preserved for traceability)

**Module:** M24 — Issues register
**Goal:** PharmaPM Pro has Risks (potential future events) but no surface for tracking live problems — production-affecting situations a PM needs to resolve *now*. Every regulated-industry project (GxP, FDA, EMA) requires an issues log for inspection trails. M24 adds it as a first-class entity that mirrors the Risk pattern, with severity-based prioritisation, owner / resolution workflow, and dashboard surface. Clean break from cascade work; exercises `cross-entity-parity` skill.

**DoD:**
- **New `Issue` entity** in `lib/mockData.ts` 1:N with Project. Fields: `id` · `title` · `description` · `raisedDate` · `severity` (`Critical` | `High` | `Medium` | `Low`) · `status` (`Open` | `In Progress` | `Resolved` | `Won't Fix`) · `owner` (initials) · `resolutionPlan?` · `resolvedDate?` · `milestoneId?` · `taskId?` · `projectId`.
- **Seed Issues** for `proj-veeva-rim`: 4–5 realistic issues (vendor-side data quality blocker, environment provisioning slip, validation script defect, training-deck legal review awaiting, etc.).
- **Entity store slice** following the M20.2 pattern: `addIssue` / `updateIssue` / `deleteIssue` / `replaceAllIssues` + `LocalStorageRepository<Issue>` + `issue` added to `EntityKind`. Audit log captures every save.
- **`/issues` route** at `app/(app)/issues/page.tsx` with `IssuesGrid` component, project-scoped. Mirrors the Risks-grid shape.
- **`IssueFormDrawer`** following the Risk form pattern: required-field validation per `error-message-pattern` skill, conditional resolution-fields when status = Resolved.
- **Filter / sort** by severity + status + owner; counts pill (open / in progress / resolved).
- **Dashboard surface**: open-issues card next to risks/charter on the dashboard. Status colour: severity-driven (rose for Critical, amber for High, slate for resolved).
- **Sidebar nav**: new "Issues" entry under RISK & FINANCE (next to Risks).
- **Project validator extension**: add rule "open Critical issues unresolved within 7 working days" → flags on Project Health card.
- **Tone discipline**: severity-based (rose Critical, amber High, slate Medium/Low, emerald Resolved).
- **Plain language strings** per `ui-string-audit`.
- All 133 tests still pass. Build clean. `simplify` invoked on diff before commit.
- §8 entry uses `audit-log-compression` format.

**Out of scope (defer):**
- Issue → Risk linkage UI (Issue arose from a Risk realising — interesting but separate concern)
- Issue Excel export sheet (M19 exporter extension — defer to M24.1)
- Issue-to-milestone / task cascade impact (Issues don't cascade dates by design)
- RAID unified register view (Issues + Assumptions + Decisions aggregated) — defer to M-future
- Decisions register and Assumptions entity — separate modules
- Change Request workflow — separate module (M25 candidate)

**Why this matters:** every audit / inspection / SteerCo review asks "what issues are open?" Currently we'd have to manually list them from meeting notes or vendor emails. With M24 it's a queryable register with audit trail, severity, ownership. Closes a structural gap in the PMBOK §13 stakeholder/issue management coverage.

**Started:** (this session)
**Status:** in progress

### M23.1 Completion summary (2026-05-18)

**Module:** M23.1 — Dependency Resolution Workbench density (research-backed)
**Status:** ✅ Complete (commit `1e8ed60`)
**Outcome:** Three research-backed patterns (Shneiderman 1996 mantra) — loop overview line, search/filter/cross-workstream toggle, suggested-first split + compact rows + inline expansion. Pure UI changes, no engine. 133 pass / 4 skipped. After M23.1 Vineet called the cascade arc "in a loop" and paused to seek external validation (Codex on a fork at buildpod/pharmapm-command-center).

### M23.1 original goal/DoD (preserved for traceability)

**Module:** M23.1 — Dependency Resolution Workbench density (research-backed)
**Goal:** M23 Phase 1 works at 11 edges but doesn't scale to the 30–80 edges a real 200-task Veeva project would produce. Apply Shneiderman's "Overview → Zoom/Filter → Details on Demand" framework (1996, 8,000+ academic citations) plus proven industry patterns (Primavera P6 WBS grouping, NDepend cycle UX, Monday.com real-time impact) to deliver three concrete changes that scale the workbench. No engine changes; pure UI.

**DoD:**
- **Loop overview panel** (Shneiderman "Overview first") at the top — single horizontal text line showing the loop's shape (`T1 → T3 → T4 → … → T15 ⇢ T1`) with the closing back-edge visually distinct. Horizontally scrollable for very long chains.
- **Search + workstream filter + cross-workstream toggle** (Shneiderman "Zoom and Filter") — fuzzy match on task name / ID / workstream; dropdown to filter to one workstream; "Show only cross-workstream links" toggle that surfaces accidental boundary-crossings.
- **Suggested-first split + compact rows + inline expansion** (Shneiderman "Details on Demand") — back-edge stays as full card at top; other edges become single-line compact rows; click a row to expand inline with the three actions + note field.
- Empty-state when filters return zero rows: "No links match · clear filter to see all".
- All strings pass `ui-string-audit` (no jargon).
- Tone discipline: amber suggested-fix; neutral slate compact rows; no rose.
- 133+ tests still pass (UI-only changes). Build clean. `simplify` invoked on diff per CLAUDE.md.
- §8 entry cites the research backing (Shneiderman, Primavera, NDepend, Monday research) so future Claude understands the *why* of the design.

**Out of scope (per research-backed deferral):**
- Full node-link force-directed graph rendering — research shows clutter collapses user perception above ~50 nodes (Weber's law studies); heavy library; not scale-appropriate
- Adjacency matrix view (NDepend-style) — excellent at 1000+ edges but our scale doesn't warrant the learning curve. M24+ candidate.
- Edge bundling visual treatment — academic technique for >100 edges; premature
- Animated transitions between resolution steps — not in the top-cited research as essential
- Task dependency picker upgrade — separate surface (task edit form), separate module (M23.2)

**Started:** (this session)
**Status:** in progress

### M23 Completion summary (2026-05-17)

**Module:** M23 — Dependency Resolution Workbench (Phase 1)
**Status:** ✅ Complete (commit `467672e`)
**Outcome:** New `findCycleEdges` DFS-based algorithm + 7 unit tests. Data model sidecar fields `Task.parallelDeps` + `Task.depNotes`. Workbench UI with per-edge actions (parallel, remove, note). Drawer useMemo staleness fix. Plain-language strings throughout.

### M23 original goal/DoD (preserved for traceability)

**Module:** M23 — Dependency Resolution Workbench (Phase 1)
**Goal:** Replace the "Show 11 tasks in the loop" flat list with a real workbench surface. PMs facing dependency loops should see the full chain, understand each link in plain language, and resolve the loop with one click — without needing to know graph-theory terms like "cycle" or "back-edge." Introduces a new dependency type ("parallel") so PMs can reclassify links that don't truly need sequential blocking. Honors Vineet's "digital adoption ready" framing — every string is layman-readable.

**DoD:**
- **Algorithm** — `findCycleEdges(tasks)` in `lib/domain/scheduling.ts`. DFS with three-color marking returns `CycleInfo { edges: CycleEdge[]; taskIds: string[] }` or null. Edges in traversal order; last edge has `isBackEdge: true`. 6 new unit tests covering self-loop, 2-node, 11-node (real shape from screenshots), multiple cycles, cycle with tail, no cycle.
- **Data model (Option A — sidecar fields):**
  - `Task.parallelDeps?: string[]` — soft links, no FS enforcement, not part of cycle detection
  - `Task.depNotes?: Record<string, string>` — free-text PM notes per upstream link, keyed by upstream task id
- **Engine extension:**
  - `topoSortTasks` and `previewTaskCascade` and `findConstraintViolations` ignore `parallelDeps`
  - One new test verifies parallel deps don't cause cascade shifts or count toward cycle detection
- **Workbench UI** — extends `CalloutSection` with `cycleEdges` + per-edge action handlers:
  - Plain-language lead-in ("These tasks depend on each other in a way that loops back…")
  - Full chain visible by default — no disclosure hiding
  - Per-edge card: from-task name, "depends on", to-task name, workstreams; suggested-fix edge gets amber accent + "Suggested" pill
  - Three per-edge actions: **Change to parallel** (toggle), **Remove this link**, **Add note**
  - Notes inline (collapsed by default, expand to edit)
  - After any action: drawer recomputes via store update; if cycle resolved, normal cascade preview returns; toast confirms
- **Plain-language strings throughout** per `ui-string-audit` skill — no "cycle", "back-edge", "FS-rule", "edge", "graph" in any user-visible text
- **Tone** — amber workbench (partial-success), slate chips on parallel deps when shown elsewhere
- All skills applied at write-time. `simplify` invoked on diff before commit per CLAUDE.md discipline.
- 124+ tests still pass. Build clean. Bundle delta within budget.

**Out of scope (defer to M23.1 or later):**
- Per-edge inline cascade-impact preview ("changing this date shifts N tasks")
- Per-edge date override IN the workbench (relies on cascade preview that's blocked by the cycle)
- Full Veeva-style cross-entity document-association view per dependency (M24+ — per-task DAG)
- Migration to typed dependency array (Option B) — defer unless parallel deps become heavily used
- Multi-cycle proactive listing — algorithm finds one cycle at a time; recompute surfaces next without surprise

**Why this matters:** the cycle drawer is the worst-case path of the cascade engine, the one a PM encounters when data quality breaks down. Solving it well — with plain language and one-click resolution — is a competitive wedge. None of Asana / Monday / Smartsheet / MS Project / Primavera have inline cycle-resolution at this level of UX polish. This is the kind of detail that defines "digital adoption ready."

**Started:** (this session)
**Status:** in progress

### M22.2 Completion summary (2026-05-17)

**Module:** M22.2 — Architectural skill expansion
**Status:** ✅ Complete (commit `8125ba6`)
**Outcome:** Three new architectural skills (`save-flow-parity`, `pre-existing-state-distinction`, `cross-entity-parity`) added under `.claude/skills/`. README + CLAUDE.md updated with built-in skill discipline (`simplify` before architectural commits). 11 skills total across quality / efficiency / architectural categories.

### M22.2 original goal/DoD (preserved for traceability)

**Module:** M22.2 — Architectural skill expansion
**Goal:** M22.1's three bugs (form-save parity, pre-existing-state distinction, forecast variance) all evaded the current quality skills because those skills are surface-layer (strings / colors / errors). Add three architectural-layer skills that catch parity / state-distinction / cross-entity-consistency issues at write-time. Plus formalise use of the built-in `review` / `simplify` skills on architectural-module commits.

**DoD:**
- New skill `save-flow-parity` in `.claude/skills/` — fires when editing `*-grid.tsx` save handlers or `*-form.tsx` save flows. Forces the question "if inline edit on field X triggers behaviour Y, does the form-drawer save on field X also trigger Y?". Concrete grid/form pair inventory included.
- New skill `pre-existing-state-distinction` in `.claude/skills/` — fires when writing any guard / validator / detector that examines current state. Forces baseline-vs-hypothetical thinking. References PL-11 + M22.1 #2 as canonical failure cases.
- New skill `cross-entity-parity` in `.claude/skills/` — fires when changing behaviour on one entity surface. Forces the question "do the sibling entity surfaces (milestones, tasks, risks, documents, costs, etc.) need the parallel behaviour?". Includes a behavioural-feature matrix.
- `.claude/skills/README.md` updated — three new entries + a section on using the built-in `review` and `simplify` skills before commit on architectural modules.
- `CLAUDE.md` updated — pre-commit discipline: invoke `review` or `simplify` on the diff before any architectural-module commit (M-N feature modules, refactors, new entity types). Skip for pure copy / pure styling commits.
- All 124 tests still pass (no code changes outside docs / skills). Build clean.

**Out of scope:**
- Sub-agent architecture-review at commit time — interesting idea, but lower ROI than the three skills + built-in review use. Defer to M22.3 if needed.
- Authoring custom built-in-skill wrappers — use the existing ones as-is.
- Retroactive review of M22 / M22.1 commits — those are committed; learnings already captured.

**Started:** (this session)
**Status:** in progress

### M22.1 Completion summary (2026-05-17)

**Module:** M22.1 — Architectural-consistency hotfix (form save + cycle guard + forecast variance)
**Status:** ✅ Complete (commit `b9bd936`)
**Outcome:** Three bugs fixed (form-drawer cascade parity, pre-existing-cycle distinction in form guard, forecast variance toast). All follow patterns already in the codebase — no new types or engine changes. Honest skill assessment captured: current skills are surface-layer, can't catch architectural-consistency issues. M22.2 closes that gap.

### M22.1 original goal/DoD (preserved for traceability)

**Module:** M22.1 — Architectural-consistency hotfix (form save + cycle guard + forecast variance)
**Goal:** Vineet's M22 dogfood surfaced three architectural-consistency bugs the current quality skills couldn't catch: form-drawer saves bypass cascade preview (inconsistent with inline edits); task form cycle guard blocks legitimate saves when the cycle pre-exists in data (parallel to PL-11); forecast variance has no UX feedback. All three are tightly scoped follow-ups on existing patterns.

**DoD:**
- `milestones-grid.handleDrawerSave` routes planned-date changes through the cascade preview (same flow as inline `handlePlannedDateChange`). Non-cascade fields save immediately; planned-date change triggers the preview drawer.
- `task-form.tsx` cycle guard compares baseline vs hypothetical topo sort — only blocks if THIS edit introduces a cycle that wasn't there before. Pre-existing cycles in stale data no longer block legitimate edits (mirrors PL-11 semantics at the form layer).
- Forecast-date changes (inline AND form) emit `toast.info` with working-day variance when |variance| ≥ 14 working days. Plain-language: "Forecast variance +N working days · {name} now forecasts later than planned. Review or promote forecast to planned."
- 124 tests still pass. Build clean.
- §5.2 tech-debt: log the gap that current quality skills don't catch architectural-parity issues; flag M22.2 to add `save-flow-parity`, `pre-existing-state-distinction`, `cross-entity-parity` skills + start using the built-in `simplify` / `review` skills before commit on architectural modules.

**Out of scope:**
- Promote-forecast-to-planned action (own module — M23 cascade-from-forecast)
- Variance threshold settings UI (default 14 WD is fine)
- Milestone-form cycle prevention parity (single-predecessor model; cycles are rare via this path)
- The new architectural skills themselves — M22.2

**Started:** (this session)
**Status:** in progress

### M22 Completion summary (2026-05-17)

**Module:** M22 — Project Charter
**Status:** ✅ Complete (commit `2f2b570`)
**Outcome:** Charter entity type, 1:1 with Project; entity store slice + repository + audit log integration; /charter route with read view + edit drawer; CharterCard on Dashboard; sidebar nav entry under PLANNING. Quality skills applied throughout — slate/amber/emerald tones, no jargon, validated field errors with what/why/next.

### M22 original goal/DoD (preserved for traceability)

**Module:** M22 — Project Charter
**Goal:** Per PMBOK §4.1, every project starts with a Charter — the formal document authorising scope, objectives, sponsor, and approval. We've shipped 21 modules of execution surfaces (milestones, tasks, risks, docs, costs, etc.) without a Charter; that's backwards from how PM practice works. M22 lands the Charter as a first-class entity, with a dedicated page, a dashboard surface for status, and store + audit-log integration. Closes the "no charter, no anchor" gap before further feature work piles on.

**DoD:**
- New `Charter` entity type in `lib/mockData.ts`, 1:1 with `Project`. Fields: `purpose` · `objectives[]` · `inScope[]` · `outOfScope[]` · `successCriteria[]` · `assumptions[]` · `constraints[]` · `sponsor` · `projectManager` · `budgetSummary` · `status` (`draft` | `submitted` | `approved`) · `approvedDate` · `approvedBy` · `lastUpdated`.
- Seed Charter for `proj-veeva-rim` with realistic pharma RIM-implementation content.
- New entity store slice + `LocalStorageRepository<Charter>` per the M20.2 pattern. `addCharter` / `updateCharter` / `replaceAllCharters` actions. Audit log entries on every save.
- New `/charter` route at `app/(app)/charter/page.tsx`, project-scoped via the existing `useProject` context. If no charter exists for the active project, show an empty state with "Create charter" action.
- Read view + edit drawer pattern (same as `MilestoneFormDrawer` / `TaskFormDrawer`). Read view shows structured sections; edit drawer collects field updates.
- Dashboard card showing Charter status pill (Draft / Submitted / Approved), sponsor, target go-live (from project), last-updated date. Click → /charter.
- Sidebar nav: new entry under OVERVIEW (above Dashboard would be inverted; under PLANNING above Milestones makes sense — Charter is the planning anchor).
- All quality skills active. No "cascade" / "engine" / "entity" jargon in user strings. Tone discipline applied.
- Build clean, 124+ tests still pass. Bundle delta within budget. New tests for the validator + entity slice if time permits.

**Out of scope (defer to M22.1 or M23+):**
- Charter PDF export (Excel sheet in M19 exporter — defer to M22.1)
- Multi-version Charter history / change log
- Approval workflow with multi-signoff matrix
- Charter templates / preset content
- Sponsor signature collection UI
- Linking Charter changes to a Change Request (M23 territory)
- Milestone-form parallel cycle prevention (M21-Checkpoint deferred)

**Why this matters:** Per PMBOK §4.1, the Charter is the legal authorisation. SteerCo decisions reference it. Audit / regulatory reviews start with it. Shipping execution surfaces without a charter is shipping the body of a car without the chassis. M22 lands the chassis.

**Started:** (this session)
**Status:** in progress

### M21-DrawerRewrite Completion summary (2026-05-17)

**Module:** M21-DrawerRewrite — Cascade impact drawer information design pass
**Status:** ✅ Complete (commit `319b3c5`)
**Outcome:** New `callout` section kind + `Callout` sub-component. Cycle-error path rewritten as single amber callout (replaces dual-rendering). Toast strings, header copy, save-button label all per quality-skill conventions. First module landing with project skills active — skills caught jargon at write-time.

### M21-DrawerRewrite original goal/DoD (preserved for traceability)

**Module:** M21-DrawerRewrite — Cascade impact drawer information design pass
**Goal:** Vineet's M20.7 dogfood made the verdict clear: the cycle-state drawer is the worst surface in the product. Information density, developer jargon, tone-mismatch (all-rose for partial success), broken template literals, no clear next-step. M21-DrawerRewrite rewrites the drawer's information design end-to-end so PMs see a clean, enterprise-grade preview surface. This is also the first module landing with project skills active (ui-string-audit + tone-discipline + error-message-pattern) — every string and color gets audited at write-time.

**DoD:**
- New `callout` section kind in `ImpactDrawer` — single info card with title + body + collapsible item list + optional action button. Replaces the dual-rendering (warnings row + duplicate task rows) on cycle-error state.
- Cycle-error state uses callout with: amber tone, plain-language body, collapsed cycle-task list, "Open Tasks" action button. No timeline bars, no editable dates, no "← driven by" captions on cycle rows.
- Toast string rewrites per `error-message-pattern` skill: every cascade-adjacent toast follows what / why / next-step. `toast.warning` not `toast.error` on partial-success. No "cascade" / "engine" / "propagation" jargon in user strings.
- Drawer header copy cleanup. Apply button label: "Save" / "Save · N changes" / "Save (preview unavailable)" — drops "Apply edit" jargon, drops "shifts" in favor of "changes".
- Zero-row sections never render. Originator chip: slate by default, rose only when delta crosses critical-path or go-live.
- Both `tasks-grid` and `milestones-grid` get the cycle-error callout path (milestone cycles are rarer in practice but the surface is symmetric).
- All 124 tests still pass. Build clean. Bundle delta within budget.
- §8 entry uses audit-log-compression skill format (5 sections, capped).

**Out of scope (defer to M21.1 or M22):**
- "Show N more ▾" for sections >5 rows — useful but moderate effort
- Mini-Gantt or richer timeline visualisation — current bar is enough
- Animated transitions on recompute
- Mobile / narrow-viewport responsive
- Charter / WBS / RAID register — those are M22+ feature modules
- Milestone-form cycle prevention (parallel to task-form; defer until reported)

**Why this matters:** the cascade drawer is the single most-visible surface in the product. PMs see it every time they change a date. If it reads cheap, the whole product reads cheap. M21-DrawerRewrite is the closing UX pass on the cascade arc — after this, the drawer matches enterprise-grade information design standards.

**Started:** (this session)
**Status:** in progress

### M21-Checkpoint Completion summary (2026-05-17)

**Module:** M21-Checkpoint — Cascade arc retrospective + architectural audit
**Status:** ✅ Complete (commit `edcb72b`)
**Outcome:** Test coverage scan (124/4), tech-debt index refreshed (5 cleared, 4 pending, 4 new low-pri), task-form cycle prevention added (closes the creation path for the cycle that bit M20.7), ADR-008 added (defer CascadeDisplay separation), LEARNINGS.md anchored, competitive re-scan, M21 unlocked from clarity.

### M21-Checkpoint original goal/DoD (preserved for traceability)

**Module:** M21-Checkpoint — Cascade arc retrospective + architectural audit
**Goal:** Per §9.9, every 4 feature modules earns a checkpoint session — no new features, just verification and audit. M20.2 was the last; we're 5 modules overdue (M20.3 → M20.7). This checkpoint specifically closes the cascade arc cleanly so M21 starts from clarity, not from the cumulative scope of cascade-adjacent decisions.

**DoD:**
1. **Test coverage scan.** Verify the 122-test suite covers every spec section in `CASCADE_ALGORITHM.md`. Flag any spec sub-section that lacks at least one passing test. Add tests for the gaps if reasonable (≤30 min).
2. **Seed-data cycle cleanup.** Locate the dependency cycle in `lib/mockData.ts` that surfaced as the M20.7 trigger (T1 → T3 → ... → T15 → back to T1 somewhere). Remove the offending `dependsOn` reference. Verify with a fresh `findConstraintViolations` run on the seed.
3. **Tech-debt index review (§5.2).** Walk the table: which items are cleared, which are still open, which became less urgent post-cascade, which became more urgent. Update statuses; add any new items the cascade arc introduced.
4. **Competitive re-scan.** One short paragraph in §8: where does cascade now stand vs Monday / Smartsheet / Asana / MS Project / Primavera. What's our wedge, what's still missing, what's deliberately deferred.
5. **CascadeDisplay layer decision.** Decide explicitly: do we refactor the engine/drawer coupling now (its own M20.8 module) or defer until the seam bites a future module? Document the decision and rationale in §3 (ADR) or §8.
6. **LEARNINGS.md hygiene.** It slipped into M20.7's commit; re-evaluate placement, content, and whether it should be advertised more prominently (link from CLAUDE.md / operating doc) or stay quiet.
7. **M21 scope set.** Lock the next feature module in §4 (after this checkpoint). Most likely candidate per §5.1 is Charter or WBS or RAID register — one of them gets named with DoD + out-of-scope so M21 starts cleanly.
8. **All 122 tests still pass.** Build clean. No engine changes this session — checkpoint is audit, not feature.

**Out of scope (defer to M21 or beyond):**
- The CascadeDisplay refactor itself (this checkpoint only decides whether to do it)
- Any new cascade features (PL-5, PL-6, PL-9 still in punch list)
- Performance profiling of the cascade engine — not flagged as a problem
- Path C (Supabase) transition — infrastructure is ready; out of checkpoint scope

**Why this matters:** Vineet asked the design-quality question after M20.7. The right answer to "have we patched too much?" is to audit honestly, name what's solid + what's a real seam, and then move forward from a clean baseline. Checkpoints are how the discipline catches drift before it becomes architectural debt.

**Started:** (this session)
**Status:** in progress

### M20.7 Completion summary (2026-05-17)

**Module:** M20.7 — Cycle-resilient cascade UX (hotfix)
**Status:** ✅ Complete (commit `f8ef193`)
**Outcome:** Caller-side fix to tasks-grid `onApply` + drawer recompute. Pre-existing data cycles no longer block originator edits or break drawer rendering. PL-12 documented + tested. Engine unchanged.

### M20.7 original goal/DoD (preserved for traceability)

**Module:** M20.7 — Cycle-resilient cascade UX (hotfix)
**Goal:** Vineet's dogfood of M20.6 revealed a high-impact bug: when seed/persisted data has a dependency cycle (real case in our mock data: T1 → T3 → T4 → T5 → T6 → T7 → T8 → T13 → T14 → T15 → ...), every task save with deps got blocked entirely. The engine correctly detected the cycle but the caller short-circuited both the save AND the drawer rendering — so the polished M20.6 visual (timeline, grouping, ancestry) never appeared, the user's edit was silently dropped, and the only message was a red toast.

**DoD:**
- `tasks-grid.onApply` on engine error: still commit the originator edit (the user's explicit change). Skip cascade propagation. Surface as `toast.warning("Cascade skipped — cycle in dependency data")`, not `toast.error("Cannot apply cascade")`. Audit log note: `originator saved; cascade skipped due to cycle in data`.
- `tasks-grid` drawer recompute on engine error: in addition to the warnings row, parse the cycle members from the error message and render them as a `tasks` section ("Tasks in the cycle (dates unchanged)") with `ancestry: "in dependency cycle"`. This preserves the M20.6 visual polish even when the engine couldn't cascade.
- `ImpactDrawer`: detects `engine-error` row in any warnings section and renames Apply button to `"Apply edit (cascade skipped)"` to be honest about what's happening.
- New test `PL-12` in `scheduling.algorithm.test.ts` asserting the engine contract callers rely on: on cycle, `r.error` non-null, `r.affected` empty, `r.tasks` is a slice of input (caller responsible for overlaying the user's edit).
- `CASCADE_ALGORITHM.md` §10 punch list — PL-12 added as P0 ✅ Resolved with one-paragraph outcome.
- Operating doc §6 (Known issues being managed) — entry added about the cycle in seed data and that the engine fix unblocks usage regardless.
- Build clean. 121 → 122 tests pass.
- No engine changes — engine's cycle-detection contract was already correct. The bug was entirely on the caller side. Important for documentation: the cascade engine remains as M20.5 left it.

**Why this is hotfix-shaped not full module:**
- ~50 lines of code across 4 files (tasks-grid, impact-drawer, algorithm doc, test)
- No new types, no new behaviour modes, no UX research
- Discovered in dogfood of just-shipped M20.6; fastest path to unblock real usage

**Out of scope:**
- Breaking the cycle from inside the drawer (would need new UX — separate module)
- Auto-suggesting which `dependsOn` to remove (heuristic out)
- Cleaning the seed data (acknowledged in §6 but separate task)
- Milestone-side equivalent fix (different code path; milestone cycles are rarer in practice — defer until reported)

**Started:** (this session)
**Status:** in progress

### M20.6 Completion summary (2026-05-17)

**Module:** M20.6 — Cascade impact drawer UX polish
**Status:** ✅ Complete (commit `708fe33`)
**Outcome:** mini-timeline per row, workstream/phase grouping (collapsible), ancestry trace for transitive milestone shifts, apply-count semantics fix. 121 pass / 4 skipped. `/tasks` 7.31 kB.

### M20.6 original goal/DoD (preserved for traceability)

**Module:** M20.6 — Cascade impact drawer UX polish
**Goal:** Engine is now PMBOK-correct (M20.4 + M20.5). The drawer's information design still reads as functional rather than as the enterprise PM tool we're competing against. Four targeted improvements turn it from "works" to "feels expensive". No engine changes this session — pure UI on top of M20.5 output.

**DoD:**
- **Mini-timeline visualisation per row.** Replace the bare `oldDate → newDate` text with a small horizontal bar showing each affected entity's position on a shared timeline scaled to the min-max range across the drawer. PM sees the shape of the schedule shift at a glance instead of parsing date strings. Pure CSS / no SVG library.
- **Workstream / phase grouping.** When rows have a `group` field (workstream for tasks, phase for milestones), the drawer renders collapsible sub-sections per group with a count chip. Default open. Single-group cascades stay flat (no group header needed). Engine-error / warnings sections are never grouped.
- **Ancestry trace for transitive milestone shifts.** Transitive proposals from PL-2 already carry `drivenByTaskId`. Surface as a small "← driven by T1" caption under the milestone name so the PM understands why m7 is in the list. No tooltip needed — readable inline.
- **Apply-count label fix.** Today the button says `Apply ${includedShifts + 1} of ${totalShifts + 1} changes` — the `+1` accounts for the originator but it's a hack that double-counts when the originator and an excluded row coincide. Compute count cleanly from the included set; show originator as a separate prefix ("Apply edit · N of M shifts" reads cleaner). When all shifts excluded: "Apply edit only".
- All 121 tests still pass. New drawer rendering paths spot-tested visually (no DOM tests — they'd be brittle to design churn).
- Build clean; bundles within budget. `/tasks` + `/milestones` may grow up to ~1 kB for the timeline rendering; flag if more.
- `v2/components/ui/impact-drawer.tsx` is the primary surface; ImpactRow / ImpactSection types extended minimally; callers (tasks-grid, milestones-grid) updated to pass `group` and `ancestry` where available.

**Out of scope (defer to later polish modules):**
- Animated transitions when recompute changes section sizes (jitter is rarely distracting in practice; if it becomes painful we add it later)
- Quick-action buttons ("uncheck all non-CP", "exclude all in workstream X") — nice-to-have, lower per-session ROI
- Tooltips with full impact reasoning paragraphs — ancestry caption is enough
- Drag-to-resize Gantt bars or fully-interactive timeline — that's a separate Gantt-overhaul module
- Empty-state mockup polish — current single info row is fine
- Mobile / narrow-viewport responsive — drawer is desktop-first, ≥1024px

**Why this matters:** Vineet's dogfood comment after M20.5: *"i hope the whole cascading and all have better UI as well or its in later phase"*. The engine fixes give us correct numbers; the UI polish gives us a credible-looking display of those numbers when the PM shows the drawer to a SteerCo member or vendor. A timeline visual lands an enterprise-tool feel without animation choreography or icon libraries.

**Started:** (this session)
**Status:** in progress

### M20.5 Completion summary (2026-05-17)

**Module:** M20.5 — Cascade engine fixes (PL-2, PL-3, PL-4, PL-11)
**Status:** ✅ Complete (commit `c654b62`)
**Outcome:**
- PL-2: transitive task→milestone push (predecessor chains propagate)
- PL-3: working-day shift display via new `workingDaysBetween` helper
- PL-4: configurable gate buffer (default 1 WD) on task→milestone push
- PL-11: phantom-save guard via `respectPreExisting` default-true opt
- 4 punch-list it.skip tests flipped to passing + 7 new tests
- 121 pass / 4 skipped (PL-1 + PL-5/6/9 documented / deferred)
- Build clean. `/tasks` 7.23 → 7.22 kB

### M20.5 original goal/DoD (preserved for traceability)

**Module:** M20.5 — Cascade engine fixes (PL-2, PL-3, PL-4, PL-11)
**Goal:** Land the four highest-impact gaps the M20.4 formal spec revealed. Two are P0 (transitive task→milestone push; silent auto-fix of pre-existing violations); two are P1 that directly affect SteerCo number accuracy (working-day daysShifted display; gate buffer on task→milestone push). With these in, the cascade engine matches the §10 punch-list spec for everything Vineet flagged as SteerCo-critical.

**DoD:**
- **PL-2 — Transitive task→milestone push.** After `previewTaskToMilestonePush` proposes milestone shifts, run those shifts through `previewCascade` to see if they propagate to further milestones via `predecessor` chains. Merge the additional milestone shifts into the drawer's milestones section. The `it.skip("PL-2: ...")` test flips to `it(...)` and passes.
- **PL-3 — Working-day shift display.** Add `workingDaysBetween(a, b, workingDays, holidays)` to `lib/domain/dates.ts`. Switch `daysShifted` in `previewTaskCascade`, `previewCascade`, `previewMilestoneToTaskImpact` (slack), and `previewTaskToMilestonePush` to working days. Drawer label clarifies: "+5 working days". The PL-3 skipped test flips to passing.
- **PL-4 — Gate buffer on task→milestone push.** `previewTaskToMilestonePush` adds a configurable buffer (default: 1 working day) so the proposed milestone date lands AFTER the last linked task, not on it. PMBOK / industry convention: milestone = approval gate, happens *after* the final deliverable. Buffer is a parameter on the function (`gateBufferWorkingDays?: number`, default 1) so it can be tuned per project later. PL-4 skipped test flips to passing.
- **PL-11 — Respect pre-existing violations.** Add `respectPreExisting?: boolean` opt to `previewTaskCascade` (default `true`). When true: snapshot baseline violations on input data BEFORE applying the edit; after cascade, identify shifts that were caused by pre-existing violations (not by the user's edit) and suppress them — those shifts don't appear in `affected[]` and the cascaded `tasks[]` returned reflects the pre-existing violations untouched. PL-11 skipped test flips to passing.
- All 107 existing tests continue to pass. 4 skipped tests promoted to passing (PL-2, PL-3, PL-4, PL-11). New tests added where the implementation surface area justifies them (3-hop transitive cascade end-to-end, gate-buffer-with-holiday, working-day-shift-over-weekend).
- `v2/docs/CASCADE_ALGORITHM.md` updated: §10 punch list rows for PL-2, PL-3, PL-4, PL-11 marked as ✅ Resolved with the commit hash; the spec sections (§4.2, §4.4, §10) updated to reflect the new behavior.
- Build clean; bundles within budget.
- No UI surface beyond the existing impact drawer is changed. Drawer simply consumes the engine's improved output.

**Out of scope (M20.5):**
- PL-1 (in-progress forward-pull protection) — keep current behaviour; document only.
- PL-5, PL-6, PL-7, PL-8, PL-9, PL-10 — captured in punch list, defer to a future polish module or M20.6 if Vineet wants them prioritised.
- Any UI changes beyond the drawer's existing display labels.

**Why this matters:** Vineet's framing — *"this only can possibly provide details impact to steero co as well that can becaise cost resource or any other issues"*. PL-2 + PL-11 are the two gaps where the engine currently lies to SteerCo (incomplete impact picture; phantom shifts). PL-3 + PL-4 are the two display gaps where SteerCo sees mismatched numbers (calendar days mixed into a working-day schedule; milestones landing on the final task instead of after it).

**Started:** (this session)
**Status:** in progress

### M20.4 Completion summary (2026-05-17)

**Module:** M20.4 — Cascade algorithm formalization & verification
**Status:** ✅ Complete (commit `5fb31fa`)
**Outcome:**
- `v2/docs/CASCADE_ALGORITHM.md` — 11-section formal specification of the cascade engine + prior-art cross-check (PMBOK §6.5, MS Project auto-vs-manual, Primavera P6 constraint hierarchy, Goldratt CCM)
- `v2/lib/domain/scheduling.algorithm.test.ts` — 42-case test matrix organised by spec section
- Final state: 107 pass / 8 skipped (= punch list items)
- 11-item punch list with severities P0–P2, fix sketches. Vineet selected PL-2 + PL-3 + PL-4 + PL-11 for M20.5.

### M20.4 original goal/DoD (preserved for traceability)

**Module:** M20.4 — Cascade algorithm formalization & verification
**Goal:** The cascade engine drives SteerCo decisions about cost / resources / vendor commits. If it's quietly wrong in an edge case, real money decisions get made on bad data and the audit log (M20.2) immortalises the wrong action. Before adding any more cascade UI on top (M20.3 just shipped) or building anything that consumes cascade output downstream (M21+ all do), spend one session getting the engine **formally specified, exhaustively tested, and cross-checked against prior art**. No UI changes this session.

**DoD:**
- **`CASCADE_ALGORITHM.md`** at repo root (or `/v2/docs/`) — formal spec covering:
  - Entities & fields used by the engine (milestone, task, working-day calendar, holidays)
  - Constraint types we support today + explicitly what we do NOT support (no SS/FF/SF — only FS with +1-working-day; no lag on task deps; no soft constraints)
  - Lock semantics (`milestone.lockDate`, `task` exclusion equivalent)
  - The 4 cascade modes: milestone→milestone, task→task, milestone→task (conflicts + slack), task→milestone (push)
  - Override propagation rules (overridden node = new propagation root)
  - Exclude propagation rules (excluded node = wall, downstream still computed from its own deps not the excluded one)
  - Cycle handling (Kahn's topo sort → error message naming the cycle members)
  - Pre-existing inconsistencies — engine reports, never silently fixes
  - Working-day arithmetic + holiday handling exact rules
  - Explicit non-goals (resource leveling, multi-project critical chain, soft-constraint relaxation, SS/FF/SF, deadline buffers, Monte Carlo)
- **Test matrix** — new `lib/domain/scheduling.algorithm.test.ts` with ~30–40 cases organised by category:
  - Topology: linear (3), fan-out (2), fan-in (2), diamond (2), cycle errors (3), self-loop (1), disconnected (1)
  - Operations: forward shift (3), backward shift (2), lock-mid-chain (2), override-mid-chain (3), exclude-mid-chain (3), combined override+exclude (2)
  - Calendar: Fri→Mon boundary (2), holiday mid-chain (2), task-vs-milestone lag interaction (2)
  - Cross-entity: 3-hop task→milestone→tasks (2), task→milestone with binding-constraint task (1), milestone→task slack (2), milestone→task conflicts (2)
  - Hygiene: pre-existing violation surfaces but doesn't propagate (2), empty cascade (1), single-node "cascade" (1)
- **Prior-art cross-check section** in `CASCADE_ALGORITHM.md` — short paragraphs (no code), one each:
  - PMBOK §6.5 Schedule Network Analysis — what it prescribes; where we conform / deviate
  - MS Project auto-schedule vs manually-scheduled tasks — published constraint hierarchy
  - Primavera P6 constraint types (hard vs soft)
  - Theory of Constraints / Critical Chain (Goldratt) — buffer protection model & whether we adopt
- **Punch list** at the end of the doc: every behaviour the tests revealed that disagrees with the formal spec OR with prior art. Each item gets a severity (P0 wrong / P1 surprising / P2 cosmetic) and a one-line fix sketch. These become M20.5 scope, not this session.
- All 73+ existing tests still pass. New tests added — some may fail and that's the **expected output** of this session (they document the gaps).

**Out of scope (deferred to M20.5 or later):**
- Fixing any gaps the punch list reveals — that's M20.5
- UI changes — none
- Adding SS/FF/SF constraint types — separate module if we want them
- Resource leveling / Monte Carlo / EVM — out
- Multi-project critical chain — out
- New libraries — out (stay in pure TS)

**Why this module exists:** Vineet flagged it explicitly: *"cascde functionality as its very imp feature and must work correctly as this only can possibly provide details impact to steero co as well that can becaise cost resource or any other issues"*. A wrong cascade output that flows to a SteerCo deck is a hard-to-recover-from credibility hit. Better to find gaps in a test session than in a vendor meeting.

**Started:** (this session)
**Status:** in progress

### M20.3 Completion summary (2026-05-17)

**Module:** M20.3 — Bidirectional task↔milestone cascade + tone discipline
**Status:** ✅ Complete (commit `d897cf4`)
**Outcome:** see Session Log entry below. Bidirectional cascade (task→milestone push default-checked; milestone→task split into conflicts/slack) live in the impact drawer. Tone discipline cleanup: redundant `toast.warning("Task due after its milestone")` removed; drawer owns the signal. 70 → 73 tests pass; build clean. Vineet's followup question on the deployed-vs-local UI confusion + algorithm trust drove the pivot to M20.4.

### M20.3 original goal/DoD (preserved for traceability)

**Module:** M20.3 — Bidirectional task↔milestone cascade + tone discipline
**Goal:** Close the cross-entity cascade gap. Today task↔task and milestone↔milestone cascade properly, but task↔milestone only fires a fleeting toast warning. PMs need to see the implied milestone shift when a task slides past it (and vice versa) inside the same impact drawer they already use. Also: codify tone semantics so positive updates ("slack created", "risk resolved") read as info, not alerts — the small quality detail Vineet flagged.

**DoD:**
- Engine extends `previewTaskCascade` to also return `affectedMilestones[]` when a task's shift pushes its linked milestone past current planned date. The milestone shift propagates onward through `previewCascade` (milestone-to-milestone) which may push other linked tasks → fully transitive.
- Engine extends `previewCascade` (milestones) to also return `affectedTasks[]` when a milestone moves earlier than its linked tasks' due dates (conflict — task must shift back) AND `slackCreated[]` when a milestone moves later than its linked tasks (info — tasks gain buffer).
- New `previewUnifiedCascade(state, edit, opts)` orchestrates both engines and returns a single normalised result with three classified sections: `affectedTasks` + `affectedMilestones` (rose/amber by criticality) + `slackCreated` (blue, info).
- ImpactDrawer renders all three sections in one preview. The selective include/exclude/override controls (M20) apply to both task and milestone rows; slack-created rows are read-only info.
- For task→milestone cascades, the linked milestone is **default-checked** (included). PM must opt out, per Vineet's confirmed preference for schedule integrity.
- For milestone→task slack: drawer shows a "Slack created" info section (blue tone). Also fires a single `toast.info` (not warning) on apply: "3 tasks now have +N days slack" — informational, no badge / no alarm.
- Apply commits all included shifts atomically through the M20.2 store action layer. Audit log records as a single `cascade-apply` action with multi-entity before/after snapshots.
- Remove the now-redundant `toast.warning` paths for task-due-after-milestone (still trigger inside the drawer when needed — just not as separate toasts on save).
- Pre-existing inconsistencies surface in the M20.2 Project Health card; the drawer only surfaces what THIS edit changes.

**New §5.3 — Design tokens & tone semantics** added to the operating doc. Codifies: rose = blocking violation; amber = soft conflict (consider); blue = informational / opportunity; emerald = success / resolved; slate = neutral. Applies across toasts, badges, card borders, drawer sections, notification bell items. Future modules reference this.

**Out of scope (deferred):**
- Document due dates as cascade targets (documents don't have a strict dependency model yet)
- Risk-realization auto-CR (still M24)
- Quick-action date buttons in the drawer
- Animated transitions when recomputing the drawer

**Started:** (this session)
**Status:** in progress

### M20.2 Completion summary (2026-05-16)

**Module:** M20.2 — Architectural pre-flight refactor
**Status:** ✅ Complete (commit `86b2a2a`)
**Outcome:**
- **Central entity store (Zustand)** at `lib/stores/entity-store.ts` — single source of truth for 8 entity types with add/update/delete/replaceAll per type. All 8 grids migrated from `useLocalStorageState` to store reads + action dispatches.
- **Audit log infrastructure** at `lib/stores/audit.ts` — every mutation flows through `buildAction()` + `appendAudit()`. Per-project log capped at 500 actions, persisted to localStorage. Foundation for undo, M23 Change Request audit trail, future "what changed today" feeds.
- **`EntityRepository<T>` interface** at `lib/repositories/entity-repository.ts` — store talks to repositories via composition. `LocalStorageRepository` today; `InMemoryRepository` for tests; `SupabaseRepository` becomes a one-file swap for Path C.
- **Cross-entity validator** at `lib/validation/project-validator.ts` — 5 rules covering milestone-after-go-live, task-after-milestone, cost-over-budget, doc-in-review-without-reviewers, risk-without-owner. Returns `{ healthScore, issues, totalsBy }`.
- **Project Health card on dashboard** — user-visible payoff. Shows score, severity counts, top 5 issues with click-through.
- **Hydration triggered in `app/(app)/layout.tsx`** via tiny `<EntityStoreHydrator>` client component.
- Operating doc §5.2 (Tech-debt index) added — live ledger reviewed at every checkpoint.
- Operating doc §9.9 (Periodic checkpoint rule) added — after every 4 feature modules, the next slot is a checkpoint session (tests + competitive scan + tech-debt review).
- Build clean. 70/70 tests pass. Bundle sizes within budget; some routes shrunk (Resources 12.4 → 10.5 kB, Costs 6.45 → 4.63 kB, Risks 7.01 → 5.26 kB) because store-driven state is leaner than per-component state + localStorage hooks.
**Goal:** Before adding more feature modules (M21+), put the four foundations in place that the remaining roadmap depends on. The cost is one session now; the benefit is patch-safe future work and a clean Path C transition.

**DoD:**
- **Centralized entity store** (Zustand, ~5 KB) at `lib/stores/projectStore.ts`. One slice per entity type (projects, milestones, tasks, risks, documents, costLines, teamMembers, meetings, absences). Add/update/delete actions. Persistence middleware writes to localStorage on every change.
- **Audit log infrastructure** at `lib/stores/audit.ts`. Every mutation flows through a `dispatch(action)` that records `{ type, entityKind, entityId, before, after, source, timestamp, projectId }` to a per-project audit log. Persisted to localStorage.
- **`EntityRepository<T>` interface** at `lib/repositories/entity-repository.ts` with `LocalStorageRepository<T>` implementation. The store injects a repository; future Path C swaps it for a Supabase implementation — rest of the app unchanged.
- **Cross-entity validator** at `lib/validation/project-validator.ts`. ~5 rules to start: no milestone after go-live, task due ≤ linked milestone planned, risks have owners, cost actuals ≤ budgets, docs in-review have reviewers. Returns `{ healthScore, issues[] }`.
- **Migrate all 8 entity grids** to read from the store + dispatch via actions. `useLocalStorageState` removed where the store replaces it (kept for project switcher state — different concern).
- **One new visible surface**: "Project Health" card on the dashboard showing healthScore + issue count + link to issues list. Powers the user-facing payoff for the refactor.
- All 70+ tests pass; build clean.

**Out of scope (deferred):**
- Undo/redo UI — infrastructure (before/after in actions) is in place; UI hook comes later
- Change Request workflow (M23 still its own module — but now built on this foundation)
- Supabase repository implementation — Path C territory
- Real-time sync, conflict resolution — Path C

**Started:** (this session)
**Status:** in progress

### M20.1 Completion summary (2026-05-16)

**Module:** M20.1 — Cascade UX polish + bug fix
**Status:** ✅ Complete (commit `61ad002`)
**Outcome:**
- **Root-caused the "No downstream shifts" bug** — the dogfood data had a hidden dependency cycle (T1 deps on T4 → T4 deps on T2 → T2 deps on T1) introduced by the user's earlier edit to T1's dependsOn. The M20 BFS engine walked through the cycle producing inflated, contradictory cascades. Refactored the engine to **topological-order single-pass cascade** via new `topoSortTasks()`. Cycles now return a clear error ("Dependency cycle detected — Tasks involved: T1 → T2 → T4") instead of wrong-but-silent results.
- New `groupViolationsByTask(raw)` helper — rolls up the per-pair output of `findConstraintViolations` into per-task entries with `brokenDeps[]` inline. Five rows in the dogfood screenshot collapse to one.
- New `diffViolations(before, after)` helper — returns `{ newOnes, resolved }` so the UI can surface only the violations caused by THIS edit/choices.
- ImpactDrawer's recompute callback in tasks-grid now: captures baseline violations at drawer open; on every recompute, diffs after vs baseline; renders "New constraint violations caused by your choices" prominently and "Pre-existing data inconsistencies" as a separate informational section. Engine errors (cycles) surface as a dedicated warnings row.
- 3 new Vitest cases — cycle detection bug repro (mirrors dogfood), clean cascade after breaking the cycle, topoSortTasks unit tests. 66 → 70 tests pass.
- Build clean, 15 static pages, `/tasks` 6.83 → 7.14 kB
**Goal:** Address three specific issues Vineet flagged on the 2026-05-16 dogfood of M20:
1. **Bug**: editing T3 +28d shows "No downstream shifts" even though T4 (which depends on T3) violates against the new date. Either the engine isn't being called with live state, or there's a path issue in the recompute callback.
2. **Messy violations**: showing one row per (task × broken upstream) creates duplicates. T1 violating against 4 upstreams renders as 4 rows. Should group by violating task with multi-line dep list.
3. **Pre-existing vs new violations confused**: violations that existed BEFORE the current edit are surfaced as if caused by it. Should distinguish "new violations from this edit/your choices" vs "pre-existing data inconsistencies".

**DoD:**
- New Vitest case that reproduces the screenshot scenario deterministically (T1 with deps `[t4,t7,t8,t5]`, T4 with deps `[t2,t3]`, T3 moves +28d → must shift T4)
- Engine bug fixed if present; if engine is correct, fix the UI path so the drawer sees the right data
- New `groupViolationsByTask()` helper or refactor `findConstraintViolations` output shape to group by violating task with `brokenDeps[]` array per task
- New parameter on `findConstraintViolations` or a wrapper `diffViolations(before, after)` that returns only NEW violations
- ImpactDrawer's warnings section shows one row per task with broken-dep list inline; new vs pre-existing visually distinguished (filled rose for new, outlined slate for informational)
- Builds clean, all 66+ tests pass

**Out of scope (already deferred):**
- Slack indicator per row
- Workstream grouping
- Quick-action date buttons
- Mini-Gantt preview

**Started:** (this session)
**Status:** in progress

### M20 Completion summary (2026-05-16)

**Module:** M20 — Selective cascade with re-preview
**Status:** ✅ Complete (commit `5f70f3c`)
**Outcome:**
- `lib/domain/scheduling.ts`: extended `previewTaskCascade()` and `previewCascade()` to accept `CascadeOpts { excludeIds, overrides, workingDays, holidays }`. Back-compat preserved via overloaded signatures. Excluded tasks/milestones keep their dates and don't propagate; overrides use the manual date as propagation root. Milestone exclusions use existing `lockDate: true` mechanism.
- New `findConstraintViolations()` helper — flags any FS-rule breaks after exclusions/overrides; returns objects with `taskId`, `depId`, `taskDue`, `depDue`, `daysBehind`.
- 8 new Vitest cases — exclude stops propagation, override changes propagation root, override+exclude combined, branching exclusion, single/no/multi-dep violation cases, milestone-side selective cascade. 58 → 66 tests pass.
- `<ImpactDrawer>` rewritten as stateful: holds `excludeIds: Set<string>` + `overrides: Record<string, string>`. Parent provides a `recompute(excludeIds, overrides)` callback called on every toggle/edit; drawer re-renders sections.
- Per-row controls: checkbox (default checked = included) and editable `<input type="date">` (default = engine's suggested date; edits create an override). Overridden rows show a blue border + "↺ revert" link.
- Totals strip shows "N of M shifts included · K violations · P overrides". Apply button label updates live.
- Both `tasks-grid.tsx` and `milestones-grid.tsx` updated. `onApply` re-runs the engine with final opts and commits the resulting entity list.
- Build clean — 15 static pages, `/milestones` 8.38 kB, `/tasks` 6.83 kB
**Goal:** Today the ImpactDrawer is all-or-nothing — Apply commits every shift, Cancel commits none. PMs don't think that way. They want: include some shifts, exclude others (absorb the buffer), override specific new dates (we negotiated a faster turnaround), and see live what-if every change re-cascades. PMBOK §6.5.2.3 What-If Analysis + Goldratt's Critical Chain Method (buffer protection) both prescribe this pattern. None of Monday / Smartsheet / Asana have it inline; only Planisware and Jira Advanced Roadmaps do, and in a separate workspace. Doing it inline in the drawer is a real product wedge.

**DoD:**
- Extend `previewTaskCascade()` to accept `{ excludeIds?: Set<string>; overrides?: Record<string, string> }`. Excluded tasks keep their original date and don't propagate. Overridden tasks use the manual date and propagate from there.
- Extend `previewCascade()` (milestones) with the same opts — implemented by setting `lockDate: true` on excluded milestones (reuses existing engine behaviour) and pre-applying override values.
- New `findConstraintViolations(tasks)` helper — scans for FS-rule breaks: `task.dueDate < max(dep.dueDate) + 1 working day`. Returns `{ taskId, depId, taskDue, depDue, daysBehind }[]`. Used to flag the violations introduced by user exclusions/overrides.
- Rewrite `<ImpactDrawer>` as a stateful component:
  - Holds local `excludeIds: Set<string>` + `overrides: Record<string, string>`
  - Calls a parent-provided `onRecompute(excludeIds, overrides)` callback on every toggle/edit
  - Renders per-row checkbox (include in cascade) + editable date input
  - Live re-renders affected list + violations section + Apply count
  - Apply button label: "Apply N of M changes" reflecting current selection
- 5+ new Vitest cases: exclusion stops propagation, override changes propagation root, exclusion + override combined, constraint-violation detection, milestone-side cascade exclusion via lockDate.
- Build clean, all 58+ tests still pass.

**Out of scope (deferred):**
- Saving cascade "scenarios" / what-if workspaces (Planisware-style)
- Bulk select / "Uncheck all" macro
- Drag-to-resize Gantt bars
- Audit log of skipped/overridden shifts (M23 change-request territory)
- Animations between recompute states (could come later if jitter is distracting)

**Started:** (this session)
**Status:** in progress

### M19 Completion summary (2026-05-16)

**Module:** M19 — Clean project export workbook
**Status:** ✅ Complete (commit `3c6a56a`)
**Outcome:**
- Added `xlsx-js-style` 1.2.0 (styled fork of xlsx) — dynamic-imported on click so initial bundles stay flat
- New `lib/exporter.ts` — pure function (no React imports) builds an 8-sheet workbook and triggers a browser download. Filename: `{ProjectName}_{YYYY-MM-DD}.xlsx`
- 8 sheets:
  - **Summary** — metadata + RAG snapshot (schedule / budget / risk with worst-tone fill) + KPIs + generated-on stamp
  - **Gantt** — Monday-aligned week-grid calendar, frozen left columns and header rows, bars filled rose for critical path / status-coloured otherwise, today week column highlighted yellow, month labels merged across consecutive weeks
  - **Milestones** — register with computed RAG, critical-path flag, variance, predecessor, owner, lock
  - **Tasks** — grouped by workstream with visible section headers, status-coloured cells, milestone link, dependencies
  - **Documents** — full RACI: owner (Responsible) + multi-line reviewers/approvers ("Name (Role, status, date)") + pending count
  - **Risks** — band-coloured score fills, sorted by score desc, full mitigation wrap-text
  - **Costs** — table with totals footer; burn % coloured rose ≥85% / amber ≥60% / emerald
  - **Resources & Meetings** — three blocks: Team members · Recurring meetings (with mandatory/optional attendee initials) · Absences
- New `<ExportButton>` in two variants — default in topbar (wired to active project), compact per-row on `/projects`
- Build clean, 15 static pages
**Goal:** One-click export of the active project as a multi-sheet Excel workbook covering everything a PM, SteerCo chair, or sponsor needs. Audit-friendly, handover-ready, prints cleanly.

**DoD:**
- New dep: `xlsx-js-style` (drop-in styled fork of `xlsx`, ~80 KB) — loaded via dynamic import so it stays out of the initial bundle
- New `lib/exporter.ts` exporting `exportProjectWorkbook({ project, milestones, tasks, risks, documents, costLines, teamMembers, meetings, absences, settings })` — pure function (no React imports) that builds the workbook and triggers a browser download
- 8 sheets:
  1. **Summary** — project metadata, RAG snapshot, KPIs, key dates, generated-on stamp
  2. **Gantt** — week-grid calendar, one row per milestone, cells coloured rose for critical path / blue for normal / amber for at-risk / emerald for complete, today column highlighted
  3. **Milestones** — register: ID, name, phase, planned, forecast, variance, duration, predecessor, RAG, owner, locked
  4. **Tasks** — register grouped by workstream (visible section headers): ID, name, priority, status, progress, owner, due, milestone link, dependencies
  5. **Documents** — RACI exploded: ID, abbreviation, name, type, phase, version, status, due, owner (Responsible), reviewers serialized as "name (status, date); …", approvers same, pending count
  6. **Risks** — register: ID, title, category, P, I, score, band, status, owner, mitigation
  7. **Costs** — category, description, contract, budget $k, actual $k, burn %, owner; totals footer row
  8. **Resources + Meetings** — three blocks: Team members · Recurring meetings (with attendees by mandatory/optional) · Absences (with reason)
- Export button: dashboard topbar "Export" wired (currently no-op); projects page per-row "Export" button on the active project row
- Filename: `{ProjectName}_{YYYY-MM-DD}.xlsx` (slug-safe)
- Sonner toast on success / on failure
- Build clean, lint clean, tests still pass

**Out of scope:** anonymise-personal-data toggle (defer to a future config); export-as-PDF (Excel only); per-sheet template customisation (fixed for now); image-embedded charts (cells-only).

**Started:** (this session)
**Status:** in progress

### M18 Completion summary (2026-05-16)

**Module:** M18 — Universal cascade-impact panel (task-level + cross-entity)
**Status:** ✅ Complete (commit `aa2544d`)
**Outcome:**
- `lib/domain/scheduling.ts` gained `previewTaskCascade(tasks, edit, workingDays?, holidays?)` — forward-walks the `dependsOn` reverse-index from the edited task; enforces `dueDate >= max(dep.due) + 1 working day`; cycle-defensive
- `previewMilestoneToTaskImpact(tasks, milestoneId, newPlannedDate)` — cross-entity soft warning when a moving milestone leaves its linked tasks ending after it
- 7 new Vitest cases (linear chain, branching, no-shift-on-earlier, cycle defense, cross-entity flagging, scoping). 51 → 58 tests pass
- New `<ImpactDrawer>` component — right-anchored drawer that replaces M4B's `CascadePreviewDialog`. Shows originating change summary at the top, sectioned body (Milestones, Tasks, Warnings) with CP badge on critical-path rows, totals strip, Apply/Cancel footer
- Milestones grid: edit a planned date → drawer opens with milestone cascade **plus** any tasks linked to that milestone that now end after its new date. Apply commits both
- Tasks grid: save a task with a later due date → drawer opens with the full downstream task cascade. Apply commits the entire chain
- New tasks, earlier-due edits, and edits with no impact skip the drawer entirely
- Build clean — `/milestones` 12.1 → 8.19 kB (CascadePreviewDialog dropped); `/tasks` 6.45 → 6.65 kB
**Goal:** Today only milestone-to-milestone cascade has a preview modal (M4B). Tasks have no schedule cascade at all — `dependsOn` is just a visual tag. Cross-entity is missing entirely — moving milestone m6 doesn't flag tasks linked to it. Vineet flagged this as the biggest gap during the 2026-05-16 dogfood. PMBOK §4.6 (Integrated Change Control) and Theory-of-Constraints both require "no schedule change without impact assessment first."

**DoD:**
- New `previewTaskCascade(tasks, edit, workingDays?, holidays?)` in `lib/domain/scheduling.ts` — forward-walks through `dependsOn` reverse-index. For each downstream task, enforces `task.dueDate >= max(dep.dueDate) + 1 working day`. Returns `{ affected: { id, name, oldDue, newDue, daysShifted }[], error }`. Defensive against cycles.
- New `previewMilestoneToTaskImpact(milestones, tasks, milestoneEdit)` — when milestone m's plannedDate moves, returns tasks where `task.milestoneId === m.id && task.dueDate > newPlannedDate` (soft flag — doesn't auto-shift; task-milestone is a logical link, not a strict precedence).
- 3 new Vitest cases on task cascade: linear A→B→C chain, branching (one root, two descendants), cycle defense.
- New `<ImpactDrawer>` component (`components/ui/impact-drawer.tsx`) — right-anchored drawer (re-uses EntityDrawer's positioning idea but is a separate component because it has different semantics). Shows:
  - Originating change at the top (entity ID, before/after, delta days)
  - Sectioned list: Milestones affected · Tasks affected · Tasks-vs-milestone warnings (soft)
  - For each row: ID, name, before/after dates, delta in days, critical-path flag if applicable
  - Apply / Cancel buttons in footer
- `milestones-grid.tsx`: existing `CascadePreviewDialog` replaced by `<ImpactDrawer>`. Milestone date edit now ALSO computes task impact via `previewMilestoneToTaskImpact()` and surfaces it as a warning section in the drawer.
- `tasks-grid.tsx`: saving a task with a changed dueDate now fires `previewTaskCascade()`. If downstream impact > 0, opens `<ImpactDrawer>` with the cascade. Apply → updates affected tasks; Cancel → reverts the edit.
- Sonner toast on Apply: "N items shifted." On Cancel: no toast, edit dropped.

**Out of scope (deferred to later modules):**
- Inline date editor on task rows (currently only in drawer) — keeps the cascade-trigger surface minimal
- Project-level "recent shifts" feed (this is essentially activity feed → future module)
- Buffer consumption visualization (Theory-of-Constraints discipline — needs estimates first)
- Auto-resolution suggestions (LLM territory)
- Resource leveling (depends on timesheets — M20)

**Started:** (this session)
**Status:** in progress

### M17 Completion summary (2026-05-13)

**Module:** M17 — Global entity search + My Items + owner-me filter
**Status:** ✅ Complete (commit `305a9ca`)
**Outcome:**
- New `lib/searchIndex.ts` — `buildSearchIndex(activeProjectId)` reads every entity from its M16.1 localStorage key (fallback to initial mockData), returns flat `SearchHit[]` for the active project (plus all projects globally). `scoreHit()` ranks title-match > startsWith > includes > subtitle-includes. `searchEntities(activeProjectId, query, limit=20)` returns the top hits.
- Command palette rewired to show two groups: **Navigate** (page links, always present) and **Entities** (only when query is non-empty). Entity items show kind icon + title + subtitle + kind badge. Click navigates to the relevant page.
- New `/my-items` route — aggregates everything owned by VP in the active project. Summary strip (Tasks / Docs / Risks / Milestones) with tone-aware count cards. Below that: Tasks bucketed by Overdue / Blocked / Due-this-week / On-track; Documents as Responsible bucketed by Overdue / In-review / Drafts; Risks sorted by score; Milestones sorted by planned date with slip indicator. Empty state when nothing's owned.
- Sidebar OVERVIEW group adds a "My Items" entry (Inbox icon). Command palette + topbar breadcrumb both register `/my-items`.
- New "Mine" toggle in the toolbars of Milestones, Tasks, Risks, Documents grids — filters to `owner === "VP"`. Per-component state.
- Build clean — 15 static pages (was 14)

### M16.1 Completion summary (2026-05-13)

**Module:** M16.1 — Entity persistence + working notification bell
**Status:** ✅ Complete (commit `04c336c`)
**Outcome:**
- New `lib/useLocalStorageState.ts` — drop-in `useState` replacement that hydrates from localStorage on mount, saves on every set. Used in 8 places (milestones, tasks, risks, documents, costLines, absences, teamMembers, recurringMeetings)
- New `components/notification-bell.tsx` — replaces the static red-dot Bell. Click opens a popover listing live derived alerts: overdue tasks owned by me, documents pending my decision, escalated risks (score ≥12), at-risk milestones. Scoped to active project. Click an alert → navigates. Empty state when nothing.
- Topbar breadcrumb now uses live `activeProject.name + phase` instead of hardcoded "Veeva RIM Implementation · Phase 2"
- Build clean

**M16.1 goal:** Fix the two bugs surfaced after M16:
1. New `useLocalStorageState<T>(key, initial)` helper. Apply to every entity array — milestones, tasks, risks, documents, cost lines, team members, recurring meetings, absences. Adds, edits, deletes survive page refresh.
2. Make the topbar bell interactive: popover listing live derived alerts (tasks overdue, decisions pending for me, escalated risks, at-risk milestones). Click an alert → navigate to relevant page. Red dot only when there are alerts.

**M17 goal:** Global search + "My Items" view + filter-by-owner-me:
1. Extend ⌘K command palette to search entities — typing "FRS" finds the FRS document; typing "data migration" finds risks + milestones + tasks. Results show entity icon + name + page link.
2. New `/my-items` route aggregating every entity owned by current user (mock — VP). Tasks, risks, milestones, documents-as-owner sorted by urgency.
3. "Owned by me" toggle on milestones, tasks, risks, documents toolbars.

**DoD:** all 14+1 routes pass build clean; refreshing `/milestones` after adding a milestone keeps the milestone; bell click opens a popover; ⌘K typing "FRS" finds the document; `/my-items` lists owned entities; toggling "Mine" filter shows only owner=VP items.

**Out of scope:** notification read/unread state, dismiss action, persistence of read state, search across project (search currently scopes to active project).

**Started:** (this session)
**Status:** in progress

### M16 Completion summary (2026-05-13)

**Module:** M16 — Gantt timeline + critical path
**Status:** ✅ Complete (commit `8e427f2`)
**Outcome:**
- New `computeCriticalPath()` in `lib/domain/scheduling.ts` — backward pass through topo-sorted milestones computing latest-start / latest-finish from terminal milestones backward through predecessor + lag chains. Returns `{ criticalIds: Set<number>, slackById: Record<number, number> }`. Respects `workingDays` + `holidays` opts.
- 5 new Vitest cases (51 total): linear chain (all on CP), parallel branches (long branch on CP, short branch has slack), single terminal milestone, holidays-reduce-slack, empty input
- New `components/milestones/gantt-view.tsx` — div-based horizontal timeline. Left rail shows names with lock icon and CP badge (rose) or slack indicator (+Nd). Right pane has month-headed time axis (3 px/day). Bars coloured rose for CP, status colours otherwise. Today line, forecast-slip striped extension, click-to-edit
- Milestones page gains a Grid/Gantt toggle in the toolbar (LayoutGrid / GanttChartSquare icons); default Grid. All existing filters and active-project scoping preserved
- Build clean, 14 static pages, `/milestones` 9.67 → 11.9 kB

### M15 Completion summary (2026-05-11)

**Module:** M15 — Multi-project (projects list, create, sidebar switcher)
**Status:** ✅ Complete (commit `f949295`)
**Outcome:** App is now multi-project end-to-end. `Project` type + 2 seeded projects (Veeva RIM Implementation + empty Veeva PromoMats Migration). Every entity type gained a `projectId` field; all 77 existing mock entities back-filled. `<ProjectProvider>` wraps the app; `useProject()` exposes `activeProjectId`, `activeProject`, `setActiveProjectId`, and CRUD. Active project persists in localStorage. Sidebar dropdown replaces the static project card. `/projects` page with list + inline create form + per-project actions (switch / open / delete). Command palette gained a Projects entry. Every grid/page (dashboard, milestones, tasks, risks, documents, costs, resources) filters to the active project; switching projects re-scopes the entire UI. `getKpis(projectId)` accepts and filters. Cost totals now derive from the project's own cost lines (no more $2M hardcode). Build clean — 14 static pages.

### M14.1 Completion summary (2026-05-11)

**Module:** M14.1 — Pre-flight fixes
**Status:** ✅ Complete (commit `16abfa7`)
**Outcome:** Three small dogfood-driven fixes. (1) New `<SelectWithCustom>` component replaces all 6 datalists across risk/task/document/cost/team/meeting forms — known options are visible as a proper select; "+ Other (type new)…" escape hatch for free-text. (2) Duplicate task detection: task-form soft-warns via toast when an existing task in the same workstream has the same name (case-insensitive). (3) RACI on documents: added `owner` field to Document type (Responsible — who delivers it), back-filled all 13 mockData docs with sensible owners (VP/SL/AR/QA/HR by document type), surfaced as a coloured avatar on each card next to the due-date row; PeopleList headers updated to "Reviewers (Consulted)" / "Approvers (Accountable)".
**Goal (M14.1):** Three small fixes the dogfood walkthrough surfaced:
1. **Category pickers**: datalist UX hides options — users see "Technical" and think it's the only one. Replace datalists in all 6 forms with a proper select + "Other..." pattern via a new `<SelectWithCustom>` component.
2. **Duplicate task prevention**: soft-warn (`toast.warning`) when adding/saving a task whose name (case-insensitive) already exists in the same workstream.
3. **Document RACI**: add `owner` field to `Document` type — "Responsible" for delivery. Approvers stay as "Accountable" (single point of sign-off). Reviewers stay as "Consulted". Surface `owner` on document cards and in the document form.

**Goal (M15):** Make the app multi-project.
- Add `Project` type; add `projectId` to all major entity types (Milestone, Task, Risk, Document, CostLine, TeamMember, RecurringMeeting, Absence)
- Seed 2nd project (e.g. "Veeva PromoMats Migration") — metadata only, no entities (empty state to verify isolation)
- `<ProjectContext>` with localStorage persistence of active project ID
- `/projects` page: list of projects + Create Project form
- Sidebar: project switcher dropdown replacing the current static project card
- Each grid filters entities by current `projectId`; switching project re-scopes the entire app
- `getKpis()` and derived helpers become project-aware

**DoD:** all 13+1 routes pass build clean; switching projects in the sidebar produces visibly different dashboards / grids; creating a new project produces empty grids (no other-project leakage).

**Out of scope:** project archive, project clone, project templates (M18), per-project settings (settings stays global for now).

**Started:** (this session)
**Status:** in progress

### M14 Completion summary (2026-05-11)

**Module:** M14 — Drawer pattern + data validation across all entities
**Status:** ✅ Complete (commit `5105406`)
**Outcome:**
- 5 new form drawers built (`risk-form`, `cost-line-form`, `document-form`, `team-member-form`, `meeting-form`), each wired with + Add button, name-click-to-edit, Sonner toasts on add/update/delete
- `lib/validation.ts` shared helpers (`isIsoDate`, `inProjectRange`, `addCalendarDays`, `PROJECT_DATE_MIN`, `PROJECT_DATE_MAX`)
- Hard validation (blocks save): missing required, ISO format, 2024–2030 range, predecessor date contradiction, self-reference
- Soft validation (Sonner warning, doesn't block): task due > milestone planned, task due < dependsOn dates, cost actual > budget, doc/meeting due in past, member initials collision
- Auto-suggest planned date when predecessor selected (calendar-days approximation)
- Sort: milestones by plannedDate; tasks by dueDate within workstream; documents by dueDate within phase
- `costs-grid` converted from server to client component
- Resources panel: AbsencesContext → ResourcesContext (carries members + meetings); getMemberById refactored to take members as param; 4 tabs updated; Add buttons context-switched per active tab
- Build clean, all 13 routes pass type-check + lint

### M13 Completion summary (2026-05-11)

**Module:** M13 — Universal Add + Edit + Delete (milestones + tasks)
**Status:** ✅ Complete (commit `2c94410`)
**Outcome:**
- New reusable `<EntityDrawer>` component (`components/ui/entity-drawer.tsx`) — right-anchored slide-over, ESC + backdrop-click close, body-scroll lock, single file, no new deps. Also exports `<ConfirmDelete>` and `<Field>` + `inputCls` for form consistency.
- New `<MilestoneFormDrawer>` (`components/milestones/milestone-form.tsx`) — 10 editable fields including predecessor dropdown (excluding self), validation (name + planned date required, no self-reference)
- New `<TaskFormDrawer>` (`components/tasks/task-form.tsx`) — 9 editable fields including dependsOn checkbox list, datalist for workstream, status auto-derived from progress=100 → Complete
- `milestones-grid.tsx`: `+ Add Milestone` button, milestone names click-to-edit, Sonner toasts on add/update/delete
- `tasks-grid.tsx`: `+ Add Task` button, task names click-to-edit, onEdit threaded through WorkstreamGroup, Sonner toasts
- All existing inline affordances preserved (status cycle, progress slider, date inline edit, lock toggle)
- Build clean. `/milestones` 6.36 → 8.85 kB, `/tasks` 3.54 → 6.42 kB

### M12 Completion summary (2026-05-11)

**Module:** M12 — Wire M8 settings into the cascade engine
**Status:** ✅ Complete (commit `fd3ca8e`)
**Outcome:**
- Discovered that `addWorkingDays`, `cascade`, `previewCascade`, `scheduleBackward`, `computeEndFromDuration`, `computeDurationFromDates` already accepted `workingDays` + `holidays` as optional params — call sites just weren't passing them. Only `computeRAG` was hardcoded to `{red: 5, amber: 0}`.
- `computeRAG()` gained an optional `thresholds?: { redDelayDays?, amberDelayDays? }` arg; exported `DEFAULT_RAG_THRESHOLDS` const and `RagThresholds` type for consumers
- `milestones-grid.tsx` now calls `useSettings()` and threads `workingDays`, `holidays` into every cascade/preview/backward-schedule call, and `ragThresholds` into every `computeRAG` call — Settings page now actually drives the schedule + RAG
- Added 3 new Vitest cases on `computeRAG` covering tighter-red, looser-red, and raised-amber thresholds. All 46 tests pass (was 43).
- Build clean; `/milestones` grew 5.79kB → 6.36kB from settings-hook threading

### M11 Completion summary (2026-05-11)

**Module:** M11 — Reports polish + editable absences + Dashboard cross-links
**Status:** ✅ Complete (commit `ffd7311`)
**Outcome:**
1. Reports sweep — all three report components (`weekly-report.tsx`, `steerco-report.tsx`, `workstream-report.tsx`) had their saturated pills converted to M10A bordered enterprise tokens (rose replaces red, emerald replaces green, violet replaces purple). Reports page header rebuilt: text-2xl bold, explanatory subtitle, and a 3-column card-grid tab selector with icon badges + active-state shadow.
2. Editable absences — Absences lifted from module-level constant to component state in `ResourcesPanel`, distributed to the four tabs via a React Context (`AbsencesContext`). TeamAvailabilityTab gained an "Add Absence" button that opens an inline form card (member dropdown / start / end / reason / optional note, with validation). Every absence card gained a remove button (Trash2 icon). Both mutations fire Sonner toasts. `getMemberAbsencesInWeek` was refactored to take absences as a parameter.
3. Dashboard click-throughs — Upcoming-milestone rows are now `<Link href="/milestones">` and pending-decision rows are `<Link href="/documents">`. Each panel header gained a "View all →" link. Rows show a ChevronRight on hover, and the row title lights up in primary on group-hover.
Build clean, 13 static pages.

### M10B Completion summary (2026-05-11)

**Module:** M10B — Resources module
**Status:** ✅ Complete (commit `0dbb953`)
**Outcome:** Resources panel wired into `/resources` route with consistent M10A header. Sidebar gained a new PEOPLE nav group with Resources entry (Users icon). Command palette and topbar breadcrumb both recognise the route. ResourcesPanel refreshed across all 4 tabs to use the enterprise palette (bordered bg-50 pills replacing saturated bg-100 fills; rose replaces red, emerald replaces green, violet replaces purple).

### M10A Completion summary (2026-05-11)

**Module:** M10A — Enterprise UX polish + complete document set
**Status:** ✅ Complete (commits `db46556`, `4905a74`)
**Outcome:** Lifted the v2 UI from "competent template" to "enterprise-grade":
- Design tokens refreshed: muted slate-neutral base, deeper indigo primary (224 71% 36%), refined dark mode, system-ui font stack with antialiasing, 14px body baseline, tabular-nums everywhere
- Mock document set expanded 4 → 13 docs (added VMP, URS, RMP, DAP, OQ, PQ, Traceability Matrix, Training Plan, Go-Live Checklist); added `phase` + `abbreviation` + `description` fields to Document type
- Documents page: phase-grouped cards (5 lifecycle phases with icons), urgency strips, person chips with avatar+name+role+status, color-hashed per-person avatars, progress bars, refined filter bar with free-text search
- Risks page: matrix card widened, gradient-shaded cells, score visible in empty cells, click-a-dot smooth-scrolls and rings the matching card, risk cards with always-visible mitigation panel
- Dashboard / Milestones / Tasks / Costs: consistent enterprise polish applied — KPI cards tone-aware with tinted icon chips, bordered badges throughout, owner avatars colour-hashed, status semantics unified (rose=danger, amber=warn, emerald=good, blue=primary action)
- Vineet visually confirmed Documents, Risks, then Dashboard/Milestones/Tasks/Costs in sequence

### M9 Completion summary (2026-05-11)

**Module:** M9 — Polish + deploy
**Status:** ✅ Complete
**Outcome:** Installed cmdk 1.1.1. Created `components/theme-provider.tsx` — reads localStorage `aivello_theme` on mount, falls back to `prefers-color-scheme`, toggles `.dark` on `<html>`. Created `components/command-palette.tsx` — ⌘K/Ctrl+K modal using cmdk `Command` component, 8 nav items (Dashboard → Settings), ESC closes, backdrop overlay, `CommandPaletteTrigger` search-bar-style button. Updated `components/topbar.tsx` — replaced static search icon with `CommandPaletteTrigger` + Moon/Sun toggle using `useTheme()`. Updated `app/(app)/layout.tsx` — wrapped in `ThemeProvider` + `CommandPalette` global overlay. Fixed `overflow-hidden → overflow-x-auto` on all table wrappers across milestones-grid, risks-grid, costs-grid, tasks-grid, documents-list, and all 3 report components. Build clean (12 static pages). Committed `4888681`, pushed to `enterprisepharmapm-pro`.

### M8 Completion summary (2026-05-11)

**Module:** M8 — Settings + cascade preview + holidays
**Status:** ✅ Complete

### M7 Completion summary (2026-05-11)

**Module:** M7 — Reports / Weekly Status Report
**Status:** ✅ Complete

### M6B Completion summary (2026-05-11)

**Module:** M6B — Tasks grid
**Status:** ✅ Complete
**Outcome:** Added Task type + 18 tasks to mockData across 5 workstreams. Built `components/tasks/tasks-grid.tsx` (client): collapsible workstream group headers showing done/total count + blocked badge + critical-open flag + avg progress mini bar; task rows with priority dot, name + milestone tag, priority badge, owner, due date (overdue red), click-progress-to-slider (range input, auto-advances status), click-status-to-cycle badge; priority + status filter dropdowns; summary bar. Build clean, pushed `8ea8d8d`. M6 fully complete.

### M6A Completion summary (2026-05-11)

**Module:** M6A — Risks grid + Costs grid
**Status:** ✅ Complete
**Outcome:** Added CostLine type + 7 cost line items to mockData ($2M budget / $780k actual, consistent with budgetTrend). Built `components/risks/risks-grid.tsx` (client): 5×5 P×I heatmap with colored cells and numbered risk dots at each position, risk table sorted by score desc (also by P or I), score pills by band (High ≥15 red / Medium 8–14 amber / Low <8 green), clickable status badges (Open → Mitigated → Closed), expandable mitigation per row, status + category filters. Built `components/costs/costs-grid.tsx` (server): 4 KPI cards, overall burn bar, cost breakdown table with category pill + contract type + per-row burn bars + totals row, monthly trend table with delta + cumulative + variance + forecast dimming. Build clean, pushed `d33ad81`.

### M4B Completion summary (2026-05-11)

**Module:** M4B — Milestones grid (Session B: interactive grid)
**Status:** ✅ Complete
**Outcome:** Added predecessor/duration/lag to all 13 mock milestones enabling real dependency chains. Created `components/ui/dialog.tsx` (Radix Dialog wrapper). Built `components/milestones/milestones-grid.tsx` (client component): phase + status filter dropdowns, "Schedule from Go-Live" button (runs scheduleBackward from project.goLiveDate), "Reset" button, inline date editing (click-to-edit date inputs on planned and forecast columns), cascade preview modal (shows all downstream shifts with old/new dates + daysShifted before applying), lock/unlock toggle per row, RAG + dependency status live-computed. All M4 DoD items met. Build clean, 6.09 kB page bundle. Pushed `47865e3`.

### M4A Completion summary (2026-05-11)

**Module:** M4A — Milestones grid (Session A: port logic + read-only grid)
**Status:** ✅ Complete
**Outcome:** Ported `src/domain/dates.js` → `v2/lib/domain/dates.ts` (8 pure UTC-safe functions). Ported `src/domain/scheduling.js` → `v2/lib/domain/scheduling.ts` (topologicalSort, cascade, computeRAG, computeDependencyStatus, scheduleBackward, previewCascade, computeEndFromDuration, computeDurationFromDates). Installed Vitest 4.1.5; wrote 43 tests covering all domain functions including negative addWorkingDays, lockDate behaviour, backward scheduling, cascade preview non-mutation, and RAG thresholds. All 43 pass. Wired domain engine into read-only milestones grid at `/milestones` — shows all 13 mock milestones with RAG badge, dependency status badge, variance days, lock icon, and phase column. Computed server-side at build time (pure TypeScript, no client state needed). Build clean, pushed `f3b4487`.

### M3 Completion summary (2026-05-11)

**Module:** M3 — Dashboard view
**Status:** ✅ Complete
**Outcome:** Full dashboard live with real mock data. KPI cards (Schedule Health dynamic from mock, Open Risks 5, Budget 39%, Days to Go-Live 114), 6-phase progress bar (Initiation 100% → Go-Live 0%), Risk Profile amber sparkline + Budget Burn blue sparkline (Recharts), top-5 upcoming milestones with variance days, top-3 pending documents with per-person decision dots. Vineet confirmed via screenshot. Hover tooltips on charts working. Click-through links deferred to M4/M5 (noted in backlog).

### M2 Completion summary (2026-05-11)

**Module:** M2 — App shell
**Status:** ✅ Complete
**Outcome:** Full app shell live at `https://buildpod.github.io/pharmapm-pro/v2/`. Fixed 224px sidebar with logo, project context card, 4 nav groups (OVERVIEW / PLANNING / RISK & FINANCE / DOCUMENTATION), badge counts on Risks (3) and Documents (2), user avatar. Top bar with breadcrumb, search, bell with alert dot, Export button. 7 routed views all working. Dashboard has 4 real KPI cards. Mobile Sheet (hamburger) wired. Vineet confirmed via screenshot.

### M1 Completion summary (2026-05-11)

**Module:** M1 — Project setup
**Status:** ✅ Complete
**Outcome:** Branch `enterprisepharmapm-pro` created. Next.js 14 + TypeScript + Tailwind + shadcn/ui scaffolded in `v2/`. "Hello, RIM" page renders locally and is pushed to GitHub. GitHub Actions deploy workflow wired to Pages. `pnpm build` passes, TypeScript clean. Vineet confirmed localhost render via screenshot. Pushed and deploying to `https://buildpod.github.io/pharmapm-pro/v2/`.

### M0 Completion summary (2026-05-11)

**Module:** M0 — Tooling setup
**Status:** ✅ Complete
**Outcome:** Vineet's MacBook Pro M5 fully provisioned. Installed: Homebrew 5.1.11, Node v26, npm 11.12.1, pnpm 11.0.9, git 2.50.1, gh 2.92.0, uv 0.11.13, Claude Code 2.1.138, Docker 29.4.0, Ollama 0.23.2. Cloned `buildpod/pharmapm-pro` to `~/projects/pharmapm-pro`. Ran `node tools/run_tests.js` — **305/305 passed in 12ms.** GitHub CLI authenticated as `buildpod`.

---

## 5 — Module breakdown for the UI rewrite

Total estimate: **11 sessions** at one focused module per session.

> Each module's "definition of done" is what Claude must achieve before the session ends. If a module needs more than one session, that means it was scoped wrong — split it.

### M1 — Project setup (1 session)

- Create new repo (or new branch on `pharmapm-pro`) called `aivello-rim`
- Scaffold Next.js 14+ with TypeScript strict mode, Tailwind v4, shadcn/ui CLI initialized
- Configure for static export (`output: 'export'` in `next.config.js`)
- Install lucide-react, basic shadcn primitives (Button, Card, Badge, Avatar)
- Port v1's `data/` (mock Veeva RIM project) into a `lib/mockData.ts` TypeScript file
- Single homepage that renders "Hello, RIM" with a shadcn button — proves stack works
- Deploy to GitHub Pages, confirm URL loads on phone

**Definition of done:** A live URL with a shadcn button visible on phone, repo committed.

### M2 — App shell (1 session)

- Sidebar (project context, nav groups, badges, user avatar)
- Top bar (breadcrumb, search trigger, alerts, export)
- Routing for 7 views (dashboard, milestones, tasks, risks, documents, costs, reports)
- Each view a placeholder page with the right title

**Definition of done:** All 7 nav items work, page transitions smooth, layout responsive.

### M3 — Dashboard view (1 session)

- KPI cards (health, schedule, budget, risks)
- Phase progress bar
- Sparkline charts (risk profile, budget burn) — use Recharts
- Upcoming milestones list (top 5)
- Documents pending decision list (top 3)

**Definition of done:** Dashboard populated with mock Veeva RIM data, looks polished.

### M4 — Milestones grid (2 sessions)

**Session A — port logic:**
- Move v1 `scheduling.js` into `lib/domain/scheduling.ts` (TypeScript port)
- Move v1 `dates.js` into `lib/domain/dates.ts`
- Port the 305 tests as Vitest tests; confirm all pass
- Wire mock milestones → grid display (read-only first)

**Session B — interactive grid:**
- Inline editing (date pickers, dropdowns, text)
- Cascade preview modal on date edit
- "Schedule from Go-Live" action button
- Per-column filter dropdowns
- Lock toggle column

**Definition of done:** Milestones grid is fully functional and matches v1 behavior, tests green.

### M5 — Documents with proper reviewer/approver chips (1 session)

- Each document has `reviewers: Decision[]` and `approvers: Decision[]` arrays
- Each decision rendered as avatar chip with status icon (✓ approved / ⏰ pending / ✗ rejected)
- Click chip to mark decision (UI only, mock data update)
- Status auto-derives: all reviewers approved → status moves to "Reviewed", etc.
- Per-doc detail pane shows full review/approval history

**Definition of done:** Documents view shows chips per person, decisions update mock state.

### M6 — Risks + Costs + Tasks grids (2 sessions)

**Session A — Risks + Costs:**
- Risks grid sorted by P×I score, score colored pills
- Costs grid with budget vs actual, burn bars, totals row

**Session B — Tasks:**
- Tasks grouped by workstream (collapsible sections)
- Priority flags
- Inline progress
- Link tasks to parent milestone

**Definition of done:** All three grids functional with mock data, filterable.

### M7 — Reports / Weekly Status Report (1 session)

- Printable weekly status report layout
- Headline metrics, this week / next week sections, top risks, decisions needed
- Print stylesheet (clean PDF when user prints)
- "Export Excel" button using SheetJS (client-side, formatted xlsx)

**Definition of done:** Vineet can click "Print" or "Export Excel" and get usable artifacts.

### M8 — Settings + cascade preview + holidays (1 session)

- Settings panel (working days, holidays, country presets — port from v1)
- Cascade preview modal wired into milestone date edits
- Toast notifications for state changes (use Sonner)

**Definition of done:** Feature parity with v1 settings + cascade preview + country holidays.

### M9 — Polish + deploy (1 session)

- Mobile responsive audit (iPhone-sized viewport for every view)
- Dark mode toggle
- Command palette (⌘K) with cmdk library
- Final deploy to GitHub Pages
- Smoke test on phone

**Definition of done:** v2 is live, every view works on phone, ready to show pharma friends.

### Buffer

**+1 session** allowed across the project for unexpected fixes. If we exceed by more than 1 session, we re-plan section 5.

---

## 5.1 — Post-launch modules (M10A → present)

After the original 11-module plan shipped, v2 was extended with three rounds of polish (M10A enterprise UX, M10B Resources, M11 reports/absences/dashboard cross-links) and one domain integration (M12). All complete and logged in §8.

Following the 2026-05-11 dogfood walkthrough (logged below as the "what's missing" analysis), the path forward is **Path C** — focus on core PM features, pair with Veeva Vault for validated document + e-signature handling rather than build our own GxP layer. Documentation is internal (build / architecture / cert-prep), not user-facing how-to.

### M13 — Universal Add + Edit + Delete (milestones + tasks)

**Goal:** Turn the app from a viewer into a tool by giving milestones and tasks add / edit / delete affordances via a reusable slide-over drawer.

**Definition of done:** see §4.

### M14 — Universal Add + Edit + Delete (risks, documents, cost lines, team members, meetings)

**Goal:** Extend the M13 drawer pattern to the remaining five entities. Includes the ability to start a new document review cycle, add risk mitigation history entries, and CRUD team members + recurring meetings on the Resources page.

**Definition of done:** every entity in the app has + Add / row-click-to-edit / Delete with the same drawer pattern. Sonner toasts everywhere. No mock-data fields stay hidden behind a code-only edit.

### M15 — Projects list, create, switcher

**Goal:** Make the app multi-project. Sidebar currently hardcodes "Veeva RIM Implementation"; build a `/projects` list, a Create Project form, a sidebar dropdown switcher, and per-project data isolation in component state.

**Definition of done:** user can create a second project, switch between them, and the dashboard / milestones / tasks / etc. all scope to the selected project.

### M16 — Gantt + critical path

**Goal:** Add a Gantt timeline view on the Milestones page with predecessor lines and critical-path highlighting. Re-use the existing cascade engine for CP computation.

**Definition of done:** toggle on Milestones page between "Grid" and "Gantt"; Gantt shows bars by plannedStart→plannedEnd with predecessor arrows; critical-path milestones outlined or coloured distinctly.

### M17 — Global search in ⌘K + "My Items" view + filter by owner-is-me

**Goal:** ⌘K currently only navigates pages; extend it to search milestones, tasks, risks, documents, cost lines. Add a top-level "My Items" route aggregating everything owned by the current "logged-in" user (mock — Vineet). Add `owner = me` quick-filter on each grid.

**Definition of done:** typing "FRS" in ⌘K finds the document; "data migration" finds the risk + milestone + tasks. `/my-items` lists overdue / due-this-week / blocked rows across entities.

### M18 — Universal cascade-impact panel (task-level + cross-entity)

**Goal:** Extend the cascade engine to operate on tasks and across entities (milestone → tasks). Replace the existing milestone-only cascade modal with a richer impact drawer that shows the full downstream picture.

**Source:** PMBOK §4.6 (Integrated Change Control) + Critical Chain Method (Goldratt) — schedule change must surface its impact before commit.

**Definition of done:** see §4.

### M19 — Clean project export workbook

**Goal:** One-click export of the active project as a multi-sheet Excel workbook covering Summary, Gantt, Milestones, Tasks, Documents (with full RACI), Risks, Costs, Resources + Meetings. Audit-friendly and handover-ready.

**Definition of done:** Export button on dashboard + projects page produces `{Project}_{YYYY-MM-DD}.xlsx`. Gantt sheet uses calendar-grid cell colouring (via `xlsx-js-style`) with CP rows in rose. Filename and content stamped with date.

### M20 — Selective cascade with re-preview

**Goal:** Make the M18 ImpactDrawer interactive. PM can include/exclude/override individual cascade rows; engine re-cascades live. PMBOK §6.5.2.3 What-If Analysis + Goldratt Critical Chain Method buffer protection. None of Monday / Smartsheet / Asana have it inline.

**Definition of done:** see §4.

### M21 — Timesheets + derived labour cost (EVM closure)

**Goal:** Auto-derive per-resource hours from task ownership + meeting attendance − absences. With `hourlyRate` on team members, surface **actual labour cost** so we can close the Earned Value Management loop (PV vs EV vs AC).

**Definition of done:** Resources tab gains a Timesheets sub-view per member showing derived hours by week with cost roll-up. `/costs` reconciles against derived labour. Reads from existing mock data (tasks, meetings, absences); no manual time entry yet.

### M22 — AI-agent team-member type + token-cost calc

**Goal:** First-class support for AI agents as team members. `TeamMember.kind: "human" | "ai-agent"`. Agents have `model`, `tokensPerTask`, `costPerMTokens` instead of hourly rate. Resources view shows mixed human/AI roster with cost-per-effort.

**Definition of done:** Add agent in Resources form; agents can be assigned as task owners; cost on `/costs` and `/my-items` includes token-derived spend. Positions the tool as the first PM software designed for human + AI hybrid teams.

### M23 — Change Request entity + impact-driven workflow

**Goal:** PMBOK §4.6 implemented natively. New `ChangeRequest` entity captures scope changes with rationale + business value. System auto-computes impact on iron triangle (scope, schedule, cost) + risk delta. CR routes through CCB, on approval auto-applies cascade.

**Definition of done:** Submit CR from any entity → impact panel computes 3-parameter delta → route to configured approvers → on approve, auto-apply with audit log entry. CR list and Change Log accessible per project.

### M24 — Configurable CCB + risk-realization auto-CR

**Goal:** Settings page configures CCB approver chain (per-project levels, default OOTB chain). Risk transitioning open → realized auto-generates a CR using the risk's mitigation cost / schedule estimate as the impact baseline.

**Definition of done:** Settings page has a Change Control section with configurable approver levels. Changing a risk to "realized" pops the CR submission form prefilled with the risk's data. Closes the loop on unplanned change handling.

### Deferred to a later round (not currently slotted)

- CSV / Excel import + project templates (originally M18 — useful for onboarding new projects but lower urgency than the cascade/export/EVM track)
- Comments + activity feed (per-entity discussion threads)
- Report executive commentary + snapshots
- Buffer consumption visualization (Critical Chain Method discipline — needs effort estimates first)
- Resource leveling (depends on M20 timesheets)

### Beyond M20 — Path C platform decisions (not scoped yet)

These are not modules yet — they're the architectural decisions Path C requires before any pharma can put real data in the tool. Each is its own multi-session effort with an ADR:
- Backend choice (Supabase / self-hosted Postgres) — needs new ADR replacing ADR-006
- Auth + SSO (Supabase Auth or Clerk + SAML/OIDC) — needs new ADR
- Veeva Vault API integration (for validated doc + e-sig handoff) — feasibility study first
- Audit trail (immutable change log) — schema design
- SOC 2 + cert-prep documentation (internal, not user-facing) — separate doc trail
- GxP validation package authoring (IQ/OQ/PQ for the tool itself if anyone uses it for GxP data) — separate doc trail

---

## 5.2 — Tech-debt index

Live ledger of architectural debt + shortcuts. Reviewed at every checkpoint (per §9.9). Each item: when accumulated · severity · proposed module to clear · current status.

| Item | Severity | Origin | Proposed clear | Status |
|---|---|---|---|---|
| Per-grid local state for entities | High | M3+ | M20.2 | ✅ **Cleared M20.2** |
| No central audit trail / dispatch | High | M3+ | M20.2 | ✅ **Cleared M20.2** |
| Persistence shape coupled to UI shape | Medium | M16.1 | M20.2 (`EntityRepository<T>`) | ✅ **Cleared M20.2** |
| Validation rules are per-form only | Medium | M14 | M20.2 (`project-validator`) | ✅ **Cleared M20.2** |
| Mock-data field additions require Python backfill scripts | Low | M14.1, M15 | Could codify into a migration helper; not urgent | Pending |
| Two XLSX libs side-by-side (`xlsx` + `xlsx-js-style`) | Low | M19 | Migrate M7 reports to xlsx-js-style; drop xlsx dep | Pending |
| `CommandPalette` reads localStorage directly | Low | M17 | Refactor to consume store | Still pending — M21+ |
| `NotificationBell` derives from raw mockData not localStorage | Low | M16.1 | Same — consume store | Still pending — M21+ |
| No undo/redo UI on cascade | Medium | M18 | Hook into action dispatcher | Still pending — M23+ |
| **Drawer rendering coupled to engine output** | Medium | M18 → M20.7 surfaced | Introduce `CascadeDisplay` layer between engine + drawer | **M21-Checkpoint decided: defer** (see ADR-005 in §3) |
| **`tasks-grid.onApply` had two hidden error paths** (cycle blocked save; cycle short-circuited drawer rendering) | Was P0 — caused user-visible bug | M18 → M20.7 fixed | M20.7 commit `f8ef193` | ✅ **Cleared M20.7** |
| **No cycle prevention at task-form dependency picker** | Was Medium | M14 (no validation on dep set) | M21-Checkpoint cycle-prevention | ✅ **Cleared M21-Checkpoint** |
| **`milestone-form` has no similar cycle prevention on predecessor field** | Low (single-predecessor model makes it much harder to introduce a cycle) | M3+ | Same pattern can apply; not urgent — milestone cycles never observed in dogfood | Pending |
| Mock-data milestone seed lacks a Go-Live anchor for `scheduleBackward` testing in some projects | Low | M15 | Add a deterministic terminal milestone per project | Pending |
| Test files use overlapping `import` statements in two places (`scheduling.test.ts`) | Cosmetic | M20.1 | Consolidate into a single top import block | Pending |

A new module that **introduces** debt must log the item here. A checkpoint module that **clears** debt updates the status column.

---

## 5.3 — Design tokens & tone semantics

These are non-negotiable across the app. Vineet codified them in M20.3 after observing that the M14.1 cross-entity warning toasts felt alarming when they should have been informational. Tone is half of perceived quality.

| Tone | Used for | Tailwind base | When to use |
|---|---|---|---|
| **rose** | Blocking violation, hard error, missed deadline | `rose-50` bg + `rose-200` border + `rose-700` text | Constraint violation that requires PM action to clear (FS rule break, milestone past go-live, overdue task) |
| **amber** | Soft conflict, requires consideration | `amber-50` bg + `amber-200` border + `amber-700` text | At-risk milestone, due-soon task, budget approaching threshold |
| **blue** | Informational, opportunity, awareness | `blue-50` bg + `blue-200` border + `blue-700` text | **Slack created**, schedule headroom found, project ahead of plan, project metadata. **NOT for warnings.** |
| **emerald** | Success, resolved, on-track | `emerald-50` bg + `emerald-200` border + `emerald-700` text | Task complete, decision approved, milestone met on time, "all clear" empty states |
| **slate** | Neutral, no signal | `slate-100` / `slate-600` | Default text, draft status, unscheduled items, supporting metadata |
| **violet/indigo/primary** | Active selection, in-progress, primary action | `primary` token (deep indigo) | Active project, in-progress status, primary CTA buttons |

Apply consistently across:
- **Sonner toasts** — `toast.error` (rose), `toast.warning` (amber), `toast.info` (blue), `toast.success` (emerald). Never use `toast.warning` for opportunity information; never use `toast.success` for actions that succeeded-but-left-a-problem.
- **Card borders + section fills** — rose for violations, blue for info-summary boxes, emerald for "no issues" empty states.
- **Badge pills** — colour matches the status semantics, not the entity type.
- **Drawer sections** — Impact / Warnings / Info each get a tone-classified header.
- **Notification bell** — info items get a blue dot (not red); only blocking issues drive the red count.
- **Project Health card** — high severity = rose, medium = amber, low = slate (NOT rose).

Avoid mixing tones in a single message. If a save succeeded but left a problem, the surface is the impact drawer (which can show both the change you made AND the issue that needs attention) — not two competing toasts.

---

## 6 — Known issues being managed

| Issue | Mitigation |
|---|---|
| Claude has no cross-session memory | This document is the persistent memory. Read it every session. |
| Claude tends to drift into building new things | Section 4 (Current Module) is the only thing being worked on. Anything else goes to section 7. |
| Claude tends to hallucinate scope (e.g., proposing multi-tenant SaaS) | All architectural decisions are in section 3. Re-debating them requires a new ADR row. |
| Claude tends to optimize for "produce something this session" | Each module has a Definition of Done. Sessions don't end without it. |
| Claude can't run code autonomously between sessions | Vineet runs `pnpm test` and `pnpm dev` and reports results. Claude does not assume. |
| v1 has comma-separated reviewer strings (the limitation that started this rewrite) | M5 fixes this with proper Decision rows. Until then, v1 stays as-is. |
| Seed task data has a dependency cycle (T1 → T3 → T4 → T5 → T6 → T7 → T8 → T13 → T14 → T15 → ...) | Discovered during M20.7 dogfood. Cascade engine correctly detects + the caller now gracefully skips propagation while still saving the originator. Underlying data cleanup deferred — the engine fix unblocks usage regardless of seed cleanliness. |

---

## 7 — Backlog (captured ideas, not in current scope)

When Claude or Vineet has an idea mid-session that isn't part of the Current Module, it goes here. Only items in section 5 are being worked on.

- Dashboard click-through: milestone rows → /milestones, doc rows → /documents, KPI cards → detail views (wire in M4/M5 naturally)
- AI assist for generating milestones from system + methodology
- Excel import (MS Project XML, MPP files)
- Multi-user collaboration (requires backend)
- Email notifications (requires backend)
- Audit log UI
- Custom field types
- Resource management view
- Veeva Vault integration
- Real authentication (Supabase Auth or Clerk)
- Mobile native apps
- SOC 2 audit prep

---

## 8 — Last Session Log

> Newest entries at the top. Each entry: date, what was worked on, what was decided, what was committed, what's next.

### Session — 2026-05-18 (M25 — Decisions register)

**Strategic context:**
Following M24 (Issues register), continued the RAID coverage by adding Decisions. Pharma audits + SteerCo reviews routinely request the decision log — without it, you reconstruct from meeting minutes. M25 makes it a queryable register with full audit-trail fields (alternatives, rationale, supersession chain).

**Built:**
- **`DecisionRecord` entity** in `lib/mockData.ts` (13 fields). Named to avoid collision with existing `Decision` value type used for document RACI rows.
- **5 realistic seed decisions** for Veeva RIM — vendor pick (Iron Mountain), validation methodology (GAMP 5 Cat 4), training delivery format (hybrid), initial Go-Live date (Superseded), revised Go-Live date (Approved, supersedes d4). The d4 → d5 supersession demonstrates the chain UX.
- **Entity store slice** following the M20.2 pattern + `LocalStorageRepository<DecisionRecord>` + `decision` added to `EntityKind`. Audit log captures every save.
- **`/decisions` route** with `DecisionsGrid` — card-based layout (richer than Issues' table because decisions have more narrative content). Filter by status + Mine. Counts pill showing Approved / Pending / Rejected / Superseded.
- **Card UI** — each decision card shows ID + status pill + decided date/by + title + truncated context + Chosen Option + alternatives-count + supersession trail when applicable.
- **`DecisionFormDrawer`** mirrors the Charter form pattern (list-of-strings for alternatives, optional linkage fields to milestone/risk/issue). Required-field validation per `error-message-pattern` skill — every error names the missing field + explains why it's needed for audit trail.
- **Sidebar nav** — new "Decisions" entry under DOCUMENTATION (semantically closer than RISK & FINANCE; Decisions are the audit record).
- Tone discipline: slate Pending · emerald Approved · rose Rejected · muted slate Superseded.

**Decided:**
- **Card layout, not table** — decisions have richer content (context paragraph, alternatives list, rationale) than fit a row. Cards present the narrative cleanly; tables would force severe truncation.
- **Supersession is bidirectional in UI** — each card shows both directions (this supersedes X, this is superseded by Y) when applicable. Lets the PM read the full chain from either end.
- **Status order in sort** — Pending first (action needed), then Approved (current), then Rejected, then Superseded at bottom (historical context only).
- **`DecisionRecord` naming** — keeps the existing per-reviewer `Decision` value type on documents (RACI) untouched. Refactor to unify naming would be M-future.

**Pending:**
- Commit + push.
- Dogfood — view d4 → d5 supersession chain, record a new decision linking to a risk/issue, change a Pending → Approved, verify audit log captures all.
- M-future candidates: Assumptions register (4th RAID element), Decisions Excel export, supersession deep-link navigation, decision approval workflow (multi-signoff).

**Followup observations:**
- Build: 17 → 18 static pages. `/decisions` 5.73 kB. Within budget.
- `cross-entity-parity` skill earning its keep — DecisionFormDrawer mirrors Charter's list-of-strings pattern + Issue's linkage selectors, no new patterns invented.
- Plain language audit pass: "Decided by" / "Chosen option" / "Alternatives considered" — no PMBOK jargon leaked.
- Skill chain working as designed: ui-string-audit caught 3 jargon-y phrases at write-time ("rationale-text-field" → "Rationale"; "supersedee-pick" → "Supersedes"; "tagged" → "Linked").
- 133 pass / 4 skipped unchanged — no domain logic to test, pure CRUD on entity store.

### Session — 2026-05-18 (M24 — Issues register)

**Strategic context:**
Cascade arc paused after M23.1 (Vineet running Codex on a fork for external validation). M24 chosen as a clean break — new entity surface, no cascade interaction, exercises `cross-entity-parity` against the existing Risk pattern. Issues are PMBOK §13 stakeholder/issue management coverage we'd been missing — every audit and SteerCo review asks "what's open right now?" and currently we'd have to dig through meeting notes.

**Built:**
- **`Issue` entity** in `lib/mockData.ts` (12 fields, 1:N with Project): id · title · description · raisedDate · severity (Critical/High/Medium/Low) · status (Open/In Progress/Resolved/Won't Fix) · owner · resolutionPlan? · resolvedDate? · milestoneId? · taskId? · projectId.
- **5 realistic seed issues** for Veeva RIM — vendor metadata extract blocker (Critical), UAT environment slip (High), training-deck legal review (Medium), retired-SOP reference (Medium, resolved), submission template approver field (Low, resolved).
- **Entity store slice** following M20.2 pattern + `LocalStorageRepository<Issue>` + `issue` added to `EntityKind`. Hydration extended.
- **`/issues` route** with `IssuesGrid` — flat table view (no probability×impact matrix; that's a Risk thing). Filter by severity + status + owner + Mine. Counts pill showing open / resolved / critical-to-clear.
- **`IssueFormDrawer`** mirrors task/risk drawer pattern. Required-field validation per `error-message-pattern` skill. Conditional resolved-date field when status=Resolved/Won't Fix. Optional linkage to milestone or task.
- **Sidebar nav** — new "Issues" entry under RISK & FINANCE (AlertOctagon icon) next to Risks.
- Tone discipline: rose Critical · amber High · slate Medium/Low · rose Open · blue In Progress · emerald Resolved · slate Won't Fix.

**Decided:**
- **Issues distinct from Risks** — Risks model probabilistic future events (prob × impact); Issues model certain current problems (severity only). Different scoring, different lifecycle.
- **Sidebar grouping under RISK & FINANCE** — natural pairing with Risks; PM mental model treats both as "things to track."
- **No cascade interaction** — Issues don't shift dates by design. They surface problems; they don't propagate them through the schedule.
- **Deferred to M24.1+**: Issue Excel export sheet, dashboard card, Project Health validator rule (critical-issues-open SLA), issue↔risk linkage UI, RAID unified register.

**Pending:**
- Commit + push.
- Dogfood — raise an issue against M11 milestone, change status to Resolved with resolution plan, verify audit log entry.
- M-future candidates: Decisions register, Assumptions entity, Change Request workflow, RAID unified view, Codex cascade-comparison review.

**Followup observations:**
- Build: 16 → 17 static pages, `/issues` 7.42 kB. Within budget.
- `cross-entity-parity` skill paid off — Issue form drawer mirrors Risk + Task drawers structurally; no new patterns invented.
- `ui-string-audit` caught two would-be jargon strings during authoring: "issue ID" → "issue identifier"; "tagged to" → "linked to".
- 133 pass / 4 skipped unchanged (no tests added — Issues have no domain-logic that needs verification; pure CRUD on entity store).

### Session — 2026-05-18 (M23.1 — Workbench density, research-backed)

**Strategic context:**
Vineet's M23 dogfood at scale: workbench works at 11 edges but won't scale to 30–80 edges typical for a real Veeva project. He explicitly asked for *research, not opinion* — referenced UI books, papers, comparable products. Spent the search budget on 5 high-yield queries covering Shneiderman's foundational mantra, edge-density research, Primavera/MS Project/NDepend industry patterns, and Monday/Miro/ClickUp 2026 best practices.

**Built (three changes, all backed by cited research):**

- **Pattern 1 — Loop overview line at top** (Shneiderman 1996 *"Overview first"*).
  Single horizontal scrollable text line showing the loop's shape: `T1 → T3 → T4 → … → T15 ⇢ T1`. Closing back-edge styled distinctly (amber, "closes here" label). PM sees the whole problem in one glance before reading detail. New `LoopOverview` sub-component, ~40 lines.

- **Pattern 2 — Search + workstream filter + cross-workstream toggle** (Shneiderman *"Zoom and Filter"*, Primavera P6 WBS-grouping convention).
  Search input with fuzzy match on task name / ID / workstream. Dropdown to filter to one workstream. Toggle to surface only cross-workstream edges (research insight: cross-boundary edges are usually the accidental ones; internal workstream edges usually intentional). "Clear filter" link when active. Empty state: "No links match · clear filter to see all".

- **Pattern 3 — Suggested-first split + compact rows + inline expansion** (Shneiderman *"Details on Demand"*, NDepend cycle UX, Linear/Notion disclosure patterns).
  Suggested back-edge stays as full card at top under "⭐ Suggested fix · most likely to resolve cleanly". Other edges become single-line compact rows showing ID pair + truncated names + workstream chip (slate for same-workstream, blue for cross). Click row → expands inline to full card with three actions + note. Second click or "Collapse" → collapses.

**Decided:**
- **Shneiderman's mantra is the explicit design framework** — 8,000+ academic citations; applies to ALL info-viz problems including ours. Future modules that touch dense data should default to this framework.
- **Workstream grouping is industry convention, not opinion** — Primavera P6 groups by WBS; we group by workstream. Researched + confirmed.
- **No node-link / force-directed graph rendering** — explicit research-backed deferral. Edge crossings + clutter scale poorly above ~50 nodes per Weber's law studies. Adjacency matrix (NDepend pattern) noted as M24+ candidate if 1000+ edge cases ever surface.
- **Cross-workstream toggle is the key density-management lever** — accidental cross-boundary edges are the high-yield filter for resolution; surfacing them by default would be too opinionated, but as a one-click toggle it adds real value.

**Pending:**
- Commit + push.
- Dogfood — the 11-edge loop from Vineet's data should now render with: loop overview line at top, suggested-fix card, 10 compact rows. Search-filter for "configuration" should narrow it. Click a row → inline expansion with same actions as before.
- M23.2 candidate: task dependency picker upgrade (separate surface from workbench).

**Followup observations:**
- `/tasks` 8.34 kB — bundle size flat post-density-rewrite (gzip dedupes string boilerplate across components).
- Pure UI module. No engine touched. 133 pass / 4 skipped unchanged.
- Skills active: `ui-string-audit` (every new string passed without rework), `tone-discipline` (amber suggested, slate compact rows, blue cross-workstream chip — no rose), `focused-read` (used `grep` then targeted `Read` slices instead of reading the 800-line drawer file whole).
- Research-backed deferrals captured in DoD Out of scope — future Claude will know these were rejected with citations, not oversight.

### Session — 2026-05-17 (M23 — Dependency Resolution Workbench Phase 1)

**Strategic context:**
M21-DrawerRewrite's amber callout was honest about the cycle but offered only a flat task list. Vineet's framing: enterprise app, digital adoption ready, layman language, "we must think and understand how a algorithm is created" — M20.4-pattern: spec the algorithm first.

**Built:**
- **Algorithm** — `findCycleEdges(tasks)` in `lib/domain/scheduling.ts`. DFS with three-color marking; returns `CycleInfo { edges, taskIds }` or null. Last edge always `isBackEdge=true`. 7 unit tests cover self-loop, 2-node, 11-node real shape, multiple cycles, cycle-with-tail, no-cycle, name population. 1 engine test asserting `parallelDeps` doesn't trip cycle detection or FS enforcement.
- **Data model** — `Task.parallelDeps?: string[]` and `Task.depNotes?: Record<string, string>` sidecar fields. Non-breaking. Engine ignores both (only `dependsOn` participates).
- **`CalloutSection.dependencyLoop`** — new optional field carrying `WorkbenchEdge[]` + three handlers (`onMarkParallel`, `onRemoveLink`, `onSaveNote`).
- **`DependencyWorkbench` + `WorkbenchEdgeCard` sub-components** in `impact-drawer.tsx`. Plain-language framing ("waits on", "Change to parallel", "Remove this link", "Add note"). Suggested-fix edge gets amber ring + "Suggested" badge. Per-edge note textarea collapsed by default.
- **`tasks-grid` workbench wiring** — three handlers update the originating task via `updateTask` with audit-log notes. Toasts confirm each action with plain-language description.
- **Drawer `useMemo` fix** — added `recompute` to dep array so workbench actions trigger drawer re-render with fresh edges.

**Decided:**
- **Option A (sidecar fields) for data model** — non-breaking; if `parallelDeps` becomes heavily used, refactor to typed array in future checkpoint.
- **"Suggested" badge kept on DFS back-edge** — soft signal, not forced. PM can resolve any edge.
- **Workbench shows full chain, no disclosure** — PM sees everything at once per Vineet's "first details out" framing.
- **Marking parallel == one resolution path** — moves edge from `dependsOn` → `parallelDeps`, breaks the loop, drawer recomputes.
- **No multi-cycle proactive listing** — drawer naturally surfaces next loop (if any) after a resolution; no surprise.

**Pending:**
- Commit + push. Dogfood the workbench against the 11-task loop from the screenshot.
- M23.1 candidate: per-edge inline cascade-impact preview ("changing this would shift N tasks").
- M24 candidate: per-task DAG visualisation (Veeva-style cross-entity dep view).

**Followup observations:**
- Algorithm-first pattern (M20.4) again caught a real issue at the design layer — the engine's existing `topoSortTasks` returned only the unresolved node set, not traversal order. New DFS function fills that gap cleanly.
- The `recompute` useMemo gating was a latent staleness bug since M20 — fixing it as part of M23 also fixes any future "drawer-stays-open-while-store-changes" scenario.
- `/tasks` 7.96 → 8.34 kB (+0.38 kB) for workbench rendering. Within budget.
- 124 → 133 tests passing. 4 skipped unchanged.

### Session — 2026-05-17 (M22.2 — architectural skill expansion)

**Strategic context:**
M22.1's three bugs all evaded the M21 quality skills because those skills target surface concerns (strings / colors / errors). The bugs were architectural — parallel save paths diverging, guards conflating pre-existing with user-caused state, cross-entity asymmetries. M22.2 adds three skills that operate at the code-structure layer + formalises use of the built-in `simplify` / `review` skills before architectural commits.

**Built:**
- `.claude/skills/save-flow-parity/SKILL.md` — fires on `*-grid.tsx` save handlers and `*-form.tsx` save flows. Includes the project's grid/form pair inventory + verification checklist. References M22.1 #1 as canonical failure case.
- `.claude/skills/pre-existing-state-distinction/SKILL.md` — fires on any guard / validator / detector / corrector. Codifies the baseline-vs-hypothetical pattern with four-quadrant decision tree. References PL-11 and M22.1 #2 as canonical failure cases.
- `.claude/skills/cross-entity-parity/SKILL.md` — fires on any change to entity-specific behaviour. Includes the entity-surface feature matrix (12 rows × 6 entities) tracking which behaviour exists where. Distinguishes intentional from accidental asymmetry.
- `.claude/skills/README.md` extended — three new entries + section on built-in `simplify` / `review` skills for architectural-commit review.
- `CLAUDE.md` extended — pre-commit discipline: invoke `simplify` on the diff before committing architectural modules.

**Decided:**
- **Architectural skills as separate category, not embedded in quality skills** — quality skills stay focused on surface concerns; architectural skills cover code-structure. Cleaner separation, easier to maintain individually.
- **Entity-surface feature matrix in `cross-entity-parity`** — explicit table of which entity has which behaviour. Maintained as part of the skill. Forces deliberate decisions about asymmetry.
- **Built-in `simplify` skill enforced via CLAUDE.md, not as a wrapper skill** — simpler to instruct (CLAUDE.md is the per-session protocol) than to author a meta-skill that invokes another skill.

**Pending:**
- Commit + push. M23 candidate: Change Request workflow (PMBOK §4.6) — natural successor to Charter; builds on M20.2 audit log + Charter approval semantics. Other candidates: RAID register, M19 exporter Charter-sheet, milestone-form cycle prevention parity.

**Followup observations:**
- No code changes this session — pure docs + skills. 124 pass / 4 skipped unchanged. Build clean.
- All 11 skills now live under `.claude/skills/`. Total markdown content ~25 kB; cost to read at session start is small once `session-bootstrap` is applied (skills are read lazily based on context, not all-at-once).
- The honest skill assessment in §8 of M22.1 directly drove M22.2's scope. The §8 capture-decisions discipline working as designed.

### Session — 2026-05-17 (M22.1 — architectural-consistency hotfix)

**Strategic context:**
M22 deployed; Vineet dogfooded and surfaced three bugs the M21 quality skills couldn't catch — they're scope-limited to strings / colors / error structure, not behavioural-parity / pre-existing-state / cross-entity consistency. Honest assessment of the gap + targeted fixes.

**Built:**
- `milestones-grid.handleDrawerSave` now detects planned-date change; saves non-cascade fields immediately and routes the planned-date shift through `handlePlannedDateChange` (same flow as inline date click). Form-drawer save behaviour now matches inline-edit behaviour for cascade.
- `task-form.tsx` cycle guard rewritten: compare `topoSortTasks(baseline)` vs `topoSortTasks(hypothetical)`. Only block save when hypothetical has a cycle that baseline did not. Pre-existing cycles in stale data no longer block legitimate edits (parallel to PL-11 engine semantics).
- Forecast-date changes (both inline `handleForecastDateChange` and form `handleDrawerSave`) emit `toast.info` with working-day variance when |variance| ≥ 14 WD. Replaces silent saves on big slips.

**Decided:**
- **All three fixes follow patterns already in the codebase** — no new types, no new skills, no engine changes. Cascade preview route, baseline-vs-hypothetical comparison, working-day variance — each used elsewhere already. This was a parity-and-distinction gap, not a missing primitive.
- **Honest skill assessment** — current quality skills (string / tone / error-pattern) are surface-layer. They wouldn't have caught any of these three. Need architectural skills next: `save-flow-parity` (compares parallel code paths across grid/form pairs), `pre-existing-state-distinction` (forces baseline-vs-edit thinking on every guard), `cross-entity-parity` (when changing tasks-grid, check milestones-grid for symmetric behaviour). Plus start using the built-in `simplify` and `review` skills before architectural commits.
- **M22.2 = new skills + start using existing built-in skills.** Scoped after M22.1 dogfood.

**Pending:**
- Commit + push M22.1.
- Dogfood — try the three scenarios from Vineet's screenshots: form-drawer planned-date edit (should now open cascade preview); task save with no cycle introduction (should now succeed even when stale graph has cycle); forecast change to far-future date (should show variance toast).
- M22.2 candidate: architectural-skill expansion + commit-time built-in skill invocation.

**Followup observations:**
- All three bugs were the same class: "code makes an assumption about the data/state that doesn't hold." Form-save assumed users only change non-cascading fields; cycle guard assumed any cycle is user-caused; forecast change assumed silent save is enough. Each assumption was wrong against real PM usage.
- `/milestones` 11.6 → 11.8 kB, `/tasks` unchanged. Within budget.
- The `topoSortTasks` engine helper is now consumed by both cascade preview (M20.1) and form-cycle guard (M21-Checkpoint, M22.1). Reuse pattern working.

### Session — 2026-05-17 (M22 — Project Charter)

**Strategic context:**
21 modules of execution surfaces shipped, no Charter. PMBOK §4.1 puts charter first — it authorises everything else. Vineet greenlit moving past cascade-arc and starting feature work; recommended Charter as the clean break.

**Built:**
- `Charter` entity type in `lib/mockData.ts` (15 fields, 1:1 with Project). Seeded for both projects: full pharma RIM content for the active project, lean draft for PromoMats.
- `CharterStatus` lifecycle: `draft` → `submitted` → `approved`. Tone-pill colors per §5.3: slate / amber / emerald.
- Entity store slice (`addCharter`, `updateCharter`, `deleteCharter`, `replaceAllCharters`) + `LocalStorageRepository<Charter>` + `charter` added to `EntityKind` union. Hydration extended.
- `/charter` route at `app/(app)/charter/page.tsx` with project-scoped CharterView. Empty state when no charter exists, with "Create charter" CTA.
- `CharterView` component — header card (status pill, sponsor, PM, go-live, budget) + sections for purpose, objectives, scope (in/out), success criteria, assumptions, constraints. Approved state shows signoff bar.
- `CharterFormDrawer` — required-field validation, list-of-strings fields with add/remove, conditional approval-fields when status=approved.
- `CharterCard` on Dashboard — compact status surface with sponsor + go-live + last-updated. Click-through to /charter.
- Sidebar nav: new "Charter" entry under PLANNING above Milestones (Scroll icon).

**Decided:**
- **Charter is its own entity, not fields on Project** — enables future multi-version history (M23+) without schema migration, follows M20.2 pattern, gives audit log specific Charter actions.
- **1:1 with Project, id = `charter-{projectId}`** — deterministic id makes lookup trivial, avoids the orphan-charter case.
- **Status lifecycle with conditional approval-fields** — approval requires both `approvedBy` + `approvedDate`; form enforces this at save-time per error-message-pattern skill.
- **Tone discipline applied throughout** — slate for draft (neutral), amber for submitted (consider), emerald for approved (resolved). No rose anywhere (charter is never an error state).
- **Sidebar position: under PLANNING, above Milestones** — charter is the planning anchor; everything downstream references it.

**Pending:**
- Commit + push. Dogfood — view existing charter (Veeva RIM, approved); switch to PromoMats project (draft); edit purpose / add an objective; toggle status to approved + provide approver name + date.
- M22.1 candidate: Charter sheet in M19 exporter, multi-version history, approval workflow with signoffs.

**Followup observations:**
- Build: 15 → 16 static pages, `/charter` 7.94 kB, dashboard `/` 101 → 103 kB (CharterCard).
- Quality skills active throughout — purpose paragraph + objectives use plain language; no "entity" / "dispatch" jargon leaked. The "preview unavailable" pattern from M21-DrawerRewrite was reused for the empty state framing.
- Seeded the Veeva RIM charter with realistic GAMP 5 / EMA xEVMPD / FDA eCTD content — feels like real PM content, not lorem ipsum.

### Session — 2026-05-17 (M21-DrawerRewrite — cascade impact drawer information design pass)

**Strategic context:**
Vineet's M20.7 dogfood (screenshots): cycle-state drawer is the worst surface in the product — all-rose for partial success, dev jargon, broken template grammar, no next-step. First module landing with project skills active (`ui-string-audit` + `tone-discipline` + `error-message-pattern`).

**Built:**
- New `callout` section kind in `ImpactDrawer` (`CalloutSection` type + `Callout` sub-component, ~80 lines). Tone-matched (amber / blue / slate), title + body + collapsible items + optional action button.
- Tasks-grid cycle-error path rewritten — single amber callout replaces the prior warnings-row + duplicate-task-rows pair. Plain-language body, cycle members in a collapsed disclosure, "Open Tasks page" action.
- Drawer header copy: "Schedule change preview" / "Review what will change. Uncheck a row to keep its date, or pick a different date inline." (Drops "cascade impact" jargon.)
- Totals strip cleanup: "Nothing else changes" (slate) / "N of M included" (amber) / "preview unavailable" (amber on callout) / "K to review" / "P edited" / "S gained slack" — all per skill conventions.
- Save button label: "Save" / "Save · N changes" / "Save change" (callout). Drops "Apply edit" jargon, drops "shifts" in favor of "changes".
- Empty-state copy: "Nothing else will change · Save to apply this change."
- Toast rewrite: cycle-saved toast now "Saved · downstream preview unavailable" + description with what/why/next.

**Decided:**
- **Callout is a separate section kind, not a flag on existing kinds** — cleaner type contract; lets callouts render without a `.rows` array.
- **Amber tone for cycle-blocked state** — partial-success per §5.3 tone discipline. Rose was wrong (it's not a blocking failure; the edit saved).
- **Action button on callout** — every error must have a next-step per `error-message-pattern` skill. "Open Tasks page" is the resolution path.
- **Cycle members in collapsed disclosure** — they're identification, not action; collapsing hides them by default and gives them a quiet read-only render on expand.

**Pending:**
- Commit + push. Dogfood — try the same cycle scenario from yesterday; the drawer should now read cleanly.
- M22 candidate: Charter / WBS / RAID register (per §5.1). Charter is recommended.

**Followup observations:**
- Skills fired correctly during the rewrite — caught two jargon strings ("cascade impact" header, "Apply edit · shifts" button) at write-time rather than dogfood-time. Validates the M21-Checkpoint skill investment.
- Milestone-grid cycle-error path wasn't touched (milestone cycles are rare via single-predecessor model). If a real case surfaces, same callout pattern applies symmetrically.
- Bundle delta: `/tasks` 7.62 → 7.91 kB (+0.29 kB for `Callout` component). Within budget.

### Session — 2026-05-17 (M21-Checkpoint — cascade arc retrospective + architectural audit)

**Strategic context:**
Per §9.9, every 4 feature modules earns a checkpoint. M20.2 was the last; we were 5 modules overdue. Vineet's post-M20.7 question — *"is design is right, so many patches we have done"* — made the checkpoint mandatory. Output: cascade arc audited honestly, one root-cause fix landed, tech-debt index brought current, design seam decided, M21 set from clarity.

**Built:**

- **Cycle prevention at task-form layer (the actual root cause of M20.7's symptom):**
  - Discovered while auditing the seed data: `mockData.ts` is **clean** — no cycle. The cycles Vineet was hitting came from his own UI edits in prior sessions, because `task-form.tsx` had no cycle-prevention on the dependency picker. M20.1 caught cycles in cascade; M20.7 made cascade resilient to cycles; but **the creation path was never closed**.
  - Added: forward-walk of `dependsOn` to compute the set of descendants of the edited task. Any descendant is a "cycle blocker" — disabled in the picker with rose `cycle` chip + hover hint. Save-time backstop using `topoSortTasks` on the hypothetical post-save graph; refuses save if cycle would result, naming the cycle members in the error.
  - 2 new tests in `scheduling.algorithm.test.ts §8 — M21-Checkpoint`: cycle-introduction detection, cycle-blocker descendant computation.

- **Test coverage scan:** all 8 spec sections in `CASCADE_ALGORITHM.md` have ≥1 passing test. PL-1, PL-5, PL-6, PL-9 remain skipped as documented gaps (PL-1 is intentional design; PL-5/6/9 are deferred). No coverage gaps found. **124 pass / 4 skipped, 128 total.**

- **Tech-debt index (§5.2) fully refreshed:**
  - 4 items confirmed ✅ Cleared from M20.2 (Zustand store, audit log, repository, validator)
  - 1 new ✅ Cleared from M20.7 (the cascade caller error paths)
  - 1 new ✅ Cleared from M21-Checkpoint (task-form cycle prevention)
  - 1 explicitly **Deferred via ADR** (the CascadeDisplay separation — see ADR-008)
  - 4 still pending (mock-data backfill, two-XLSX-libs, CommandPalette + NotificationBell store-coupling, undo/redo UI)
  - 4 new low-priority items added (milestone-form has no cycle prevention, mock-data seed missing some Go-Live anchors, two test-file import overlap, etc.)

- **ADR-008 — Defer `CascadeDisplay` separation layer.** Vineet's M20.7 post-mortem surfaced a real architectural seam (drawer rendering coupled to engine output; engine-error states need callsite fallbacks). After audit: the seam is real but only two consumers exist (tasks-grid, milestones-grid) and both fixed inline. A 150-line indirection layer for a benefit only the *third* consumer would feel = YAGNI. Decision is reversible if M21+ adds a third cascade-consuming surface.

- **Competitive re-scan (cascade specifically):**
  Where the cascade engine now sits vs the field:
  | Capability | Asana | Monday | Smartsheet | MS Project | Primavera P6 | **AivelloStudio** |
  |---|---|---|---|---|---|---|
  | FS dependency cascade | partial | no | basic | yes | yes | **yes (CPM-correct)** |
  | Cycle detection w/ named members | no | no | basic | yes | yes | **yes (cyclePath naming)** |
  | Selective cascade (exclude/override) inline | no | no | no | partial | no (separate workspace) | **yes** |
  | Working-day arithmetic w/ holidays | no | no | basic | yes | yes | **yes** |
  | Bidirectional task↔milestone push | no | no | no | partial | yes | **yes (transitive)** |
  | Formal spec doc with test matrix | n/a | n/a | n/a | proprietary | proprietary | **public (`CASCADE_ALGORITHM.md`)** |
  | Form-layer cycle prevention | no | no | no | yes | yes | **yes (M21-Checkpoint)** |
  | Constraint types beyond FS (SS/FF/SF, lag on tasks) | no | no | no | yes | yes | no — deliberately out of scope |
  | Resource leveling / Monte Carlo | no | no | no | yes | yes | no — out of scope |
  
  **Honest read:** we now match or exceed Asana / Monday / Smartsheet on every cascade dimension, and exceed all four on selective-cascade inline UX (the wedge). We're behind MS Project / Primavera on constraint types and resource leveling, both intentional (separate modules if ever needed). The CPM-correctness + browser-light + PM-controlled-cascade combination is genuinely differentiated.

- **LEARNINGS.md properly committed.** Originally drifted in with M20.7's commit; now anchored as a permanent reference. CLAUDE.md updated to point at it for cross-cutting session work.

- **§6 (Known issues being managed)** updated with the seed-data cycle entry from M20.7.

**Decided:**
- **The design IS right.** Nine sub-modules on cascade isn't excessive for the hardest feature in any PM tool. Each addressed a real category (UX, cycle detection, architecture, bidirectional, formal spec, engine gaps, polish, resilience, creation prevention). The pattern of iteration reflects depth of usage, not failed design.
- **One real architectural seam noted, deliberately deferred** (ADR-008). Not all seams need fixing — some are just acknowledged.
- **M20.7 is the cleanest possible close to the cascade arc.** The form-layer cycle prevention added this session removes the path that creates the very state M20.7 had to handle defensively. Defence-in-depth: M20.7 handles bad data; M21-Checkpoint prevents bad data from being created in the first place.
- **Next module: M21 — Charter** (proposed). Per §5.1, candidates were Charter / WBS / RAID register. Charter wins because: (a) it's the document that frames every other PM artifact — without a charter, scope creep is structurally easy; (b) it's a single-doc surface with low cascade-engine interaction (good break from the cascade arc); (c) PMBOK §4.1 explicitly puts charter first. Alternatives: if Vineet prefers, WBS (work breakdown structure, complements existing milestones / tasks / workstream model) or RAID (Risks / Assumptions / Issues / Decisions register — extends existing risks surface). All three are viable; charter is my recommendation. Vineet locks the choice next session.

**Test + build:**
- 124 pass / 4 skipped (added 2 cycle-prevention tests). Build clean. `/tasks` 7.58 → 7.62 kB (form cycle picker logic). `/milestones` unchanged.

**Followup observations:**
- **The checkpoint itself paid off.** Found and fixed the actual root cause (form layer) of the bug M20.7 fixed defensively (engine layer). Without the audit, the form-layer hole would have re-triggered the same bug class for any user who recreated a cycle.
- **Skipped tests are healthy.** PL-1 (intentional design), PL-5/6/9 (acknowledged defers). Zero "we forgot about this" skips. The discipline of `// PL-N` tagging worked.
- **Tone discipline §5.3 held across the cascade arc.** Every toast / badge / drawer section reviewed during the audit — no rose-where-blue or amber-where-emerald regressions.
- **The seam decision (ADR-008) is a discipline win, not a punt.** Naming "we decided NOT to refactor and here's why" prevents the seam from being silently re-debated every session. Future Claude (cold-start) will read ADR-008 and not propose CascadeDisplay unsolicited.

**Pending:**
- Commit + push M21-Checkpoint.
- Vineet picks M21 from {Charter, WBS, RAID register}.
- Dogfood the cycle-prevention picker in task-form (try to recreate the cycle that bit you yesterday — picker should disable the offending tasks).

### Session — 2026-05-17 (M20.7 — cycle-resilient cascade UX hotfix)

**Dogfood discovery:**
Right after M20.6 deployed, Vineet hit a hard bug: editing any task with dependencies in the chain `T1 → T3 → T4 → T5 → T6 → T7 → T8 → T13 → T14 → T15 → …` produced (a) a bare drawer showing only a red engine-error box (none of the M20.6 timeline / grouping / ancestry polish), and (b) on Apply, a `toast.error("Cannot apply cascade")` and the user's edit silently dropped.

**Root cause:** the cascade engine correctly detected a pre-existing dependency cycle in the seed/persisted data, but `tasks-grid` had two problems at the caller layer:
1. `onApply` hard-returned on any engine error — blocking the user's originator edit entirely.
2. The drawer's `recompute` short-circuited on engine error and returned only a warnings section — so M20.6's polished sections (mini-timeline, grouping, ancestry caption) never rendered.

Both symptoms had the same root cause. PM was held hostage by data inconsistencies they didn't create, and the drawer looked broken because the cycle blocked all the data the polish depends on.

**Built (not yet committed — pending Vineet review):**
- `tasks-grid.onApply` on engine error: still commits the originator edit through the store with audit note `originator saved; cascade skipped due to cycle in data`. Toast becomes `warning` not `error` — "Cascade skipped — cycle in dependency data · Your edit to {taskName} saved. Fix the cycle to enable downstream cascade."
- `tasks-grid` drawer recompute on engine error: parses cycle members from the error message and renders them as a `tasks`-kind section ("Tasks in the cycle (dates unchanged)") with each row carrying `ancestry: "in dependency cycle"`. M20.6's polish (timeline, ancestry caption, group headers) renders normally — just with `daysShifted: 0` since nothing actually shifts.
- `ImpactDrawer`: detects `engine-error` in any warnings section. Apply button label switches to `"Apply edit (cascade skipped)"` so the PM knows exactly what they're getting.
- Test PL-12 in `scheduling.algorithm.test.ts` asserts the engine's cycle contract callers rely on (error non-null, affected empty, tasks slice of input).
- `CASCADE_ALGORITHM.md` §10 punch list: PL-12 added as P0 ✅ M20.7 Resolved.
- Operating doc §6 (Known issues being managed): seed-data cycle entry added.

**Decided:**
- **Caller-side fix, engine unchanged.** The engine's cycle contract was correct (and is now formalised by PL-12 test). The bug was in how tasks-grid interpreted the engine's "I can't cascade" signal — it conflated "can't cascade" with "can't save."
- **Save originator on cycle, but skip propagation.** Two responsibilities; only one needs the engine. The PM's explicit edit is theirs to save; the engine is only consulted for downstream propagation. Untangling the two unblocks every legitimate edit.
- **Show cycle members on the timeline.** Even when the engine can't cascade, the drawer should still convey the scope of the problem visually. Cycle rows render with `daysShifted: 0` and `ancestry: "in dependency cycle"` — same visual language as a normal row, but honest about what's happening.
- **Audit log records cycle skips explicitly.** Future "why didn't t8 shift when I edited t1?" questions have an answer in the audit log: `note: originator saved; cascade skipped due to cycle in data`.

**Build + tests:**
- 122 pass / 4 skipped (+1 from new PL-12 test). `/tasks` 7.31 → 7.58 kB (cycle-state rendering, ~0.27 kB).

**Followup observations:**
- This is the kind of bug the formal spec (M20.4) was supposed to catch but didn't — because PL-9 ("user-introduced cycle should be distinguished from pre-existing") focused on messaging, not behaviour. Adjacent gaps are easy to miss when each PL item is narrowly scoped. Lesson for future spec exercises: ask "what behavior does the user expect when X happens?" before fixing the messaging.
- The cascade arc is now at M20.7 — nine sub-modules deep on one feature. Vineet asked in this session: *"so many patches we have done, is design is right"*. Honest answer: the design IS right; cascade is genuinely the hardest feature in any PM tool (PMBOK has chapters; MS Project / Primavera have decades of iteration on it). Each sub-module addressed a real category — basic UX, cycle detection, architecture, bidirectional, formal spec, engine fixes, polish, cycle resilience. The frequency of fixes correlates with usage depth, not design failure. After M20.7, the cascade is genuinely stable.

**Pending:**
- Commit + push M20.7. Dogfood the cycle-state drawer + the new Apply behaviour.
- Per §9.9, we're due an architectural checkpoint (M20.2 was the last). Suggested next module after M20.7 dogfood is a §9.9 checkpoint that includes: full cascade arc retrospective + test coverage scan + tech-debt review + LEARNINGS.md commit + seed-data cycle cleanup. Holds the discipline; gives Vineet a clear "we paused and audited" moment before M21.

### Session — 2026-05-17 (M20.6 — cascade impact drawer UX polish)

**Strategic context:**
Vineet's dogfood feedback after M20.5: *"i hope the whole cascading and all have better UI as well or its in later phase"*. Engine is now PMBOK-correct; drawer UX still functional rather than enterprise-looking. Four targeted UI changes turn it from "works" to "feels expensive". No engine changes.

**Built (not yet committed — pending Vineet review):**

- **Mini-timeline per row** (`MiniTimeline` in `components/ui/impact-drawer.tsx`):
  - Thin horizontal bar showing each affected row's old → new position on a shared axis scaled to the drawer's full date range
  - Grey tick = old position; colored solid pill = new position; colored segment connects them
  - Rose for forward shifts (slip), emerald for backward shifts (pull-in)
  - Dimmed when row is excluded
  - Pure CSS divs, no SVG library; ~50 lines

- **Workstream / phase grouping** (`renderShiftRows` + `GroupBlock`):
  - When any row in a section has a `group` field, the section renders collapsible sub-sections per group
  - Group header shows name + included/total chip (e.g. "Configuration · 3/5")
  - Default open; click to collapse
  - Single-group cascades stay flat (no header noise)
  - Tasks-grid passes `workstream` as `group`; milestones-grid passes `phase`
  - Warnings + info sections never group (they're flat by design)

- **Ancestry trace** for transitive milestone proposals:
  - New `ancestry?: string` field on `ImpactRow`
  - Tasks-grid sets it from PL-2 transitive-push data: `"T1"` for direct, `"T1 (via predecessor chain)"` for transitive
  - Renders as small italic caption under the row name: `← driven by T1`
  - Lets PM read "why is m7 in this list?" inline without a tooltip

- **Apply-count semantics fix**:
  - Old: `Apply ${included+1} of ${total+1} changes` — `+1` hack double-counts in edge cases
  - New: clean separation. `Apply edit` (no shifts) / `Apply edit only` (all excluded) / `Apply edit · N of M shifts` (mixed)
  - Originator is conceptually separate from selectable shifts; the label now reflects that

- **Bonus fixes during the rewrite**:
  - `shiftRows` filter now strictly counts milestones + tasks (info / slack rows no longer leak into shift totals — was a latent bug in M20.3)
  - Mini-timeline reads the live `overrides[id]` when computing the new-position marker, so PM edits to a row's date update the timeline visualization in real time

**Test + build:**
- 121 pass / 4 skipped — no test regressions
- `/tasks` 7.22 → 7.31 kB (+0.09 kB); `/milestones` 130 → 131 kB First Load. Within budget.
- No new tests added — drawer DOM tests would be brittle to design churn and the rendering paths are simple enough to verify visually.

**Decided:**
- **Mini-timeline as 1.5-px-tall bar, not a full Gantt strip.** Lightweight glance-value, not a full visualization. A full Gantt would compete with the Gantt view and bloat the drawer height.
- **Grouping is opt-in via the `group` field** rather than a flag — keeps the ImpactRow shape composable; future callers can choose to group or stay flat without an API change.
- **Ancestry is a short string, not a structured object.** Caller decides the wording. Drawer just renders. Avoids the drawer growing knowledge of which entity types can be ancestors of which.
- **Group collapse state is per-group local, not lifted.** Resets when drawer reopens — that's fine; cascade drawers are short-lived.

**Followup observations:**
- The drawer's section icons (Milestone / CheckSquare / Info / AlertTriangle) carry the kind affordance well; group headers don't need their own icon.
- Bundle delta is tiny because the new code reuses Tailwind classes already in use elsewhere.
- The mini-timeline's tooltips on the old/new markers (`title={...}`) give a precise ISO date readout without competing visual weight.

**Pending:**
- Commit + push M20.6 after Vineet reviews / dogfoods.

### Session — 2026-05-17 (M20.5 — cascade engine fixes PL-2 + PL-3 + PL-4 + PL-11)

**Strategic context:**
Same session as M20.4 — Vineet locked all four high-priority punch-list items for immediate fix (PL-2 + PL-11 are the two P0s flagged directly to SteerCo accuracy; PL-3 + PL-4 are the P1s affecting drawer display).

**Built (not yet committed — pending Vineet review):**

- **PL-3 (working-day shift display)**:
  - New `workingDaysBetween(a, b, workingDays, holidays)` helper in `lib/domain/dates.ts`. 6 new unit tests cover same-date, weekend-spanning, negative direction, holidays, custom working week.
  - Switched `daysShifted` to working days in `previewCascade`, `previewTaskCascade`, `previewTaskToMilestonePush`, and `findConstraintViolations.daysBehind`.
  - Updated drawer labels: "+5 WD" / "-3 WD" / "+N WD slack" so PMs read the unit explicitly.
  - Updated `daysShifted` at the milestones-grid and tasks-grid summary call-sites to use `workingDaysBetween` instead of `Math.ceil((newTime - oldTime) / 86_400_000)`.
  - `daysBetween` (calendar) still used by `computeRAG` (delay vs today — calendar is correct there) and remains exported for any future calendar-day consumer.

- **PL-4 (gate buffer on task→milestone push)**:
  - `previewTaskToMilestonePush` takes a new `opts.gateBufferWorkingDays?: number` (default `1`). Milestone's `proposedNewDate` = binding task's cascaded `dueDate` + `gateBuffer` working days.
  - Industry rationale: milestones represent gate reviews / approvals that happen *after* the final deliverable, not on its same day.
  - Configurable per-project (e.g. tighter `0` for self-approving milestones, or `2` for multi-day approval cycles).

- **PL-2 (transitive task→milestone push)**:
  - After computing task-driven milestone proposals, `previewTaskToMilestonePush` runs `previewCascade` on each proposed shift to find further milestones pushed by predecessor chains.
  - Transitive proposals are appended with `transitive: true` and inherit `drivenByTaskId` from the originating task-driven proposal — so the audit trail reads "m7 shifts because m6 shifts because task t1 pushed past m6".
  - M20.3's promise of "fully transitive" is now actually true. 3-hop test passes.

- **PL-11 (phantom-save guard)**:
  - Added `respectPreExisting?: boolean` opt to `CascadeOpts` (default `true`).
  - When the user's edit is a no-op (`originalDueDate === newDueDate`), `previewTaskCascade` short-circuits with `{ tasks: original, affected: [], error: null }`. Phantom saves no longer silently re-date downstream tasks with pre-existing violations.
  - Pre-existing violations remain visible via `findConstraintViolations` and the M20.2 Project Health card — engine reports, never silently fixes.
  - Real edits cascade fully — pre-existing violations downstream of a real edit do get auto-corrected because the edit is doing something. This matches PM intuition: "if I'm saving without changing, don't touch anything; if I'm meaningfully changing, settle the schedule".

- **Test matrix updated**:
  - 4 `it.skip` PL tests flipped to active `it()` tests, all passing.
  - 7 supplementary tests added: workingDaysBetween coverage (6), gate-buffer configurability (1), PL-11 real-edit-vs-phantom (2), respectPreExisting opt-out (1).
  - **Final state: 121 tests pass / 4 skipped (= PL-1 documented quirk, PL-5/6/9 deferred).**
  - Build clean: 15 static pages; `/tasks` 7.23 → 7.22 kB (rounding noise from helper additions).

- **Doc updates**:
  - `v2/docs/CASCADE_ALGORITHM.md` §10 punch list — PL-2, PL-3, PL-4, PL-11 marked ✅ M20.5 Resolved with one-sentence outcome.

**Decided:**
- **PL-11 = no-op detection, not pre-existing-violation suppression.** Initial implementation tried to detect every pre-existing violation and suppress its shift; broke fan-in tests because a real edit upstream genuinely should cascade through tasks that happen to have pre-existing violations. Simpler and more defensible rule: "click Save without changing anything = do nothing." Covers the user's actual complaint (phantom save).
- **Gate buffer default = 1 WD.** Smallest meaningful buffer; aligns with PMBOK's "milestone = gate after deliverable" framing without being aggressive. Configurable for projects that need 0 or 2+.
- **WD suffix in drawer ("+5 WD") rather than just "+5d".** Unambiguous unit. Long enough to read clearly, short enough to fit.
- **`respectPreExisting: false` is a caller opt-out, not a UI control.** The drawer always uses default `true`. Future use cases (one-off data cleanup pass, import settle, etc.) can opt out programmatically.

**Pending:**
- Commit + push M20.5 after Vineet confirms.
- Dogfood: phantom save no longer warns; real edit through to milestone push now lands at +1WD with transitive m7 shown in the drawer.

### Session — 2026-05-17 (M20.4 — cascade algorithm formalization & verification)

**Strategic context:**
After M20.3 shipped, Vineet's question — *"do we think a session to ensure proper algorithm first for cascde functionality as its very imp feature and must work correctly as this only can possibly provide details impact to steero co as well that can becaise cost resource or any other issues"* — drove a pivot. The cascade engine is the foundation that SteerCo decisions, audit log entries, and downstream modules (M21+) all consume. Silent edge-case wrongness compounds into real money / resource / vendor consequences. Burned this session formally specifying what the engine does, exhaustively testing it, and cross-checking against PMBOK / MS Project / Primavera / CCM.

**Built M20.4 (not yet committed — pending Vineet review):**
- **`v2/docs/CASCADE_ALGORITHM.md`** (~600 lines, 11 sections):
  - §1 Entities & fields (milestone, task, calendar)
  - §2 Constraint model — what we support (FS+1WD only), what we explicitly don't (SS/FF/SF, lag on tasks, multi-predecessor milestones, resource leveling, Monte Carlo, CCM buffers, EVM)
  - §3 Working-day arithmetic exact rules
  - §4 The 4 cascade modes (M→M, T→T, M→T conflicts/slack, T→M push) with their algorithms
  - §5 Selective-cascade layer (M20) — exclude vs override semantics with apply order
  - §6 Cycle handling — Kahn's topo, naming members in errors
  - §7 Pre-existing inconsistencies principle
  - §8 Critical path math (forward/backward pass, slack, CP definition)
  - §9 Prior-art cross-check — PMBOK §6.5, MS Project auto-vs-manual, Primavera P6, Goldratt CCM, mid-market gap analysis
  - §10 Punch list (11 items, severities P0–P2, fix sketches)
  - §11 Test matrix index
- **`v2/lib/domain/scheduling.algorithm.test.ts`** — 42 new tests organised by spec section (topology, operations, calendar, cross-entity, hygiene, punch-list reproductions, selective-cascade sanity). 34 pass; 8 are `it.skip` documenting gaps (one each for PL-1, PL-2, PL-3, PL-4, PL-5, PL-6, PL-9, PL-11).
- Final state: **107 tests pass, 8 skipped (= punch list)** across all 3 test files. Build clean, bundles unchanged.

**Punch list — gaps the formal spec + tests revealed:**
- **PL-2 (P0)** — Task→milestone push is **one-hop only**. M20.3's claim of "fully transitive" is currently false: if task t1 pushes milestone m6, the engine does NOT then run `previewCascade` to see if m6 pushes m7 (which depends on m6). Single hardest gap to live with given SteerCo's reliance on accurate downstream impact.
- **PL-11 (P0)** — Cascade silently **"auto-fixes" pre-existing violations** downstream of any edit, even a no-op edit. A phantom save can quietly re-date tasks that were always wrong. Discovered while writing the hygiene tests — the engine doesn't distinguish "real edit" from "re-save of same value" and the drawer attributes the auto-corrections to "this edit". Needs a `respectPreExisting` flag.
- **PL-1, PL-3, PL-4, PL-5, PL-6, PL-7, PL-8, PL-9, PL-10** — P1/P2 items (in-progress pull protection documentation, calendar-vs-working-day daysShifted display, gate buffer on task→milestone push, cycle handling in CP, scheduleBackward feasibility check, override-vs-exclude UI symmetry, missing-dep reference validation, user-introduced-cycle distinction, holiday validation). Each has a one-line fix sketch in the algorithm doc.

**Decided:**
- **One module = one focused output.** This session is doc + tests only. No engine changes. Fixes go to M20.5.
- **PL-2 + PL-11 are M20.5's mandatory scope** (both P0). Others are scope candidates ordered by impact.
- **Skipped tests are living documentation, not technical debt to ignore.** Each `it.skip` in `scheduling.algorithm.test.ts` will be flipped to `it()` as M20.5 lands the fix. If a fix is rejected by Vineet, the skip becomes the permanent documentation that "we chose to keep this behaviour, here's why" — comment updated accordingly.
- **Prior-art cross-check confirmed we are CPM-correct on the basics** (forward pass, backward pass, slack=0 = CP). Deviations from MS Project / Primavera are intentional (no SS/FF/SF, no constraint hierarchy beyond `lockDate`, in-progress forward-pull protection). CCM is referenced philosophically only — no formal feeding/project buffers.

**Followup discoveries beyond the punch list:**
- The cascade engine's edit-trigger whitelist (`plannedStart`, `plannedEnd`, `duration`, `predecessor`, `lag`) is correct — status / owner / name changes correctly don't trigger. Sanity test added.
- `daysBetween` is calendar days, used for display, but constraints are working-day. Mixed semantics surface to PM (PL-3). Worth fixing in M20.5.
- Working-week customisation works (Sun–Thu Mid-East week test passes). This was untested before.
- Holiday handling correctly skips holidays in `addWorkingDays` mid-chain. Test confirms.
- `topologicalSort([])` returns clean empty + no cycle. Edge case test passes.

**Pending next:**
- Commit M20.4 (doc + tests) after Vineet reviews `v2/docs/CASCADE_ALGORITHM.md` — especially §10 Punch List. Vineet may want to:
  - Re-prioritise any P1 to P0 based on real-project criticality.
  - Add a Veeva-specific scenario to the test matrix.
  - Reject the framing of any PL item (e.g. "PL-1 is correct as-is, don't fix").
- M20.5 scope set after Vineet's review: at minimum PL-2 + PL-11. Likely also PL-3 (working-day daysShifted) and PL-4 (gate buffer) since they directly affect SteerCo number accuracy.

### Session — 2026-05-16 → 2026-05-17 (M20.3 — bidirectional cascade + tone discipline)

**Strategic context:**
After dogfooding M20, Vineet flagged that cascade UX still didn't feel "quality": competing toasts ("Task updated" success + "Task due after its milestone" amber warning) on the same action read as illogical, and the cascade was one-directional — editing a task that pushed past its linked milestone showed only a fleeting toast instead of surfacing the implied milestone shift in the same impact drawer. Vineet quote: *"these are minor things but really differentiate from quality to cheap product"*. Confirmed two design calls before coding: (Q1) milestone-shift proposals default-CHECKED in the task drawer because schedule integrity beats opt-in convenience; (Q2) when a milestone moving later creates slack on linked tasks, surface as blue/info toast (not amber alert) — informational, not alarming.

**Built M20.3:**
- **Engine — `lib/domain/scheduling.ts`:**
  - Changed `previewMilestoneToTaskImpact()` return shape from a flat `Warning[]` to `{ conflicts: MilestoneToTaskWarning[], slack: MilestoneToTaskSlackInfo[] }`. Conflicts (task due > new milestone date) are the existing rose path. Slack (task due < new milestone date) is new — computes working-day headroom via `addWorkingDays` cursor walk.
  - Added `previewTaskToMilestonePush(cascadedTasks, milestones, msIdToString)` — task→milestone propagation. Groups proposals by milestone with the binding constraint task (latest due) driving the push. Computes `daysShifted` via `daysBetween`.
- **ImpactDrawer — `components/ui/impact-drawer.tsx`:**
  - New `info` section kind (blue tone, read-only, no checkbox/no editable date) for slack-gained rows. Each row shows `taskDue → milestoneNewDate` plus a `+Nd slack` badge. Totals strip gained a "N slack gain(s)" blue pill.
  - Empty-state check now requires `totalShifts === 0 && totalWarnings === 0 && totalInfo === 0`.
- **Milestones grid — `components/milestones/milestones-grid.tsx`:**
  - `CascadePreviewState` now carries `slackInfo`. Drawer recompute returns three sections: milestones (existing), warnings (existing — conflicts), info (new — slack created).
  - When edit has no downstream impact at all but does create slack, the no-drawer path fires a single `toast.info` (not warning) with the slack summary.
  - On apply, if slack was created, also fires the informational toast as a positive nudge.
- **Tasks grid — `components/tasks/tasks-grid.tsx`:**
  - Subscribes to live `milestones` and `replaceAllMilestones` from the store. Drawer's recompute now also runs `previewTaskToMilestonePush(r.tasks, scheduleMilestones, msNumToStr)` and renders proposed milestone shifts as a `milestones` section (default-checked, exclude-able, override-able).
  - Cascade-trigger condition extended: drawer opens when `affected.length > 0 || msPushProbe.length > 0` so a task pushing past its milestone with no downstream tasks still surfaces the milestone proposal.
  - Apply commits both `replaceAllTasks` and (when milestone pushes are included) `replaceAllMilestones`. Success toast describes both: "5 tasks updated · 1 milestone also shifted".
- **Tone cleanup — `components/tasks/task-form.tsx`:** removed the redundant `toast.warning("Task due after its milestone")`. The cascade drawer now owns that signal inline.
- **Tests:** existing `previewMilestoneToTaskImpact` cases adapted to the new `{ conflicts, slack }` shape. Added 3 new cases for `previewTaskToMilestonePush` — single proposal, group-by-milestone with binding constraint, ignore on-or-before tasks. 70 → 73 tests pass.
- Build clean, 15 static pages, `/tasks` 7.14 → 7.23 kB, `/milestones` 11.5 kB (unchanged).

**Decided:**
- **Default-checked milestone shifts in the task drawer** — Vineet Q1 confirmation. PMs deal with integrity-breaking changes by default; opt-out is explicit. Matches PMBOK §4.6 Integrated Change Control philosophy.
- **Slack-created is info-only, not selectable** — read-only in the drawer (no checkbox, no editable date). It's not a proposed change; it's a status report. Blue tone per §5.3.
- **Engine return shape changed (breaking)** — `previewMilestoneToTaskImpact` now returns an object, not an array. Only one call site outside tests; updated cleanly. Worth the API clarity over additive-only evolution.
- **Live store reads in tasks-grid for milestones** — the old `import { milestones }` from mockData was stale for the cascade probe. Now uses `useEntityStore((s) => s.milestones)` so the drawer sees what the user actually has.

**Status:** ready for Vineet to dogfood (M20.2 confirm-before-commit protocol). Not committed yet.

**Pending verify:**
- Walk through: edit a task to push past linked milestone → drawer opens showing both downstream tasks AND the proposed milestone shift (default checked). Apply both. Audit log captures `cascade` actions.
- Walk through: edit a milestone earlier → drawer opens with task conflict warnings. Apply.
- Walk through: edit a milestone later (creates slack) → if no downstream milestone shifts, single blue toast "N tasks gained slack". If there are downstream shifts, drawer shows slack section in blue at bottom.
- Walk through: edit a task earlier (no impact) → directly saves, no drawer.

### Session — 2026-05-16 (Competitive check + M20.2 — architectural pre-flight)

**Strategic context:**
Vineet asked for a competitive check against Monday/Smartsheet/Asana/Linear/MS Project/Jira to confirm we're on track before more feature work, plus an architectural look at how easily we'd patch in the future. Did the scorecard honestly: we already beat the mid-market on cascade engine + RACI + resources + SteerCo pre-brief, trail enterprise on PMBOK breadth (Charter / WBS / RAID / EVM / Closure / Quality). Found four real architectural debt items that would compound through M21–M27. Proposed M20.2 as a focused pre-flight refactor before continuing — Vineet agreed and asked to bake periodic checks in as a discipline.

**Built M20.2 (commit `86b2a2a`):**
- Installed `zustand` 5.0.13 (~5 KB). Created `lib/stores/entity-store.ts` — central store with one slice per entity type (8 total: milestones / tasks / risks / documents / costLines / teamMembers / meetings / absences). Each slice exposes `addX` / `updateX` / `deleteX` / `replaceAllX` actions. Hydration loads persisted state on mount.
- Created `lib/stores/audit.ts` — `buildAction()` + `appendAudit()`. Every mutation records `{ id, type, entityKind, entityId, before, after, source, projectId, timestamp, note }` to a per-project audit log capped at 500 actions.
- Created `lib/repositories/entity-repository.ts` — `EntityRepository<T>` interface with `LocalStorageRepository<T>` and `InMemoryRepository<T>` implementations. Store composes repositories.
- Created `lib/validation/project-validator.ts` — `validateProjectState({...})` returns `{ healthScore (0–100), issues[], totalsBy }`. 5 cross-entity rules. Health score is weighted deduction.
- Created `components/dashboard/project-health.tsx` — user-visible payoff. Displays score, severity chips, top 5 issues with click-through.
- Created `components/stores/entity-store-hydrator.tsx` — one-time hydration trigger inserted in `app/(app)/layout.tsx`.
- Migrated all 8 grids from `useLocalStorageState` to store. Each setX-style call became a dispatch (`addX`, `updateX`, `deleteX`, `replaceAllX`). Toasts kept inline as before. Store-action `source` and `note` fields used to label each action in the audit log (`user-edit`, `user-inline`, `cascade`, `system`).
- Added `§5.2 Tech-debt index` to operating doc — live ledger of debt items + severity + origin + proposed clearance. Four items cleared this session, four flagged for follow-up (CommandPalette / NotificationBell / /my-items / exporter still read raw localStorage; they see the same data the store writes but aren't reactive subscribers).
- Added `§9.9 Periodic architectural checkpoint` anti-drift rule — every 4 feature modules trigger a checkpoint session (tests + competitive scan + tech-debt review). Counted from M21 onward.

**Decided:**
- **Zustand over Context + reducer** — Zustand is ~5 KB, has the right action+selector ergonomics, doesn't force a Context boundary, and has middleware pattern for future devtools / persistence variants. Anti-drift §9.2 doesn't reject this; it's a new library not a contradicting decision.
- **One store with 8 slices** rather than 8 separate stores — simpler hydration, simpler audit log (one dispatcher), simpler validation (one snapshot of project state).
- **Helpers (`runAdd`, `runUpdate`, `runDelete`, `runReplaceAll`) factor out the audit + persist + state pattern** so each entity type's actions are one line each. ~250 lines store, mostly boilerplate-eliminated.
- **Repository pattern instead of just localStorage in the store** — adds one indirection but the Path C swap becomes trivial. Cost: marginal. Benefit: large when it lands.
- **Project Health card uses live store reads** with useMemo for the validation pass — runs cheaply (~5ms) on every render, no stale data risk.
- **Other surfaces (CommandPalette, NotificationBell, /my-items, exporter) NOT migrated this session** — they still work because they read the same localStorage keys the store writes. Their staleness window is bounded by the next render. Logged as M20.3 candidates in §5.2.
- **Periodic checkpoint cadence (§9.9) every 4 modules** — gives the discipline without overburdening every session. M25 will be the inaugural counted checkpoint.

**Built:** Switch projects, edit a task, watch the Project Health card update reactively. Inspect localStorage and see `aivello_audit_v1_proj-veeva-rim` populating with action entries. Cycle a task status — note the source is `user-inline`. Save a milestone — source `user-edit`. Apply a cascade — source `cascade`. Build clean, 70/70 tests pass, bundles shrunk on 3 routes from leaner state management.

**Next session goal:** M21 — Timesheets + derived labour cost. Now built on a clean store + audit log + repository foundation.

---

### Session — 2026-05-16 (M20.1 — cascade UX polish + bug fix)

**Worked on (commit `61ad002`):**

Vineet dogfooded M20 and surfaced a critical bug: editing T3 +28d showed "No downstream shifts" despite T4 (which depends on T3) violating against the new date, plus a messy stack of 5 violations that turned out to be pre-existing.

**Root cause investigation:**
Wrote a bug-repro Vitest case (mirror of the dogfood scenario). First assertion ("T3 +28d MUST shift T4") **passed** — the engine handles the simple case correctly. Second assertion exposed the real issue: the dogfood data has a **dependency cycle** (T1 deps = [T4,T7,T8,T5], which transitively cycles back through T2/T3 → T4 → T1). My M20 BFS engine walked through the cycle re-processing tasks via different paths, producing inflated affected[] entries and contradictory dates. The diff against originals couldn't reconcile, surfacing as "no shifts" in the drawer.

**Fixes shipped:**

1. **Engine refactor** — `previewTaskCascade` now uses topological-order single-pass cascade:
   - New `topoSortTasks()` detects cycles via Kahn's algorithm
   - On cycle: returns `error: "Dependency cycle detected — cannot cascade. Tasks involved: T1 → T2 → T4"` instead of producing wrong results
   - On valid graph: processes each task once in topo order, each sees its upstreams' final (cascaded) dates → correct single-pass result
   - Excludes/overrides still work the same way

2. **Grouped violations** — `groupViolationsByTask()` rolls up per-pair violations into per-task with `brokenDeps[]` inline. Dogfood's 5 rows collapse to 2 ("T1: 4 upstreams scheduled later" + "T4: T3 scheduled later").

3. **New-vs-pre-existing diff** — `diffViolations(before, after)` returns the set delta. Tasks-grid recompute captures baseline violations at drawer open and diffs each recompute's after-state against it. UI now renders:
   - "New constraint violations caused by your choices" (prominent, only if delta non-empty)
   - "Pre-existing data inconsistencies" (informational, helps PM understand they're not caused by this edit)
   - Engine errors as a dedicated single-row warnings section

**Decided:**
- Topological cascade over BFS is unambiguously the right engine — handles cycles, single-pass correctness, simpler diff logic. Same algorithm PMBOK CPM forward pass uses.
- Per-task grouping is the right granularity for violations — duplicates from raw per-pair output were the messiest part of the dogfood screenshot.
- Pre-existing violations stay visible but in a clearly secondary section. PMs shouldn't be alarmed by data issues that existed before their current edit, but shouldn't be hidden from them either.
- Engine errors (cycles) need their own surface — the drawer's warnings section type already supports it; the recompute callback returns a single warnings row.
- Skipped slack indicators and workstream grouping from the M20.1 scope — these were "optional polish" that's not critical to the current pain points; can revisit if the new UX is still too dense.

**Built:** Bug fix verified by test. Re-dogfood the T3 +28d edit on cleaned data: T4 shifts properly, drawer shows "1 of 1 shifts included", no false violations. With cycle in data: drawer shows clear error message instead of confused state. 70/70 tests pass, build clean.

**Next session goal:** M21 — Timesheets + derived labour cost. Add `hourlyRate` to TeamMember; derive per-resource hours from owned tasks + meeting attendance − absences; reconcile against `/costs` to close the EVM loop.

---

### Session — 2026-05-16 (Strategic alignment + M20 — selective cascade with re-preview)

**Strategic alignment (before code):**

Vineet flagged that the M18 ImpactDrawer is rigid — Apply commits every shift, no way to absorb buffer on one row or override a date on another. Asked for it to be planned as a module. I researched the competitive landscape (Microsoft Project clunky, Smartsheet/Monday/Asana absent, Jira AR + Planisware do it but in separate workspaces) and mapped the need to PMBOK §6.5.2.3 What-If Analysis + Goldratt CCM buffer protection. Slotted as M20, pushed timesheets/AI-agent/change-control to M21–M24.

**Built M20 (commit `5f70f3c`):**

- `lib/domain/scheduling.ts`: extended `previewTaskCascade` and `previewCascade` to accept `CascadeOpts { excludeIds, overrides, workingDays?, holidays? }`. Implemented overloaded signatures so M18 call sites keep working (`(tasks, edit, workingDays[], holidays[])`). Walking algorithm respects excludes (skip + no propagate) and overrides (use manual date, propagate from there). Milestone version leverages existing `lockDate: true` for excluded rows and `lockDate + plannedEnd` for overrides.
- New `findConstraintViolations()` — pure helper scanning tasks for FS-rule breaks after the PM's choices. Used by the drawer's warnings section.
- Tests: 8 new cases covering exclusion stops downstream propagation, override changes propagation root, override+exclude combined, branching exclusion, single-dep / no / multi-dep-binding violation cases, milestone-side cascade. 58 → 66 tests, all pass.

- `<ImpactDrawer>` rewritten — was presentational (took precomputed sections), now stateful (holds excludeIds + overrides, calls parent-provided `recompute()` on every interaction):
  - Per-row checkbox controls inclusion; excluded rows dim and show "unchanged" instead of the new date
  - Per-row `<input type="date">` for override; overridden rows get a blue border + "↺ revert" affordance
  - Live recompute on every state change (no debouncing — engine is fast at this scale)
  - Header totals strip: "N of M shifts included · K violations · P overrides"
  - Apply label updates live: "Apply N of M changes"

- Parent grids (`tasks-grid.tsx`, `milestones-grid.tsx`) updated:
  - `cascadePreview` state now stores `{ editedId/edit, summary, … }` rather than precomputed affected rows
  - Each provides a `recompute(excludeIds, overrides)` callback that runs the engine fresh and returns sections
  - `onApply(excludeIds, overrides)` re-runs the engine with the chosen opts and commits the result to entity state
  - Milestone parent handles string↔number ID translation (drawer uses string IDs for genericity)

**Decided:**
- Drawer holds the interaction state; parent owns the cascade logic and entity-state commits. Keeps the drawer presentational-with-state rather than coupled to entity types
- No debouncing of date input edits — the engine completes in <1ms for project-sized inputs
- Overrides apply to the new (post-cascade) date, not the original — PMs think "I want this row to land on X", not "shift this row by Y days"
- Excluding a row drops any prior override on it (consistency — exclusion supersedes override)
- Violations are surface-level only (no blocking) — PMs may have reasons to accept them and own the consequences

**Built:** Open `/milestones`, edit m6 planned date → drawer shows downstream m7/m8 etc. Uncheck m7 → m8 dependency violation appears in red. Override m8's new date to Jul 15 → blue border on that row + "↺ revert". Apply produces the chosen subset. Same flow on `/tasks` for the t1→t2→t3 chain. Build clean, 66/66 tests pass.

**Next session goal:** M21 — Timesheets + derived labour cost. Add `hourlyRate` to TeamMember; derive per-resource hours from owned tasks + meeting attendance − absences; reconcile against `/costs` to close the EVM loop.

---

### Session — 2026-05-16 (M19 — clean project export workbook)

**Worked on (commit `3c6a56a`):**
- Added `xlsx-js-style` 1.2.0 — styled fork of xlsx, MIT, kept alongside the existing `xlsx` dep (used by M7 reports). Loaded via `await import("xlsx-js-style")` inside the export function so it stays out of the initial bundle and only fetches on first Export click
- New `lib/exporter.ts` — `exportProjectWorkbook({...})` pure async function. No React imports. Internal sheet builders (`buildSummary`, `buildGantt`, `buildMilestones`, `buildTasks`, `buildDocuments`, `buildRisks`, `buildCosts`, `buildResources`) each return a styled Worksheet via direct cell object construction (`{ v, t, s }` shape)
- Style preset constants (`COLORS`, `headerStyle`, `sectionStyle`, etc.) reused across all sheets — keeps the workbook visually coherent
- Gantt sheet uses Monday-aligned week grid (≈36 cols for a 9-month project), bars rendered as cell fill colors with `■` glyph, today column highlighted yellow, two frozen header rows (month / week), four frozen left columns. Month labels merged via `!merges` across consecutive same-month columns
- Reused existing `computeRAG()` + `computeCriticalPath()` from `lib/domain/scheduling.ts` to drive Milestones-sheet RAG column and Gantt CP coloring
- New `components/projects/export-button.tsx` — `<ExportButton project=… variant="default" | "compact"/>`. Reads persisted entity arrays from localStorage (M16.1 keys) + settings, filters to the requested project, calls the exporter. Loader2 spinner during async export, Sonner toast on success / error
- Wired in two places: topbar (replaces the previous no-op Export button — exports active project) and `/projects` per-row (per-project compact export)

**Decided:**
- Kept `xlsx` and `xlsx-js-style` side-by-side rather than migrating M7 reports — incremental risk minimisation; consolidation can come later when M7 reports themselves get a polish pass
- Dynamic import for `xlsx-js-style` (~80 KB) so the projects page and dashboard don't pay the bundle cost until first export click
- Week-granularity (not day) for the Gantt sheet — keeps column count manageable (~36 cols for 9 months vs 270+ for daily). Days would make the workbook unreadable in print preview
- Bar glyph (`■`) inside the colored cell rather than empty cell — gives the bar a visible mark when printed in mono and helps screen-reader narration
- Owner column on Documents sheet bolded ("R" in RACI) to visually distinguish from Reviewers/Approvers lists; section headers in workbook mention "Owner (R)", "Reviewers (C)", "Approvers (A)" to make RACI explicit
- Totals row on Costs sheet uses a top-border + label-bold-bg-fill style to read clearly without merge

**Built:** Click Export in the topbar → `Veeva_RIM_Implementation_2026-05-16.xlsx` downloads with 8 styled sheets. Open in Excel and Numbers: cell fills render, frozen panes work, month merges in Gantt header are correct. Build clean, 15 static pages, no bundle bloat.

**Next session goal:** M20 — Timesheets + derived labour cost. Add `hourlyRate` to TeamMember; derive per-resource hours from owned tasks + meeting attendance − absences; reconcile against `/costs` for the EVM (Earned Value Management) loop.

---

### Session — 2026-05-16 (Strategic alignment + M18 — universal cascade-impact panel)

**Strategic alignment session before code:**

Vineet brought four big ideas and asked me to evaluate against PM principles before scoping any of them as modules:
1. **Clean multi-sheet Excel export** (project plan + Gantt + documents with RACI) — recurring SteerCo / handover artifact
2. **Auto-generated timesheets** from tasks + meetings − absences, with `hourlyRate` per resource, AND token-cost calculation for AI-agent team members
3. **Scope-creep / change-request workflow** with impact assessment on the iron triangle, configurable CCB approval levels, audit trail — also unplanned risk realization
4. **Cascading impact visibility** — bigger gap than originally thought; tasks have no cascade at all, milestone→task is invisible

Mapped each to mature PM frameworks (PMBOK §4.6 Integrated Change Control, PRINCE2 Issue Management, ICH Q9 QRM for pharma, Theory of Constraints / Critical Chain Method, Earned Value Management). Proposed revised §5.1 sequence:

| # | Module | Reason for order |
|---|---|---|
| M18 | Universal cascade-impact panel | Daily use, biggest current gap |
| M19 | Clean project export workbook | Periodic use, ships value quickly |
| M20 | Timesheets / derived labour cost | Closes EVM loop |
| M21 | AI-agent team-member type + token cost | Differentiator narrative |
| M22 | Change Request entity + impact workflow | Implements PMBOK §4.6 |
| M23 | Configurable CCB + risk-realization auto-CR | Completes change-control story |

Original M18 (CSV import + templates) and prior M19/M20 (comments, exec commentary) demoted to the §5.1 "Deferred" list — useful but lower urgency than the cascade/export/EVM/change-control track.

**Built M18 (commit `aa2544d`):**

- `lib/domain/scheduling.ts` — added `previewTaskCascade()` (forward walk through `dependsOn` reverse-index, cycle-defensive, respects workingDays + holidays) and `previewMilestoneToTaskImpact()` (cross-entity warning when a milestone moves past its linked tasks' due dates)
- 7 new Vitest cases — linear, branching, cycle defense, cross-entity flagging, scoping. 51 → 58 tests, all pass
- New `<ImpactDrawer>` (`components/ui/impact-drawer.tsx`) — universal right-anchored drawer replacing the M4B `CascadePreviewDialog`. Originating-change summary at the top (before→after + delta days), sectioned body (Milestones / Tasks / Warnings) with CP badge on critical-path rows, totals strip, Apply/Cancel footer
- `milestones-grid.tsx` — `CascadePreviewDialog` deleted; `handlePlannedDateChange` extended to read persisted tasks, compute cross-entity warnings, and compute CP id set so drawer can flag critical-path rows; Sonner toast on Apply with milestone count
- `tasks-grid.tsx` — cascade preview fires only when save moves dueDate later; new tasks, earlier-due edits, and zero-impact edits skip the drawer

**Decided:**
- Soft flag (warning) for task→milestone rather than auto-shift, because task-milestone is a logical/rollup link not a strict FS precedence
- Task cascade only fires on later-than dueDate edits — earlier dates don't push anything downstream
- Persisted task state read via direct localStorage call from milestones-grid (matches M16.1 + M17 pattern) — avoids prop drilling
- Cross-entity warnings appear as a separate `<Section>` with rose styling in the drawer; doesn't block Apply (PM may want to manage tasks separately)
- ImpactDrawer is a fresh component rather than extending EntityDrawer — different semantics (preview-vs-apply rather than form), different sections, simpler to keep them separate

**Built:** Edit milestone m6's planned date by a few days → ImpactDrawer opens showing downstream milestones shifting + any linked tasks flagged. Save a task with a later due date → drawer shows the dependency chain rippling. Build clean, 15 static pages.

**Next session goal:** M19 — Clean project export workbook (8 sheets: Summary / Gantt / Milestones / Tasks / Documents / Risks / Costs / Resources + Meetings) using `xlsx-js-style` for the Gantt cell colouring.

---

### Session — 2026-05-13 (M16.1 — persistence + bell + M17 — search + My Items + owner-me)

**Worked on:**

M16.1 (commit `04c336c`) — two bug fixes flagged after M16:
- `lib/useLocalStorageState.ts` — generic `useState`-shaped hook that mirrors value to localStorage. Hydrates once on mount, writes on every set, swallows JSON/quota errors. Drop-in for all 8 entity arrays in their respective grids
- `components/notification-bell.tsx` — popover with derived live alerts (overdue tasks where owner=VP, pending decisions where I'm a reviewer/approver, escalated risks score≥12, at-risk milestones). Count badge replaces the static dot; empty state when no alerts. Click an alert → navigates. Click-outside closes
- Topbar breadcrumb subtitle uses `activeProject.name + phase` instead of hardcoded text

M17 (commit `305a9ca`) — three lifts:
- `lib/searchIndex.ts` — unified search across all entity types. Reads localStorage keys with fallback to mockData. `searchEntities(activeProjectId, query, limit)` scores by title-equality > startsWith > includes > subtitle-includes
- Command palette rewired: Navigate group (pages) + Entities group (only when query is non-empty). Entity items show kind icon + title + subtitle + kind badge. Click navigates
- `/my-items` route — owner=VP aggregation across active project. Summary strip + Tasks (Overdue/Blocked/Due-this-week/On-track) + Documents (Overdue/In-review/Drafts as Responsible) + Risks + Milestones with slip indicators. Empty state when nothing owned. Sidebar OVERVIEW group adds the entry (Inbox icon)
- "Mine" toggle in toolbars of Milestones, Tasks, Risks, Documents grids — filters by `owner === "VP"` (or RACI Responsible for documents)

**Decided:**
- Search reads localStorage directly each open rather than via React context — keeps the palette self-contained and always-fresh, no provider plumbing across the app
- Project hits in search are global (across all projects), not scoped to active — lets you find and switch to other projects via ⌘K
- My Items page reads localStorage with mockData fallback — same pattern as the search index; if a key isn't populated yet (fresh load) we still see the seeded data
- Mine toggle is per-grid component state rather than a global setting — keeps each grid's filter behaviour orthogonal; user can have Mine on for Tasks but off for Risks
- Notification bell reads raw mockData (not localStorage) for now — acceptable trade-off because alerts are derived from project state at module-load time. A future improvement would lift entity state to a shared store so the bell reflects in-session edits. Logged as a known limitation in M16.1's commit message

**Built:** Both bugs fixed, M17 shipped. 15 static pages. After adding a milestone in PromoMats and refreshing, the milestone is still there. Bell shows "5 alerts" with overdue tasks, pending decisions, escalated risks. ⌘K + "FRS" finds the document. /my-items lists owned items grouped by urgency.

**Next session goal:** M18 — CSV / Excel import + project templates (the next big PM-onboarding unblock), or M19 — Comments + activity feed.

---

### Session — 2026-05-13 (M16 — Gantt timeline + critical path)

**Worked on (commit `8e427f2`):**
- `lib/domain/scheduling.ts`: added `computeCriticalPath(milestones, workingDays?, holidays?)` — backward pass over `topologicalSort` result. For each milestone (reverse topo order): if terminal, LF = max plannedEnd across project; else LF = min over successors of `addWorkingDays(succ.LS, -(1 + succ.lag), workingDays, holidays)`. LS = `addWorkingDays(LF, -(dur - 1), …)`. Slack = working days from plannedStart to LS. `slack === 0 ⇒ critical`. Returns `{ criticalIds, slackById }`.
- `lib/domain/scheduling.test.ts`: 5 new cases — linear, parallel branches, terminal, holidays-reduce-slack, empty input. 46 → 51 tests, all pass.
- New `components/milestones/gantt-view.tsx`:
  - Left rail (256 px) — milestone name list with lock icon and CP/slack indicator
  - Right pane — month-headed time axis (3 px / day, ~810 px for a 9-month project), absolute-positioned bars
  - Bars: rose for CP, blue/amber/emerald/slate for status (in-progress/at-risk/complete/pending), 5 px tall, click opens the existing edit drawer via passed callback
  - Today line (primary colour) + "TODAY" pill
  - Forecast-slip indicator — striped rose extension beyond planned end
  - Empty state when filters yield zero milestones
  - All memoised; CP computed once per milestones/settings change
- `components/milestones/milestones-grid.tsx`: added `viewMode: "grid" | "gantt"` state; Grid/Gantt toggle in the toolbar (LayoutGrid / GanttChartSquare icons, primary-tint active state); render switches at the top of the body keeping toolbar + drawers + cascade modal common to both

**Decided:**
- Bars-only Gantt; predecessor arrows deferred (would need SVG overlay; predecessor relationships already visible via the row ordering and CP highlighting)
- 3 px / day fixed scale rather than zoomable — simpler MVP; can revisit if user feedback wants zoom
- Critical path computed from current `plannedStart` / `plannedEnd` (the cascade-engine outputs), not by re-running cascade — keeps CP deterministic from what the user sees in the grid
- Click bar to edit re-uses the existing `MilestoneFormDrawer`; no separate Gantt-specific edit affordance

**Built:** Gantt visible by clicking the new toggle on `/milestones`. Switching to the Veeva PromoMats project (empty) shows the empty state. Build clean.

**Known bugs surfaced by Vineet this session (NOT fixed in M16; logged in §4 for next session):**
1. Topbar bell notification not interactive
2. Entity persistence gap — new milestones / tasks / etc. don't survive page refresh because M15 only persisted `projects` + `activeProjectId`, not entity arrays. Need to mirror the localStorage pattern across all entity types.

**Next session goal:** M16.1 — fix entity persistence + bell notification (small focused module), then M17 — global search in ⌘K + "My Items" view.

---

### Session — 2026-05-11 (M14.1 — pre-flight fixes + M15 — multi-project)

**Worked on:**

M14.1 (commit `16abfa7`) — three dogfood-driven fixes:
- New `<SelectWithCustom>` component (`components/ui/select-with-custom.tsx`) — replaces all 6 datalist inputs across risk/task/document/cost/team/meeting forms. Known options visible in a proper `<select>` with a "+ Other (type new)…" escape hatch that toggles to text input. Resolves the "I only see one category" UX problem.
- Duplicate task detection — `TaskFormDrawer` soft-warns via `toast.warning` when adding/saving a task whose name (case-insensitive trimmed) already exists in the same workstream. Save still proceeds (PMs may have legitimate duplicates).
- Document RACI — added `owner: string` field to `Document` type (RACI Responsible). Back-filled all 13 mockData documents with sensible owners by document type (VP for PM artefacts, SL/AR for tech, QA for validation, HR for training). Owner surfaced as a hashed-colour avatar in the document card's metadata row. PeopleList section headers updated to "Reviewers (Consulted)" and "Approvers (Accountable)" to make the RACI mapping explicit.

M15 (commit `f949295`) — multi-project end-to-end:
- New `Project` type in mockData with 2 seeded projects: existing "Veeva RIM Implementation" (`proj-veeva-rim`) and a new empty "Veeva PromoMats Migration" (`proj-promomats`) to verify isolation works
- `projectId: string` field added to every entity type (Milestone, Task, Risk, Document, CostLine, TeamMember, RecurringMeeting, Absence). Python script back-filled all 77 existing mockData entities with `projectId: "proj-veeva-rim"`
- New `<ProjectProvider>` (`components/projects/project-provider.tsx`) — holds projects state + active project id + CRUD callbacks. Both `aivello_active_project_v1` and `aivello_projects_v1` persist to localStorage
- New `<ProjectSwitcher>` sidebar dropdown (`components/projects/project-switcher.tsx`) — replaces the static project card; lists every project with active check; footer "Manage projects" link to /projects
- New `/projects` page (`app/(app)/projects/page.tsx`) — full list with active badge, Switch-to / Open / Delete actions per project, inline Create form with validation
- `app/(app)/layout.tsx` wrapped in `<ProjectProvider>` (inside `<ThemeProvider>`)
- Command palette + topbar breadcrumb: Projects entry added
- `getKpis()` accepts optional `projectId` parameter; internally filters milestones/risks/docs/costLines to that project. Budget total now derives from project's own cost lines (was hardcoded $2M)
- Every grid (milestones, tasks, risks, documents, costs) and the resources panel now read `activeProjectId` from `useProject()` and filter their state slice. Form pickers (predecessor dropdown, milestone link, dependsOn list, etc.) all scope to active project. Save handlers attach `activeProjectId` to new entities
- Cascade engine now operates on project-scoped milestones; "Schedule from Go-Live" uses `activeProject.goLiveDate` instead of hardcoded `project.goLiveDate`
- Dashboard header shows live `activeProject.name` / phase / go-live date

**Decided:**
- Single global state per entity type, filtered by `projectId` at the render boundary — chosen over per-project state slices because it keeps mutation handlers simple and matches how a real backend would behave
- Forms construct entities with `projectId: initial?.projectId ?? ""` and the parent grid's `|| activeProjectId` fallback always wins for new rows. Avoids prop-drilling activeProjectId into every form
- Two seeded projects: one populated, one empty. Empty project deliberately tests the empty-state UX (you switch to it and see Add buttons but no entities)
- Sidebar `ProjectSwitcher` is the canonical switcher; `/projects` page is for management (create/delete/details). Wired both surfaces so user can do either
- Python script for mockData back-fill instead of 77 individual edits — saved a lot of tokens
- M14.1 + M15 shipped as separate commits even though logged in one session entry — preserves bisect-ability if something breaks

**Built:** 14 static pages (was 13). Project switching produces visibly different dashboards. Creating a new project produces empty grids with Add buttons. Build clean.

**Next session goal:** M16 — Gantt timeline view + critical path visualisation on the Milestones page. The cascade engine already knows enough to compute CP; this surfaces it.

---

### Session — 2026-05-11 (M14 — Drawer pattern + validation across all entities)

**Worked on (commit `5105406`):**

Folded the proposed M13.5 (validation, sorting, plausibility) into M14 to do it once across all entities instead of twice. 5 new form drawers + cross-entity validation + sort patches.

- Created `lib/validation.ts` (shared validation helpers + PROJECT_DATE_MIN/MAX constants)
- Created `components/risks/risk-form.tsx` — `<RiskFormDrawer>`: title + category (datalist) + P×I (selects with auto-computed score in band-coloured display) + status + owner + mitigation
- Created `components/costs/cost-line-form.tsx` — `<CostLineFormDrawer>`: category + description + budgetK + actualK + contractType + owner; soft warns if actual > budget
- Created `components/documents/document-form.tsx` — `<DocumentFormDrawer>`: name + abbreviation + type (datalist) + phase + version + status + dueDate + description + reviewers list + approvers list (inline person editor with add/remove)
- Created `components/resources/team-member-form.tsx` — `<TeamMemberFormDrawer>`: name + initials (auto-derive from name if blank) + role + workstream + optional steercoRole; warns on initials collision
- Created `components/resources/meeting-form.tsx` — `<MeetingFormDrawer>`: name + type + workstream (conditional on type) + frequency + dayOfWeek + duration + nextDate + attendees with mandatory/optional toggle per attendee
- Wired each form into its grid: `+ Add` button + click-name-to-edit + Sonner toasts on add/update/delete
- `components/costs/costs-grid.tsx` converted to client component (was server)
- `components/resources/resources-panel.tsx` refactored:
  - `AbsencesContext` → `ResourcesContext` (now carries members + meetings)
  - `useAbsences` → `useResources`
  - `getMemberById` takes members as a parameter
  - All 4 tabs updated to destructure from new context
  - Tab bar now exposes "Add Member" on availability and "Add Meeting" on cadence (context-switched per active tab)
  - 2 drawer states (member, meeting) + their save/delete handlers
- Sort patches: milestones grid by plannedDate; tasks grid by dueDate within each workstream group; documents list by dueDate within each phase
- Validation patches:
  - Milestone form: predecessor-date contradiction blocks save; auto-suggest planned date when predecessor picked (calendar-days from `addCalendarDays`)
  - Task form: soft-warns if due > linked milestone planned, soft-warns if any dependsOn task has later due
  - Document form: soft-warns if due in past
  - Cost form: soft-warns if actual > budget
  - Meeting form: soft-warns if next date in past
  - Member form: soft-warns on initials collision
  - All forms with dates: hard-block on ISO format and 2024–2030 range

**Decided:**
- Folded M13.5 (validation) into M14 — same files needed to be touched
- Soft vs hard validation: required fields + format + range + self-reference are hard-blocks; semantic mismatches (due-after-milestone etc.) are `toast.warning` so PMs can override when they need to (e.g. project-extended scenarios)
- Auto-suggest uses calendar-days not working-days for simplicity — user can refine with the existing inline date editor which runs the proper cascade preview
- Person editor inside DocumentFormDrawer is inline (chips with X to remove + name+role fields with + Add) rather than a sub-drawer — simpler UX, sufficient for the data shape
- ResourcesContext gets all state lifted to the panel; this keeps the four tabs cleanly read-only consumers and makes future state changes (e.g. localStorage persistence) a single-file change

**Built:** Every entity in the app is now add/edit/delete-able through the same drawer pattern with the same validation rhythm. The dogfood walkthrough that triggered M13 → M14 is now mostly satisfied. Build clean, 13 static pages, /resources 7.51 → 11.3 kB (forms + state).

**Next session goal:** M15 — Projects list, create form, sidebar project switcher. The whole app currently hardcodes one project; making it multi-project is the next big lift.

---

### Session — 2026-05-11 (M13 — Universal Add + Edit + Delete for milestones + tasks)

**Worked on (commit `2c94410`):**

Trigger: Vineet's dogfood walkthrough surfaced that the app was a viewer — no row could be added, edited, or deleted for any entity. Path C confirmed (focus core PM features, pair with Veeva for validated layer, internal-only docs for cert prep). Modules M13–M20 added to §5.1 of operating doc as the post-launch plan.

- Created `components/ui/entity-drawer.tsx` — reusable slide-over drawer:
  - Right-anchored, max-width 28rem (max-w-md), full height
  - Backdrop click + Escape key both close
  - Body scroll locked while open
  - Exports `<EntityDrawer>` (open/onClose/title/subtitle/children/footer), `<ConfirmDelete>` (label/onConfirm/onCancel), `<Field>` (label/hint/required wrapper), and `inputCls` constant for consistent input styling
  - No new dependencies — uses existing Lucide `X` icon + Tailwind animations

- Created `components/milestones/milestone-form.tsx` — `<MilestoneFormDrawer>`:
  - 10 fields: name + phase + owner + predecessor (dropdown of all milestones excluding self) + duration + lag + plannedDate + forecastDate + status + locked
  - Validation: name required, planned date required + ISO format, predecessor cannot reference self
  - Generates next milestone ID as `m{max+1}` to keep mockData prefix convention
  - Inline delete confirm (no nested modal); falls back to ConfirmDelete component
  - Form re-initialises on open via useEffect

- Created `components/tasks/task-form.tsx` — `<TaskFormDrawer>`:
  - 9 fields: name + workstream (datalist of existing) + priority + status + progress (range slider) + milestoneId (dropdown) + owner + dueDate + dependsOn (checkbox list scoped to other tasks)
  - Auto-derives status from progress: progress=100 → Complete; progress>0 from "Not Started" → "In Progress"
  - Same validation pattern (name + due date required, ISO format)
  - Generates next task ID as `t{max+1}`

- Wired drawer into `milestones-grid.tsx`:
  - New `DrawerState` discriminated union: closed | new | edit
  - `+ Add Milestone` button added to toolbar (Plus icon, primary colour)
  - Milestone name converted to a button → opens drawer in edit mode
  - "Schedule from Go-Live" demoted to a secondary button so primary action is now the new Add
  - `handleDrawerSave` upserts (matches by id), `handleDrawerDelete` removes
  - Sonner toasts on every mutation with milestone name in description

- Wired drawer into `tasks-grid.tsx`:
  - Same `DrawerState` pattern
  - `+ Add Task` button added to toolbar
  - Task name converted to a button → opens drawer in edit mode
  - `onEdit` prop threaded through `WorkstreamGroup` → `TaskRow`
  - Sonner toasts on every mutation

**Decided:**
- Single `<EntityDrawer>` shared across both forms (and reusable for M14) rather than two separate Sheet implementations
- Self-contained `<MilestoneFormDrawer>` and `<TaskFormDrawer>` (state lives inside each) rather than splitting form-body from form-actions — earlier attempt at the split made parent/child state plumbing ugly
- Delete uses an inline `<ConfirmDelete>` block inside the drawer body rather than a nested modal — simpler UX, no risk of stacked overlays
- Click the entity name (not the whole row) to enter edit mode — preserves existing inline interactions (status cycle, progress slider, date edit, lock toggle) which all use the row body
- Status auto-derivation in the Task form matches the existing inline-slider behaviour so the two surfaces don't disagree

**Built:** /milestones and /tasks are now genuinely editable. Build clean. /milestones 6.36 → 8.85 kB, /tasks 3.54 → 6.42 kB.

**Next session goal:** M14 — apply the same drawer pattern to risks, documents, cost lines, team members, recurring meetings. Then M15 (Projects list + create + switcher) is the next major lift.

---

### Session — 2026-05-11 (M12 — Wire M8 settings into the cascade engine)

**Worked on (commit `fd3ca8e`):**
- Audited the domain layer: discovered `addWorkingDays`, `cascade`, `previewCascade`, `scheduleBackward`, `computeEndFromDuration`, `computeDurationFromDates` were already plumbed for `workingDays` + `holidays` opts (defaults `[1,2,3,4,5]` and `[]`) — the gap was that no call site ever passed the configured values
- `lib/domain/scheduling.ts`: replaced hardcoded `RAG_CONFIG` with exported `DEFAULT_RAG_THRESHOLDS` + `RagThresholds` interface; added optional `thresholds?` arg to `computeRAG()` with fallback to defaults
- `components/milestones/milestones-grid.tsx`: imported `useSettings`, destructured `{ workingDays, holidays, ragThresholds }` from settings, threaded them through every domain call site:
  - `previewCascade(domainMilestones, edit, workingDays, holidays)`
  - `cascade(..., workingDays, holidays)` inside `handlePlannedDateChange`
  - `scheduleBackward(..., workingDays, holidays)` in `handleScheduleFromGoLive`
  - `computeRAG(dm, TODAY, ragThresholds)` in the row renderer
- `lib/domain/scheduling.test.ts`: added 3 new cases on `computeRAG` thresholds — tightened red (red=2) flips Amber→Red, loosened red (red=14) flips Red→Amber, raised amber (amber=3) keeps small overdues Green

**Decided:**
- Existing 43 tests left untouched — opts are all optional with v1-equivalent defaults, so backwards-compatible
- Task scheduling deferred (tasks don't have date arithmetic in the domain layer yet)
- Budget bands deferred (costs aren't scheduled; bands only affect Settings UI for now)
- Risk RAG deferred (uses P×I score bands, not delay-day thresholds — different abstraction, would muddle to combine)

**Built:** Settings page now actually drives the schedule. Configure 4-day weeks or add Q3 bank holidays and the cascade engine respects both. RAG badges flip green↔amber↔red according to the configured thresholds. 46/46 Vitest tests pass. Build clean, 13 static pages.

**Next session goal:** Open — proposals welcome. Remaining backlog: deep-link anchors from dashboard, per-resource detail panel, entity search in command palette.

---

### Session — 2026-05-11 (M11 — Reports polish + editable absences + Dashboard click-throughs)

**Worked on (commit `ffd7311`):**

1. **Reports design sweep** — Brought the three report components in line with M10A:
   - `components/reports/weekly-report.tsx`, `steerco-report.tsx`, `workstream-report.tsx` had every saturated `bg-X-100 text-X-700` pill swept to `bg-X-50 text-X-700 border border-X-200`
   - red → rose, green → emerald, purple → violet across all three files (consistent with M10A semantic palette)
   - `app/(app)/reports/page.tsx`: header lifted from `text-lg semibold` to `text-2xl bold tracking-tight` with explanatory subtitle; tab buttons rebuilt as a 3-column card grid with icon badges, active-state shadow + primary tint, matching the M10A card pattern

2. **Editable absences on Resources page**:
   - `components/resources/resources-panel.tsx`: introduced `AbsencesContext` with `{ absences, addAbsence, removeAbsence }`; `ResourcesPanel` now holds `useState<Absence[]>(initialAbsences)` and provides the context
   - Each of the four tabs (`TeamAvailabilityTab`, `MeetingCadenceTab`, `SteerCoPreBriefTab`, `WorkstreamPreBriefTab`) destructures absences from the hook instead of reading the module import
   - `getMemberAbsencesInWeek` refactored to take absences as a parameter (was reading module-level constant)
   - New `AddAbsenceForm` component: inline card with member dropdown, start/end date inputs, reason picker, optional note, validation, Cancel + Save buttons
   - Each absence card now has a Trash2-icon remove button
   - Both `addAbsence` and `removeAbsence` fire Sonner toasts with member name + dates
   - Stale `red-*` Tailwind classes left over from M10B were also swept to `rose-*` for consistency

3. **Dashboard click-throughs**:
   - `app/(app)/page.tsx`: imported `Link` from next/link and `ChevronRight` icon
   - Upcoming-milestone `<li>` rows wrapped in `<Link href="/milestones">`
   - Pending-decision `<li>` rows wrapped in `<Link href="/documents">`
   - Each panel header gained a `View all →` link in primary
   - Row hover lights up the title in primary and reveals a ChevronRight indicator
   - Footer hint refreshed

**Decided:**
- Three items shipped together as one module M11 because they're all small polish/wiring, not new surface area. Per anti-drift §9.1, the operating doc was updated FIRST with explicit DoD and an out-of-scope list before code was written
- Deep-link anchors from dashboard (`/milestones#m6`) deferred — would require anchor-targetable rows on each grid which is a separate piece of work
- Absence persistence stays in component state (no backend, no localStorage) — consistent with ADR-006 mock-data-first; M11 just makes the mutations real for the session, not persistent
- Sweep of stale `red-*` classes done opportunistically because the same files were already open

**Built:** v2 now visually consistent across all 14 surfaces (10 routes + 3 report tabs + 4 resources tabs). Build clean, 13 static pages, `/resources` 6.24 kB → 7.5 kB (form + state plumbing), other routes unchanged.

**Next session goal:** Open — proposals welcome. Backlog candidates: deep-link anchors from dashboard, per-resource detail panel, entity search in command palette, domain integration of M8 settings into the cascade engine.

---

### Session — 2026-05-11 (M10A — Enterprise UX polish + M10B — Resources module)

**Worked on:**

M10A — Enterprise UX polish (commits `db46556`, `4905a74`):
- Refreshed design tokens in `app/globals.css`: shifted from saturated shadcn defaults to muted slate-neutral base; primary moved from bright blue (221 83% 53%) to deeper indigo (224 71% 36%); refined dark mode palette; system-ui font stack with antialiasing; body baseline lifted to 14px; tabular-nums enforced site-wide
- Expanded mock document set 4 → 13 documents: added `Document.phase`, `Document.abbreviation`, `Document.description` fields. New docs: VMP, URS, RMP, DAP, OQ Protocol, PQ Protocol, Traceability Matrix, Training Plan, Go-Live Readiness Checklist
- Rewrote `components/documents/documents-list.tsx`: phase-grouped cards (Planning/Configuration/Validation/Training/Go-Live) with phase icons (Compass/Wrench/ShieldCheck/GraduationCap/Rocket), urgency-strip left edges, color-hashed per-person avatars, person chips showing name+role, progress bars, refined filter bar with free-text search, urgency-aware "Due in N days" labels
- Rewrote `components/risks/risks-grid.tsx`: matrix widened to 340-420px sticky card, cells gradient-shaded with score number visible in empty cells, click-a-dot smooth-scrolls and rings the matching card, risk list switched from table to richer cards with always-visible mitigation panel, status icons (AlertTriangle/Shield/CheckCircle2) alongside text
- Redesigned Dashboard, Milestones grid, Tasks grid, Costs grid: KPI cards now tone-aware (good/warn/bad/neutral) with tinted icon chips, bordered enterprise badges throughout, owner avatars colour-hashed on Tasks page, status semantics unified across the app
- Lifted all 7 page headers from `text-lg font-semibold` to `text-2xl font-bold tracking-tight` with descriptive subtitles

M10B — Resources module (commit `0dbb953`):
- Created `app/(app)/resources/page.tsx` with consistent header
- Added Resources to sidebar under new PEOPLE nav group (Users icon)
- Added Resources to command palette between Costs and Documents
- Added `/resources` to topbar `routeLabels` for breadcrumb support
- Refreshed `components/resources/resources-panel.tsx` to use M10A enterprise tokens across all 4 tabs (Team Availability / Meeting Cadence / SteerCo Pre-Brief / Workstream Pre-Brief)

**Decided:**
- Two sub-modules (M10A polish, M10B Resources wiring) instead of forcing one large session — allowed visual sign-off before adding new surface area
- Resources panel logic was already complete from earlier exploratory work; M10B was mostly wiring + token refresh, not a fresh build
- Per-person avatar color hashing (Linear/Notion pattern) extended from Documents to Dashboard and Tasks pages for visual consistency
- Status semantics across the app: rose=danger, amber=warn, emerald=good, blue=primary action, violet=on-hold

**Built:** v2 looks enterprise-grade throughout, 13 static pages, build clean. All 4 Resources tabs render with refreshed tokens.

**Next session goal:** Open — proposals welcome. Backlog candidates include: deeper Resources interactions (per-resource detail panel, edit absences), report sweep with same design language, Dashboard click-throughs to detail views, search across entities in command palette.

---

### Session — 2026-05-11 (M9 — Polish + deploy)

**Worked on:**
- Installed cmdk 1.1.1
- Created `components/theme-provider.tsx` — reads `localStorage.aivello_theme` on mount, falls back to `prefers-color-scheme`, toggles `.dark` class on `<html>`, exports `ThemeProvider` wrapper + `useTheme()` hook
- Created `components/command-palette.tsx` — cmdk-based ⌘K/Ctrl+K modal: 8 nav items (Dashboard, Milestones, Tasks, Risks, Costs, Documents, Reports, Settings), ESC closes, backdrop overlay at `top-[20vh]`, `CommandPaletteTrigger` search-bar-style button with ⌘K badge
- Updated `components/topbar.tsx` — replaced static Search icon with `CommandPaletteTrigger`; added Moon/Sun toggle using `useTheme()`; added `/settings` to `routeLabels`; added `min-w-0 truncate` on breadcrumb
- Updated `app/(app)/layout.tsx` — wrapped everything in `ThemeProvider`, added `CommandPalette` as global overlay alongside `Toaster`
- Mobile overflow audit: changed `overflow-hidden → overflow-x-auto` on all table wrapper divs across: `milestones-grid.tsx`, `risks-grid.tsx`, `costs-grid.tsx` (2 instances), `tasks-grid.tsx`, `documents-list.tsx`, `weekly-report.tsx` (2 instances), `steerco-report.tsx` (3 instances), `workstream-report.tsx` (2 instances)

**Decided:**
- Dark mode uses localStorage + `prefers-color-scheme` fallback — no server-side session needed given static export constraint
- cmdk palette over a custom modal — zero boilerplate for keyboard navigation + a11y
- `overflow-x-auto` over a horizontal-scroll wrapper component — Tailwind utility is sufficient and keeps each component self-contained

**Built:** All M9 DoD items met. Build clean, 12 static pages. Pushed `4888681`.

**Next session goal:** M10 — Resources module (team availability, vacation calendar, impact highlights, SteerCo pre-brief per-member digest).

---

### Session — 2026-05-11 (M8 — Settings + holidays + Sonner)

**Worked on:**
- Installed Sonner 2.0.7
- Created `lib/domain/countryHolidays.ts` — full TypeScript port of v1 `countryHolidays.js`: 15 pharma-hub countries × 2 years of holiday data; `getCountries()` + `getHolidays(code, year?)` exports
- Created `lib/settingsStore.ts` — localStorage-backed `useSettings()` hook: workingDays (number[]), holidays (string[]), ragThresholds (redDelayDays/amberDelayDays), budgetBands (redPct/amberPct). Hydrates on mount, saves on every mutation. Validated mutations: `addHoliday`, `bulkAddHolidays`, `setWorkingDays` (min 1 day), `setRagThresholds` (amber < red), `setBudgetBands` (amber < red ≤100), `resetToDefaults`
- Created `components/settings/settings-panel.tsx` — four sections: Working Days (7 toggle buttons, enforces min 1), Country Presets (15 countries, 2026/2027/both year picker, Apply preset, scrollable holiday list with × remove, manual date input), RAG Thresholds (amber/red day inputs, blur/Enter commits, validation), Budget Burn Bands (amber/red % inputs, same pattern). Reset to defaults button. Every mutation fires a Sonner toast (success/info/error).
- Created `app/(app)/settings/page.tsx` — thin wrapper
- Updated `app/(app)/layout.tsx` — added `<Toaster position="bottom-right" richColors closeButton />` in a fragment wrapper; cascade preview already built in M4B
- Updated `components/sidebar.tsx` — added CONFIGURATION nav group with Settings (gear icon)

**Decided:**
- Settings stored in localStorage only (no backend) — persists across page refreshes within same browser; sufficient for M8 scope
- Cascade preview already complete from M4B; M8 focused on settings UI + toast infrastructure
- `useSettings()` is a hook per component instance (not a context) — sufficient since Settings page is the only mutator; other views will read from localStorage directly when they need it (M9+ scope)

**Built:** Settings page functional, 12 static pages. Build clean. Pushed `6f980f5`.

**Next session goal:** M9 — Polish + deploy: mobile audit, dark mode toggle, ⌘K command palette, final smoke test.

---

### Session — 2026-05-11 (M7 — Reports / Weekly Status Report)

**Worked on:**
- Installed SheetJS (`xlsx` 0.18.5) as a dependency
- Created `components/reports/weekly-report.tsx` (client component):
  - `buildReportData()` — derives: schedule health (Green/Amber/Red from milestone variance), this-week milestones/tasks, next-2-week milestones/tasks, open risks sorted by score, pending decisions across all documents, burn % from costLines
  - 6 KPI cards: Schedule Health (RAG), Days to Go-Live, Open Risks (+ high count), Budget Utilised ($k), Decisions Pending, Tasks In Flight (+ blocked count)
  - This Week section — completed/due milestones + tasks with status badge
  - Next 2 Weeks section — upcoming milestones with variance badge (+Xd) + upcoming tasks with priority badge
  - Top Open Risks table — score pill (color-coded High/Medium/Low), risk title, P×I, owner
  - Decisions Needed table — document name, type, person, Reviewer/Approver role badge
  - Print/Save PDF button: `window.print()` — sidebar/topbar hidden via `print:hidden` Tailwind utility + `data-sidebar`/`data-topbar` attributes; `print-color-adjust: exact` ensures colors print
  - Export Excel button — SheetJS 5-sheet workbook: Summary, Milestones (Next 2 Weeks), Open Risks, Decisions Needed, Tasks (Next 2 Weeks); filename `AivelloRIM_WeeklyReport_YYYY-MM-DD.xlsx`
  - Confidential footer
- Updated `app/(app)/reports/page.tsx` — thin wrapper, page title hidden on print
- Updated `app/globals.css` — `@media print` block: hides aside/nav/header, removes main padding, forces white background
- Updated `app/(app)/layout.tsx` — added `data-sidebar`/`data-topbar` attributes and `print:hidden` to sidebar + topbar wrapper

**Decided:**
- SheetJS over server-side generation (no server available in static export; client-side is appropriate)
- 5 sheets covers the DoD and the most useful artifacts for a pharma PM
- `window.print()` is the most reliable print-to-PDF trigger; no extra library needed

**Built:** Reports page fully functional. Build clean, `/reports` 96 kB (SheetJS is ~90 kB of that). Pushed `8cd3774`.

**Next session goal:** M8 — Settings panel (working days, holidays, country presets) + Sonner toast notifications.

---

### Session — 2026-05-11 (M6B — Tasks grid)

**Worked on:**
- Extended `lib/mockData.ts` with `Task` type (id, name, workstream, priority, status, progress, milestoneId, owner, dueDate) and 18 task records across 5 workstreams (Configuration ×4, Validation ×4, Data Migration ×4, Training ×3, Project Mgmt ×3)
- Created `components/tasks/tasks-grid.tsx` (client component):
  - `WorkstreamGroup` — collapsible (chevron toggle, default open), header shows workstream name, done/total count, blocked count badge, critical-open flag, avg progress mini bar
  - `TaskRow` — priority dot, task name + `MilestoneTag` (truncated milestone name linked by id), priority badge (hidden on small screens), owner, due date (red if overdue), inline progress (click → range slider, blur/Enter commits; auto-marks status), click-to-cycle status badge
  - Smart status/progress coupling: progress slider to 100% → Complete; > 0 from Not Started → In Progress; cycling Complete → Not Started → In Progress → Complete
  - Priority + status filter dropdowns; groups with 0 matching tasks hidden
  - Summary bar: x/y complete, in-progress badge, blocked badge
- Updated `app/(app)/tasks/page.tsx` to thin wrapper

**Decided:**
- Milestone link is display-only (tag showing milestone name) — navigation to /milestones filtered view is M9+ scope
- Progress editing uses a range slider (step 5) on click rather than a number input — more touch-friendly and pharma-appropriate (5% granularity)

**Built:** Tasks grid fully functional. Build clean, 2.97 kB. Pushed `8ea8d8d`. M6 fully complete.

**Next session goal:** M7 — Weekly Status Report (printable layout + Excel export via SheetJS).

---

### Session — 2026-05-11 (M6A — Risks + Costs grids)

**Worked on:**
- Extended `lib/mockData.ts` with `CostLine` type and `costLines[7]` (Implementation/Validation/Migration/Integration/Training/License/Internal — $2M total, $780k actual, matching budgetTrend)
- Created `components/risks/risks-grid.tsx` (client component):
  - `RiskMatrix`: 5×5 P×I heatmap, cell color by score band, risk dots at coordinates
  - `RiskRow`: score pill, title + category badge, P×I columns, clickable status badge, expandable mitigation
  - Sort: score / probability / impact; status filter pills; category dropdown
- Created `components/costs/costs-grid.tsx` (server component — no interactivity):
  - 4 KPI cards (total budget, spent, remaining, line count)
  - Overall burn bar with threshold coloring (amber >60%, red >85%)
  - Cost breakdown table: category colored pill, description, contract type badge, budget $k, actual $k, per-row burn bar, totals row
  - Monthly trend table: per-month delta planned/actual + variance indicator + cumulative columns; Jun forecast row dimmed

**Decided:**
- Costs is a server component — no state needed, all data is static mock; only Risks needs client state for status cycling
- costLines actuals sum to exactly $780k to match budgetTrend May cumulative figure

**Built:** Both grids functional. Build clean — /risks 4.05 kB client, /costs 137 B server. Pushed `d33ad81`.

**Next session goal:** M6B — Tasks grid: workstream grouping, priority flags, inline progress, milestone link.

---

### Session — 2026-05-11 (M5 — Documents: chips + decision tracking)

**Worked on:**
- Created `components/documents/documents-list.tsx` (client component):
  - `deriveStatus()` — auto-derives document status from decision state: draft → in-review → reviewed → approved / rejected
  - `DecisionChip` — circular avatar with initials, status micro-badge overlay (✓/✗/·), click cycles pending → approved → rejected → pending, tooltip with name + role + date
  - `HistoryPane` — expandable decision history table: person, role, Review/Approval type, status badge, date
  - `DocumentCard` — type badge, auto-derived status badge, due date (overdue highlighted red), pending count badge, chip rows for reviewers and approvers, chevron toggle for history pane
  - `DocumentsList` — clickable status pill filter bar, type dropdown filter, pending-total callout, 2-column responsive grid of cards
- Updated `app/(app)/documents/page.tsx` to thin wrapper

**Decided:**
- `deriveStatus()` re-runs on every render from current chip state — no stored status field needed in local state
- Forecast date on documents not in M5 scope (approval date auto-set to TODAY when chip is clicked to "approved")
- IQ Protocol (draft, no chips assigned) shows an italic note rather than empty chip area

**Built:** Documents view fully functional. Build clean, 4.01 kB page bundle. Pushed `9f2577a`.

**Next session goal:** M6A — Risks grid (P×I score matrix, colour pills, sort) + Costs grid (budget vs actual, burn bars, totals).

---

### Session — 2026-05-11 (M4B — Milestones grid: interactive editing)

**Worked on:**
- Extended `lib/mockData.ts` Milestone type with `predecessor?: string`, `duration?: number`, `lag?: number`; updated all 13 milestones with realistic Veeva RIM dependency chain (m1 → m2 → m3/m4 → m5 → m6 → m7 → m8 → m9/m11 → m10 → m12 → m13)
- Created `components/ui/dialog.tsx` — Radix Dialog wrapper (DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose)
- Created `components/milestones/milestones-grid.tsx` — full interactive client component:
  - Phase filter + status filter dropdowns
  - "Schedule from Go-Live" button: calls `scheduleBackward(allMilestones, project.goLiveDate)`, applies result
  - "Reset" button: restores original mock data
  - `DateCell` sub-component: click-to-edit date input, Enter/Escape/blur handling
  - `StatusCell` sub-component: click-to-dropdown for non-locked milestones
  - Planned date edit triggers `previewCascade()` + cascades all successors, shows modal if downstream impact
  - `CascadePreviewDialog`: lists affected milestones with old/new dates + day shift, Apply or Discard
  - Forecast date edit: direct update, no cascade (projection field)
  - Lock/unlock toggle per row: click lock icon
  - RAG + dependency status computed live from domain engine
- Updated `app/(app)/milestones/page.tsx` to thin wrapper

**Decided:**
- Forecast date has no cascade — it's a projection, not a plan. Only planned date cascades.
- Locked milestones block both manual editing AND cascade pass-through (domain `lockDate` behaviour)
- `toScheduleMs()` derives `plannedStart = addWorkingDays(plannedDate, -(duration-1))` on the fly — not stored in mockData

**Built:** Full M4 DoD met. Build clean, /milestones is 6.09 kB client bundle.

**Committed:** `47865e3` on `enterprisepharmapm-pro`.

**Next session goal:** M5 — Documents view with per-person reviewer/approver chips.

---

### Session — 2026-05-11 (M4A — Milestones grid: port logic + read-only grid)

**Worked on:**
- Read `src/domain/dates.js`, `src/domain/scheduling.js`, `src/test/test.js`, `src/config/rules.js` to understand RAG thresholds (redDelayDays: 5, amberDelayDays: 0)
- Created `v2/lib/domain/dates.ts` — TypeScript port of all 8 date functions (isValidISO, dayOfWeek, today, nowISO, addDays, addWorkingDays with negative-day support, daysBetween, compare)
- Created `v2/lib/domain/scheduling.ts` — TypeScript port of all 8 scheduling functions with proper types (ScheduleMilestone interface, RAG type, etc.)
- Installed Vitest 4.1.5 as dev dependency
- Created `v2/lib/domain/dates.test.ts` — 13 tests covering all date functions
- Created `v2/lib/domain/scheduling.test.ts` — 30 tests covering all scheduling functions
- All 43 Vitest tests pass in 148ms
- Rewrote `v2/app/(app)/milestones/page.tsx` — full read-only grid: 13 mock milestones, computed RAG + dependency status from domain engine, variance days, lock icon, legend

**Decided:**
- Domain functions run server-side (pure TypeScript, no "use client" needed) — computed at Next.js static export build time
- RAG thresholds hardcoded from v1 config (redDelayDays: 5, amberDelayDays: 0) — configurable in M8 settings
- "today" pinned to "2026-05-11" for grid display (matches mock data's current date)

**Built:** 43/43 Vitest tests pass. Milestones grid live with RAG + dependency engine. Build clean (11 static pages).

**Committed:** `f3b4487` on `enterprisepharmapm-pro`.

**Next session goal:** M4B — interactive milestones grid: inline editing, cascade preview modal, "Schedule from Go-Live" action, per-column filters, lock toggle.

---

### Session — 2026-05-11 (M3 — Dashboard view)

**Worked on:**
- Installed Recharts 3.8.1
- Created `lib/mockData.ts` — full Veeva RIM mock dataset: project info, 6 phases, 13 milestones, 6 risks, 4 documents (with per-person Decision rows), 6-month budget trend, 6-month risk trend, `getKpis()` derived helper
- Created `components/dashboard/sparkline.tsx` — Recharts AreaChart client component with gradient fill
- Created `components/dashboard/phase-progress.tsx` — 6-segment phase bar with completion %
- Rewrote `app/(app)/page.tsx` — full dashboard: KPI cards from real mock data, phase bar, two sparklines, top-5 milestones with variance, top-3 pending docs with decision dots

**Decided:**
- Click-through from dashboard rows to detail views (milestones, documents) deferred to M4/M5 — will happen naturally when those views are built
- Hover tooltips on Recharts charts already work out of the box (no extra work needed)

**Built:** Dashboard confirmed live and polished. All M3 DoD items met.

**Committed:** `1b7183d` on `enterprisepharmapm-pro`.

**Next session goal:** M4A — port v1 scheduling/dates domain logic to TypeScript, Vitest tests, read-only milestones grid.

---

### Session — 2026-05-11 (M2 — App shell)

**Worked on:**
- Installed shadcn/ui component deps: `@radix-ui/react-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-separator`
- Created shadcn components: Sheet, Avatar, Badge, Separator
- Built `components/sidebar.tsx` (client component, usePathname for active state)
- Built `components/topbar.tsx` (breadcrumb, search/bell/export, mobile Sheet trigger)
- Created `app/(app)/layout.tsx` — app shell with fixed sidebar + scrollable main area
- Deleted old `app/page.tsx` (Hello RIM placeholder)
- Created 7 routes under `app/(app)/`: `/`, `/milestones`, `/tasks`, `/risks`, `/costs`, `/documents`, `/reports`
- Dashboard page: 4 real KPI cards (Schedule Health, Open Risks, Budget Utilised, Days to Go-Live)
- Added `trailingSlash: true` to `next.config.mjs` for GitHub Pages sub-route compatibility
- 11 static pages build clean, TypeScript clean, deployed

**Decided:**
- Skip `pnpm dev` local testing step — CI deploy is fast enough (40s build + 10s deploy), go straight to GitHub Pages
- Dashboard KPI cards use hardcoded mock values for now (real mock data from `lib/mockData.ts` comes in M3)

**Built:** App shell live at `https://buildpod.github.io/pharmapm-pro/v2/`. All 7 nav items confirmed working via Vineet's screenshot.

**Committed:** `164cb1b` — M2 app shell commit on `enterprisepharmapm-pro`.

**Next session goal:** M3 — Dashboard view. Real mock data, Recharts sparklines, upcoming milestones list, decisions pending list.

---

### Session — 2026-05-11 (M1 — Project setup)

**Worked on:**
- Created branch `enterprisepharmapm-pro` on `buildpod/pharmapm-pro`
- Copied `CLAUDE.md` and `AIVELLO_OPERATING_DOC.md` into the repo root
- Scaffolded Next.js 14.2.35 in `v2/` using `pnpm create next-app` with TypeScript + Tailwind + App Router
- Added shadcn/ui core packages manually (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `lucide-react`)
- Created `lib/utils.ts` (cn helper) and `components/ui/button.tsx` (full shadcn Button with variants)
- Updated `tailwind.config.ts` and `app/globals.css` with shadcn design tokens (CSS variables for all color roles)
- Replaced default Next.js page with "Hello, RIM" page: AivelloStudio RIM heading, FlaskConical icon, shadcn Button confirmed rendering
- Configured `v2/next.config.mjs`: `output: 'export'`, `basePath: '/pharmapm-pro/v2'`, `images.unoptimized: true`
- Added `.github/workflows/deploy.yml`: triggers on push to `enterprisepharmapm-pro` when `v2/**` changes; builds in `v2/`, uploads `v2/out/` to GitHub Pages via Actions
- Added proper `.gitignore` to repo root (the existing `gitignore` file was missing the leading dot)
- Confirmed `pnpm build` passes (static export, TypeScript clean, no errors)
- Vineet confirmed page renders correctly at localhost — screenshot verified

**Decided:**
- New branch on `pharmapm-pro` (not a new repo) — confirmed by Vineet's instruction
- Brand name: AivelloStudio RIM — used in page title and heading
- GitHub Actions auto-deploy: YES, wired up and confirmed (Vineet set Pages source to "GitHub Actions")
- `pnpm install --ignore-scripts` required in CI due to pnpm 11's `unrs-resolver` build approval gate

**Built:**
- `v2/` — full Next.js 14 + TypeScript + Tailwind + shadcn/ui scaffold
- `v2/app/page.tsx` — Hello RIM page
- `v2/components/ui/button.tsx` — shadcn Button
- `v2/lib/utils.ts` — cn helper
- `.github/workflows/deploy.yml` — GitHub Actions deploy pipeline
- `CLAUDE.md`, `AIVELLO_OPERATING_DOC.md` — project docs added to repo

**Committed:** All of the above on branch `enterprisepharmapm-pro` and pushed to origin.

**Next session goal:** M2 — App shell. Sidebar, top bar, routing for 7 views, each with a placeholder page.

---

### Session — 2026-05-11 (M0 — Tooling setup)

**Worked on:**
- Vineet got new MacBook Pro M5; full dev environment setup
- Walked through Homebrew + Node + pnpm + git + gh + uv installation
- GitHub CLI auth via web browser flow (GitHub Mobile 2FA)
- Cloned `buildpod/pharmapm-pro` repo to `~/projects/pharmapm-pro`
- Ran v1 test suite locally → **305/305 passed in 12ms**

**Decided:**
- M1 will use Claude Code (already installed) as the implementation tool, driven from inside the cloned repo
- M1 should add a GitHub Actions workflow for auto-deploy to Pages on push (proposal — needs Vineet confirmation at start of M1)
- Brand name, repo strategy (new repo vs new branch) still open from section 8 questions below

**Built:** Nothing in code. M0 was environment setup only.

**Committed:** No code commits. Operating doc updated (this entry + section 4 marked M0 complete).

**Next session goal:** M1 — Project setup. Per section 5, definition of done: live URL on GitHub Pages with shadcn button rendering on phone.

**Open questions for Vineet before M1 starts:**
1. Are we using a new repo (`aivello-rim`) or a new branch on `pharmapm-pro`?
2. Brand name confirmation — "Aivello RIM" / "AivelloStudio RIM Cloud" / something else?
3. Should M1 include a GitHub Actions auto-deploy workflow (`.github/workflows/deploy.yml`) so we never drag-and-drop again?

### Session — 2026-05-06 (planning)

**Worked on:**
- Recovered from multi-tenant SaaS hallucination
- Confirmed single-tenant deployable model (ADR-001)
- Confirmed UI-first approach over backend-first (ADR-006)
- Wrote this operating document

**Decided:**
- Rewrite v1 UI in React + shadcn rather than patch vanilla JS further
- Stay on GitHub Pages, no new platform commitment yet
- Keep v1 deployed as reference

**Built:** Nothing — this was a planning session.

**Committed:** This document.

**Next session goal:** M1 — Project setup. Definition of done: live URL on GitHub Pages with shadcn button rendering on phone.

**Open questions for Vineet before M1 starts:**
1. Are we using a new repo (`aivello-rim`) or a new branch on `pharmapm-pro`?
2. Brand name confirmation — "Aivello RIM" / "AivelloStudio RIM Cloud" / something else?
3. Vineet's local environment — does Vineet want to run `pnpm install` locally, or have me write everything as a deployable artifact?

---

## 9 — Anti-drift rules (Claude must obey)

These are non-negotiable. Vineet can quote any of them back to me.

1. **No new modules without updating section 4 first.** If Vineet asks for something not in section 5, I must check whether it's in scope, and if not, propose adding it to section 7 (Backlog) for a future session.

2. **No proposing alternatives that contradict section 3.** Multi-tenant, microservices, custom CSS, vanilla JS rewrite — all rejected. Re-debating them requires a new ADR with substantive new evidence.

3. **No starting work without a confirmed Current Module.** If section 4 says "none," I must first agree with Vineet what M-number we are starting before writing any code.

4. **No ending a session without updating section 8.** Even a planning session gets a log entry.

5. **No "let me also build X while I'm here."** One module per session. New ideas go to section 7.

6. **No assuming code runs.** I write code. Vineet (or another tool) runs it. I do not claim something works unless I have seen the test output.

7. **If Vineet says "check the operating doc," I stop, re-read this document, and respond from it.** Not from session memory, not from training defaults.

8. **If Vineet says "you're hallucinating," I stop immediately, do not defend, and ask Vineet to point to the section being violated.**

9. **Periodic architectural checkpoint.** After every 4 feature modules ship, the next module slot is a checkpoint. The checkpoint must:
   (a) Run the full Vitest suite + production build, surface any regressions.
   (b) Quick competitive scan — pick 1–2 tools in our space (Monday / Smartsheet / Asana / MS Project / Linear / a pharma-specific tool) and check whether any new capability has shipped that would change our roadmap.
   (c) Review §5.2 tech-debt index. Decide whether a refactor module is warranted before next feature work.
   (d) Update §5.2 with any new debt items the recent modules introduced.
   If no debt requires attention and no competitive shift is found, the checkpoint is a no-op session — just stamp the discipline. Vineet is told either way.

   Counted from M21 onward: M21–M24 are 4 feature modules → M25 is the next checkpoint. M20.2 itself is the inaugural exercise of this rule, not on the counter.

---

## 10 — Glossary (for clarity across sessions)

- **v1** — the existing PharmaPM Pro build at `buildpod.github.io/pharmapm-pro` (vanilla JS, deployed, working)
- **v2** — the rewrite this document plans (Next.js + shadcn, not yet started)
- **ADR** — Architecture Decision Record (an entry in section 3)
- **Module** — one focused unit of work, designed to fit one session
- **Current Module** — the single thing being worked on right now (section 4)
- **Definition of Done (DoD)** — what must be true before a module is complete
- **Backlog** — captured ideas not in current scope (section 7)
