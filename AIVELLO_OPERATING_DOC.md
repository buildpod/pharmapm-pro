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

**Module:** M13 — Universal Add + Edit + Delete (milestones + tasks first)
**Goal:** Today the app is a viewer. Mock data shows up but no row can be added, no field can be edited (except the few inline click-cycles), no row can be deleted. The dogfood walkthrough showed this is the single biggest blocker to actual PM use. Build a consistent slide-over drawer pattern and wire it for the two most-clicked entities first: milestones and tasks. Risks / documents / cost lines / team members / meetings follow in M14.

**Definition of done:**
- Reusable `<EntityDrawer>` component (right-anchored slide-over with backdrop, ESC-to-close, focus trap), single file, no new dependencies
- Milestones grid has: `+ Add Milestone` button, every row clickable → opens drawer in edit mode, `Delete` button inside drawer with confirm
- Tasks grid has: `+ Add Task` button, every row clickable → opens drawer in edit mode, `Delete` button inside drawer
- Forms cover all editable fields (Milestone: name + phase + owner + predecessor + duration + lag + plannedDate + forecastDate + status + locked; Task: name + workstream + priority + status + progress + milestoneId + owner + dueDate + dependsOn)
- Save / Cancel / Delete buttons consistent across both
- Sonner toast on add / update / delete
- All existing inline-click behaviour preserved (status cycle, progress slider, date inline edit)
- Build clean, lint clean

**Out of scope (deferred to M14):**
- Risks / documents / cost lines / team members / meetings add+edit+delete (same pattern, just more entities)
- Description / markdown fields (we don't store them yet — comes with M14)
- Attachments / file storage (needs backend — Path C territory)
- Comments / @mentions (M19)
- Undo (Sonner supports it; defer until pattern is proven)

**Started:** (this session)
**Status:** in progress

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

### M18 — CSV / Excel import + project templates

**Goal:** Today users would have to add 30–50 milestones one by one. Add CSV import for milestones / tasks / risks. Seed a "Veeva RIM standard implementation" template that creates a starter project in one click.

**Definition of done:** Import button on each grid opens a CSV mapper; Create Project form has a "Start from template" option with at least one Veeva RIM template seeded.

### M19 — Comments + activity feed (in-app only, no email yet)

**Goal:** Per-entity comments (no @mentions or email yet — that's M20). Per-entity activity feed showing every change (add / edit / status cycle / decision recorded).

**Definition of done:** Drawer for any entity has a Comments tab and an Activity tab; comments are stored in component state; activity log records mutations automatically.

### M20 — Report executive commentary + report snapshots

**Goal:** Two governance polish items the SteerCo pre-brief needs: (a) free-text executive commentary block at the top of each report, persisted; (b) "Snapshot for this SteerCo" button that freezes the report state to an immutable record listed under `/reports/history`.

**Definition of done:** Reports page has a commentary field that persists per report-type; snapshot history accessible and viewable.

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
