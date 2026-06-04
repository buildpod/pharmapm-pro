# UI Flow Inventory — PharmaPM Pro (AivelloStudio RIM)

> **Purpose:** Plain-language description of every screen, flow, and interaction
> in the app, written so a UX-heuristics analysis (Nielsen, Krug, Kahneman,
> ADKAR, nudge theory) can be applied without reading code. Describes the
> *current shipped state* (as of M28), not aspirations. Pain points are flagged
> honestly so the audit has real targets.
>
> **What the product is:** A project-management platform for enterprise software
> implementations — lead template is Veeva RIM (pharma regulatory), but designed
> to template across SAP, LIMS, eQMS, etc. Desktop-first. Used by Project
> Managers daily and by SteerCo executives (CTO/CFO/Sponsor) weekly. Regulated-
> industry context: must read as audit-defensible, not playful.

---

## 1. Global shell (every screen)

- **Left sidebar** (fixed, ~232px): brand mark → active-project name + phase →
  grouped nav (Overview / Planning / Risk & Finance / People / Documentation /
  Configuration) → user pill at the bottom. Some nav items show a red/blue count
  badge (e.g. Risks "3", Documents "2").
- **Topbar** (fixed, 56px): breadcrumb (project / page) → search field with ⌘K
  hint → "Alerts" pill with a count → "Export" button.
- **Content area**: scrolls; each page opens with an eyebrow label + serif page
  title + a meta row (em-dot separated facts).
- **Project switcher**: dropdown in the sidebar; switching re-scopes every page
  to the selected project.
- **Toasts**: bottom-right, colour-coded (green success / amber warning / red
  error / blue info). Auto-dismiss ~5s.

**Known pain:** topbar still uses older styling inconsistent with the refactored
pages. "Alerts" count isn't clickable to a list. Search is ⌘K-only (no visible
results page).

---

## 2. Dashboard (home)

**Who:** PM daily; CTO/CFO weekly. **Answers:** "What's the state of this project?"

Reading order top→bottom:
1. **Page header** — project name (serif), phase, Go-Live target, last refresh.
2. **KPI grid** (4 cards, each with a coloured left accent rail):
   - Schedule Health (On Track / At Risk + variance label)
   - Open Risks (count + high/medium pills)
   - Budget Utilised (% + $ of $)
   - Days to Go-Live (countdown + target date)
3. **Charter strip** — full-width navy band: charter status pill (Draft /
   Submitted / Approved), sponsor, last-updated. Clicks through to /charter.
4. **Phase tracker + Project Health** (side by side): 6-segment GAMP-5 lifecycle
   bar (Initiation→Go-Live with % each) | health score "95/100" + a single
   alert row.
5. **Risk + Budget charts** (side by side): two SVG sparklines (open-risks/month,
   cumulative spend).
6. **Upcoming Milestones + Decisions Needed** (side by side): list rows with
   dates + status pills | document approval rows with approver avatars.

**Known pain:**
- Health score "95" is hand-set, not computed — could mislead.
- KPIs are point-in-time; no trend ("up from last week").
- No single "should I trust this project?" verdict — the exec has to synthesize
  4 KPIs themselves.
- "Decisions Needed" pulls from documents, not the Decisions register — slightly
  confusing overlap.

---

## 3. Tasks

**Who:** PM daily. **Answers:** "What work is open, who owns it, what's blocked?"

Layout:
1. **Workstream summary strip** — 5 KPI cards (one per workstream: Configuration,
   Validation, Data Migration, Training, Project Mgmt), each with task count +
   avg progress + accent rail by state.
2. **Filter toolbar** — status filter chips (All / In Progress / Not Started /
   Blocked, each with counts) + priority chips (Critical / High / Medium) +
   workstream dropdown + "Mine" toggle + "New task" button.
3. **Task table** — collapsible workstream groups; each group header shows
   count + critical-open badge + a state pill. Task rows have 9 columns:
   checkbox, ID (mono), name + linked-milestone meta, priority pill, owner
   avatar, due date + "in N days" delta, progress bar + %, status pill,
   dependency chips (showing which upstream tasks it waits on, +N overflow).
4. **Footer** — "N of M tasks shown · grouped by workstream".

