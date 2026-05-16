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

---

## 4 — Current Module + Next Module

> This is the **only** part of the doc Claude updates without explicit Vineet input. Update at end of every session.

### Current Module

**Module:** _none — awaiting next goal._ Per §5.1 plan, next up is **M19 — Clean project export workbook**.

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

### M20 — Timesheets + derived labour cost (EVM closure)

**Goal:** Auto-derive per-resource hours from task ownership + meeting attendance − absences. With `hourlyRate` on team members, surface **actual labour cost** so we can close the Earned Value Management loop (PV vs EV vs AC).

**Definition of done:** Resources tab gains a Timesheets sub-view per member showing derived hours by week with cost roll-up. `/costs` reconciles against derived labour. Reads from existing mock data (tasks, meetings, absences); no manual time entry yet.

### M21 — AI-agent team-member type + token-cost calc

**Goal:** First-class support for AI agents as team members. `TeamMember.kind: "human" | "ai-agent"`. Agents have `model`, `tokensPerTask`, `costPerMTokens` instead of hourly rate. Resources view shows mixed human/AI roster with cost-per-effort.

**Definition of done:** Add agent in Resources form; agents can be assigned as task owners; cost on `/costs` and `/my-items` includes token-derived spend. Positions the tool as the first PM software designed for human + AI hybrid teams.

### M22 — Change Request entity + impact-driven workflow

**Goal:** PMBOK §4.6 implemented natively. New `ChangeRequest` entity captures scope changes with rationale + business value. System auto-computes impact on iron triangle (scope, schedule, cost) + risk delta. CR routes through CCB, on approval auto-applies cascade.

**Definition of done:** Submit CR from any entity → impact panel computes 3-parameter delta → route to configured approvers → on approve, auto-apply with audit log entry. CR list and Change Log accessible per project.

### M23 — Configurable CCB + risk-realization auto-CR

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

## 6 — Known issues being managed

| Issue | Mitigation |
|---|---|
| Claude has no cross-session memory | This document is the persistent memory. Read it every session. |
| Claude tends to drift into building new things | Section 4 (Current Module) is the only thing being worked on. Anything else goes to section 7. |
| Claude tends to hallucinate scope (e.g., proposing multi-tenant SaaS) | All architectural decisions are in section 3. Re-debating them requires a new ADR row. |
| Claude tends to optimize for "produce something this session" | Each module has a Definition of Done. Sessions don't end without it. |
| Claude can't run code autonomously between sessions | Vineet runs `pnpm test` and `pnpm dev` and reports results. Claude does not assume. |
| v1 has comma-separated reviewer strings (the limitation that started this rewrite) | M5 fixes this with proper Decision rows. Until then, v1 stays as-is. |

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

---

## 10 — Glossary (for clarity across sessions)

- **v1** — the existing PharmaPM Pro build at `buildpod.github.io/pharmapm-pro` (vanilla JS, deployed, working)
- **v2** — the rewrite this document plans (Next.js + shadcn, not yet started)
- **ADR** — Architecture Decision Record (an entry in section 3)
- **Module** — one focused unit of work, designed to fit one session
- **Current Module** — the single thing being worked on right now (section 4)
- **Definition of Done (DoD)** — what must be true before a module is complete
- **Backlog** — captured ideas not in current scope (section 7)