**Interactions:** click checkbox or status pill to advance status; click progress
bar to edit % inline; click task name to open edit drawer; click "New task" to
open create drawer.

**Add/Edit Task drawer** (right slide-over): name, workstream, owner, priority,
status, progress slider, milestone link, due date, and a "Depends on" picker
(checkbox list of other tasks; tasks that would create a dependency loop are
greyed out with a "cycle" chip).

**The cascade flow (the product's signature interaction):** when a PM saves a
task with a *later* due date, instead of saving silently, a **Schedule Change
Preview** drawer opens showing every downstream task that would shift, grouped
by workstream, each with a before→after date + mini-timeline bar + a checkbox to
include/exclude + an editable override date. If the change pushes a linked
milestone, that milestone shift is also shown. The PM reviews, adjusts, and
clicks "Save · N changes". If the dependency data contains a loop, the engine
can't compute the preview and instead shows a **Dependency Resolution Workbench**:
a plain-language explanation ("these tasks depend on each other in a way that
loops back"), the loop drawn as a chain, a "Suggested fix" edge, and per-link
actions (Change to parallel / Remove this link / Add note). The user's edit
saves regardless; only the downstream preview is blocked until the loop is fixed.

**Known pain:**
- The cascade drawer can get tall with many affected rows (density).
- The "Depends on" picker is a flat checkbox list — doesn't scale past ~20 tasks
  (no search).
- New PMs may not understand why a drawer appeared after hitting save.

---

## 4. Milestones

**Who:** PM + SteerCo. **Answers:** "Are we hitting our gates?"

Layout: grid view (default) or Gantt toggle. Grid rows show: status icon,
milestone name + owner, phase, planned date (editable inline), forecast date
(editable inline) + variance, duration, RAG badge, dependency status, lock
toggle. Gantt view shows bars by planned start→end with predecessor arrows and
critical-path highlighting.

**Interactions:** click planned date → cascade preview (same engine as Tasks).
Click forecast date → saves directly (forecast is a projection, not the
baseline; doesn't cascade — but a variance toast fires if the slip is large).
"Schedule from Go-Live" button back-schedules all milestones from the target.

**Known pain:**
- Two editable date columns (Planned vs Forecast) with different behaviours — a
  PM may not know which one cascades and why.
- Gantt is read-only (can't drag bars).

---

## 5. Charter

**Who:** Sponsor + PM; referenced by every audit. **Answers:** "What authorised
this project?"

Read view: status pill + key-facts grid (sponsor, PM, go-live, budget) + a
signoff bar when approved + sections for Purpose, Objectives, In/Out of Scope,
Success Criteria, Assumptions, Constraints. Edit drawer collects all fields;
status has Draft / Submitted / Approved with conditional approver+date fields
when approved. Empty state when no charter exists, with a "Create charter" CTA.

**Known pain:** long form to fill; no template/preset content to start from.

---

## 6. Risks

**Who:** PM + SteerCo. **Answers:** "What could go wrong, how bad, who owns it?"

Dual view: probability×impact heatmap (5×5, colour-tiered) on the left, cross-
linked to risk cards on the right (click a dot → highlight its card). Each card:
title, category, P×I score, status, owner, mitigation. Counts summary (high/
medium/low).

**Known pain:** no link from a risk to an issue it realised into; no aging/trend;
no risk-vs-mitigation-rate metric.

---

## 7. Issues

**Who:** PM; read by auditors. **Answers:** "What's actually broken right now?"

Flat table grouped/sorted by severity then status. Columns: severity dot + title
+ description, severity pill, status pill, owner, raised date, resolved date.
Filter by severity + status + Mine. "Raise Issue" button. Counts pill (open / in
progress / resolved / critical-to-clear). Edit drawer: title, description, raised
date, owner, severity, status, resolution plan, conditional resolved-date,
optional milestone/task link.

**Known pain:** issues aren't linked back to the risk that predicted them; no
SLA/aging on critical issues.

---

## 8. Decisions

**Who:** PM + SteerCo; core audit artifact. **Answers:** "What did we decide,
when, why, and what did it supersede?"

Flat table by status. Each decision: title, context, decided date, decided-by,
alternatives considered, chosen option, rationale, status (Pending / Approved /
Rejected / Superseded), supersedes-link. Edit drawer collects all; alternatives
is a list-of-strings field.

**Known pain:** no predicted-vs-actual cost impact (spec'd in M28, not built); no
visual supersession chain.

---

## 9. Costs

**Who:** PM + CFO. **Answers:** "Where is the money going, are we over?"

Top rollup: Total Budget / Spent to Date (+ burn %) / Remaining. Cost-line table:
category, description, contract type (T&M / Fixed / Internal), budget, actual,
burn %. Monthly burn trend table.

**Known pain:**
- Burn % is the only health signal — backward-looking, no forecast (EVM spec'd in
  M28, not built).
- No drill from a high category down to the lines driving it.
- No variance attribution (why are we over?).
- Owner/vendor not shown per line.

---

## 10. Resources (People & Meetings)

**Who:** PM. **Answers:** "Who's on the team, when do they meet, who's away?"

Three blocks: team members (name, role, initials, SteerCo mandatory/optional),
recurring meetings (with attendee initials), absences (with reason). Edit drawers
for each.

**Known pain:** no calendar sync (spec'd in M29); no capacity/load view (who's
overcommitted); meetings don't link to decisions/tasks produced.

---

## 11. Documents

**Who:** PM + reviewers/approvers. **Answers:** "What docs exist, what's their
approval state?"

Table with full RACI: each document shows owner (Responsible), reviewers and
approvers as avatar rows with per-person approval status (approved/pending/
rejected), version, phase, due date, pending count. Status lifecycle (draft →
in-review → reviewed → approved).

**Known pain:** dense RACI can overwhelm; no "what's blocking this approval" view.

---

## 12. My Items

**Who:** the logged-in PM. **Answers:** "What's on MY plate?"

Aggregates everything owned by the current user (mock = Vineet) across entities:
overdue / due-this-week / blocked rows pulled from tasks, milestones, risks,
documents.

**Known pain:** read-only aggregation; can't act inline (must navigate to the
entity).

---

## 13. Reports

**Who:** PM generates; SteerCo consumes. **Answers:** "Give me a status doc."

Three report types: Weekly Status, Steering Committee (RAG + escalations + gate
decisions), Workstream. Export to print/PDF + a multi-sheet Excel workbook.

**Known pain:** reports are generated artifacts, not interactive; limited
filtering.

---

## 14. Settings

**Who:** admin/PM. Working days, holidays, RAG thresholds, country-holiday
presets. Drives the scheduling engine's working-day arithmetic.

---

## 15. Cross-cutting interaction patterns

- **Inline edit:** click a value (date, status, progress) to edit in place.
- **Form drawer:** right slide-over for create/edit of any entity.
- **Cascade preview drawer:** the signature flow — schedule changes show
  downstream impact before commit, with selective include/exclude/override.
- **Status pills:** one colour-meaning across the whole app (rose=blocking,
  amber=soft conflict, blue=info, emerald=success, slate=neutral).
- **Audit trail:** every change is logged (not yet surfaced as a user-facing
  "history" view — it exists in the data layer only).
- **Empty states:** most pages have a "nothing here yet + create CTA" state.

---

## 16. The biggest known gaps (honest)

1. **No onboarding / first-run guidance.** A new PM lands on a populated demo
   project with no tour, no "start here".
2. **No trend / time-series anywhere.** Everything is point-in-time.
3. **No drill-to-root-cause.** Leadership sees numbers, can't click to "why".
4. **Audit log invisible.** The provenance data exists but no UI surfaces it.
5. **Cascade drawer cognitive load** at high row counts.
6. **Dependency picker doesn't scale** past ~20 tasks.
7. **Forecast/EVM missing** — costs and schedule are backward-looking only.
8. **Executive verdict missing** — no single "project confidence" synthesis on
   the dashboard.
9. **Inconsistent chrome** — topbar + a few pages not yet on the new design
   system.
10. **Language slips** — occasional engineering terms ("cascade") leak into
    user-facing copy despite a plain-language discipline.

---

**Use this with:** Nielsen's 10 heuristics, Krug's "Don't Make Me Think",
Kahneman (cognitive load / System 1–2), the Hook Model, ADKAR (adoption), and
nudge theory. Map each principle onto the flows above and the gaps in §16.
