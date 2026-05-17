# Cascade Algorithm — Formal Specification

> **Status:** Living document. Authored 2026-05-17 as part of M20.4.
> **Source of truth:** `v2/lib/domain/scheduling.ts` + `v2/lib/domain/dates.ts`.
> **Test coverage:** `v2/lib/domain/scheduling.algorithm.test.ts` (M20.4 matrix) + `v2/lib/domain/scheduling.test.ts` (functional cases).

This document specifies exactly what the cascade engine does, what it does not do, and where its behaviour deviates from PM industry references. It exists because cascade output feeds SteerCo decisions and audit logs — silent edge-case wrongness compounds into bad money / resource / vendor calls. Every behavior listed here has a corresponding test in the matrix.

---

## 1. Entities

### 1.1 Milestone (`ScheduleMilestone`)

| Field | Type | Required | Semantics |
|---|---|---|---|
| `id` | `number` | yes | Stable numeric identifier. UI represents as `"m6"` string; engine uses raw number. |
| `name` | `string?` | no | Display only. Engine ignores. |
| `predecessor` | `number?` | no | Single-predecessor model. The id of the milestone this one waits on. **No multi-predecessor support.** |
| `lag` | `number?` | no | Working days of buffer AFTER predecessor's `plannedEnd` before this one's `plannedStart`. Coerced via `parseInt(... ?? 0) \|\| 0`. Negative values are not validated. |
| `duration` | `number?` | no | Working days. Coerced via `parseInt(... ?? 1) \|\| 1`. Minimum effective value: 1 (same-day). |
| `plannedStart` | `string?` (ISO `YYYY-MM-DD`) | no | Computed by cascade if a predecessor exists; otherwise PM-set. |
| `plannedEnd` | `string?` (ISO) | no | `plannedStart + (duration - 1)` working days. **The end date IS the completion date** — a 1-day milestone has `plannedStart === plannedEnd`. |
| `status` | `string?` | no | Used by `cascade()` for the "Not Started" forward-pull-only rule (§4.1) and by `computeRAG()`. Engine recognises: `"Not Started" \| "In Progress" \| "Complete" \| "Blocked"`. |
| `lockDate` | `boolean?` | no | If `true`, cascade leaves this milestone's dates untouched. The selective-cascade exclude/override layer sets this to `true` to honour PM intent (§5.2, §5.3). |

### 1.2 Task (`TaskScheduleEntry`)

| Field | Type | Required | Semantics |
|---|---|---|---|
| `id` | `string` | yes | E.g. `"t12"`. |
| `name` | `string?` | no | Display only. |
| `dueDate` | `string` (ISO) | yes | The single date that defines a task. **Tasks have no duration in the engine.** A task occupies a single working day from the cascade's perspective. |
| `dependsOn` | `string[]?` | no | Zero-or-more upstream task ids. Each implies an FS+1-working-day constraint (§4.2). **No SS/FF/SF, no lag.** Self-references and references to unknown ids are silently dropped. |
| `milestoneId` | `string?` | no | E.g. `"m6"`. The string form of a milestone's numeric id with `m` prefix. Used by cross-entity cascade (§4.3, §4.4). |

### 1.3 Calendar (per-call, sourced from `useSettings`)

| Field | Type | Default | Semantics |
|---|---|---|---|
| `workingDays` | `number[]` | `[1, 2, 3, 4, 5]` (Mon–Fri) | JavaScript `getUTCDay()` codes: `0` = Sunday, `6` = Saturday. The PM can flip working days per-project in M8 Settings. |
| `holidays` | `string[]` (ISO) | `[]` | Days excluded from working-day arithmetic even if they fall on a working weekday. Inclusive in both directions (forward and backward). |

---

## 2. Constraint Model

### 2.1 What we support

- **Milestones:** finish-to-start with optional lag, expressed as `successor.plannedStart >= predecessor.plannedEnd + (1 + lag) working days`. The `+1` is the gap between predecessor's last working day and successor's first working day (typical PM convention).
- **Tasks:** finish-to-start, no lag, expressed as `task.dueDate >= max(deps.dueDate) + 1 working day`.
- **Cross-entity (M20.3):** a task's `dueDate` should be `<= linked milestone.plannedEnd`. Violation in either direction surfaces as conflict (rose) or slack (blue, info). The link is a logical association, not a strict precedence — moving a milestone earlier does NOT auto-shift its linked tasks; it surfaces a conflict the PM must resolve.

### 2.2 What we explicitly do NOT support

| Out-of-scope | Reason |
|---|---|
| Start-to-Start, Finish-to-Finish, Start-to-Finish constraints | UI doesn't model them; adding requires a constraint-type field per dependency, type-aware cascade, and UI changes. Scope kill: PMBOK acknowledges FS dominates >90% of real schedules. |
| Lag on task dependencies | Same UI cost; not requested. |
| Multi-predecessor milestones | Single `predecessor` field by design; gives a clean tree. PMs model fan-in via the task layer below. |
| Soft constraints / "as-late-as-possible" / "must-start-on" | We have `lockDate` as a single hard constraint type. Soft constraints belong in a future scheduling-modes module. |
| Resource leveling | Out of cascade's scope; lives in M11 Resources surface or future workload-balancing module. |
| Monte-Carlo / probabilistic durations | Deterministic engine only. Future module if it ever lands. |
| Critical Chain Method (CCM) with feeding/project buffers | We adopt CCM's *philosophy* (buffer protection, slack visualisation) but not its formal buffer-sizing algorithm. |
| Multi-project critical chain / resource pools | Single-project scope. Multi-project is a separate architecture (Path C). |
| Earned Value Management (EVM) | Future module M27. Not a cascade concern. |
| Deadline buffers / target dates | We have `goLiveDate` as a backward-schedule anchor only. No per-milestone deadline tracking yet. |

---

## 3. Working-day Arithmetic

### 3.1 `addWorkingDays(iso, days, workingDays, holidays)`

- Walks one calendar day at a time in the requested direction (positive or negative).
- Skips any day whose `dayOfWeek` is not in `workingDays` OR whose ISO string is in `holidays`.
- Counts only landed-on working days against the `days` target. So `addWorkingDays("2026-05-15", 1, [1..5], [])` returns `"2026-05-18"` (Friday + 1 = Monday).
- Returns `null` if the ISO is invalid or the 10 000-iteration guard trips.
- `days === 0` returns the input unchanged.

### 3.2 `daysBetween(a, b)`

- Returns **calendar** days (UTC ms diff / 86 400 000, rounded).
- **Not working days.** Used for display ("shifted +14 days") but mixes calendar and working-day semantics — see Punch List PL-3.

### 3.3 `compare(a, b)`

- Returns `-1 | 0 | 1`. ISO-safe; UTC-anchored to avoid DST drift.

---

## 4. Cascade Modes

### 4.1 Milestone → Milestone (`cascade`, `previewCascade`)

**Inputs:** milestones, optional edit `{ id, field, value }`, calendar.

**Edit-trigger whitelist:** cascade only fires on edits to `plannedStart`, `plannedEnd`, `duration`, `predecessor`, or `lag`. Status / owner / name changes do NOT cascade.

**Algorithm:**
1. Topological sort (Kahn's). Cycle → return `{ affected: [], error: "Circular dependency" }`. No partial cascade is committed.
2. Clone milestones; apply the user's edit on the edited milestone.
3. Apply selective-cascade layer: for every other milestone:
   - If `id` is in `overrides`, set `plannedEnd = overrides[id]`, recompute `plannedStart = plannedEnd - (duration - 1)` working days, set `lockDate = true`.
   - Else if `id` is in `excludeIds`, set `lockDate = true`.
4. Walk milestones in topo order. For each non-locked milestone with a predecessor:
   - `newStart = pred.plannedEnd + (1 + lag) working days`.
   - **Apply the shift only if `newStart > currentPlannedStart` OR `status === "Not Started"`.** (§4.1 quirk: in-progress milestones do NOT pull earlier even if the topology allows. See PL-1.)
   - On update: `plannedEnd = plannedStart + (duration - 1) working days`.
5. Diff before / after; emit `affected[]`.

**Important non-obvious behavior:**
- Cascade is **forward-only-or-not-started**. An in-progress milestone's start cannot move earlier under any circumstance, even if the predecessor finished sooner than planned. This protects committed work but breaks pure topological correctness.
- **Override implies lock.** Once a PM overrides a milestone's date in the drawer, that milestone is treated as `lockDate: true` for the rest of the cascade — it does not propagate to its own successors via the override (it propagates via its new `plannedEnd` though, because the successor reads `pred.plannedEnd` directly).

### 4.2 Task → Task (`previewTaskCascade`)

**Algorithm:**
1. Topo sort tasks via `dependsOn[]`. Cycle → return error with the cycle members.
2. Clone tasks; apply user's edit to the edited task's `dueDate`.
3. Walk tasks in topo order:
   - Skip the edited task (already updated).
   - If in `excludeIds` → skip (task keeps its current `dueDate`, downstream reads that date as upstream).
   - If in `overrides` → set `dueDate = overrides[id]`, continue (downstream reads this).
   - Else compute `latest = max(deps' dueDates after they've been processed earlier in topo order)`. `earliest = latest + 1 working day`. If `dueDate < earliest`, update.
4. Diff before / after; emit `affected[]` with `daysShifted` (calendar days — see PL-3).

**Crucial property:** because the walk is in topo order, each task sees its upstreams' **already-cascaded** dates. There is no second pass and no fixpoint iteration. This is correct given the DAG, and rejects cycles up-front.

### 4.3 Milestone → Task (`previewMilestoneToTaskImpact`)

**Scope:** runs over tasks whose `milestoneId` matches the moving milestone's string id.

**Returns `{ conflicts, slack }`:**
- **Conflict:** `task.dueDate > newMilestonePlannedDate`. Rose tone. Task now ends after its supporting milestone — the PM must shift the task back or move the milestone forward.
- **Slack:** `task.dueDate < newMilestonePlannedDate`. Blue tone (info). Working-day slack is computed by stepping `addWorkingDays(taskDue, 1, ...)` until it reaches `newMilestonePlannedDate`. No shift, no action — informational nudge only (§5.3 tone rule).

**Soft link, not strict:** a milestone moving earlier does NOT auto-cascade its tasks back. The task-milestone relationship is logical (this task supports this milestone) not strictly precedent. PMs handle the conflict in the drawer.

### 4.4 Task → Milestone (`previewTaskToMilestonePush`) — M20.3

**Trigger:** after `previewTaskCascade` produces `r.tasks` (cascaded task state), check each task's `milestoneId`. If the task's cascaded `dueDate > milestone.plannedEnd`, propose a push.

**Grouping:** group proposals by `milestoneId`. The **binding constraint** is the latest cascaded task driving the push — `proposedNewDate = max(linkedTask.cascadedDueDate)`.

**What it does NOT do today:**
- Does **not** then run `previewCascade` on the proposed milestone shifts to see if those milestones push further milestones. **One-hop only.** See PL-2.
- Does **not** add a working-day buffer between task end and milestone end. The milestone is pushed to exactly the task's dueDate. This is arguably incorrect — milestones typically represent gate reviews / approvals that happen *after* their final task, not on it. See PL-4.
- `daysShifted` uses `daysBetween` (calendar days) — PL-3.

---

## 5. Selective Cascade Layer (M20)

### 5.1 Apply order on every recompute

1. The user edits a date (originator).
2. The drawer collects the user's `excludeIds: Set<string>` and `overrides: Record<string, string>`.
3. Engine runs:
   - Originator edit is applied first (un-conditional).
   - Then the override layer: overridden nodes get their manual values + lock.
   - Then the exclude layer: excluded nodes get `lockDate = true`.
   - Then the topological cascade.
4. The diff between this run and the *baseline* (no exclusions / no overrides, just the originator edit applied) is what the drawer shows.

### 5.2 Exclude semantics

> "I have already arranged for this work to stay on its original date — don't push it."

- The excluded node keeps its **current** date.
- Downstream nodes that depend on the excluded node read its current date as upstream (so they may still shift, just less than they would have).
- An excluded milestone behaves identically to `lockDate: true`.

### 5.3 Override semantics

> "The engine wants to push this to date X, but I've negotiated date Y."

- The overridden node takes the manual date.
- For milestones: `plannedEnd = manualDate`, `plannedStart = manualDate - (duration - 1) working days`. Lock is set so the cascade doesn't move it.
- For tasks: `dueDate = manualDate`. No duration to recompute.
- Downstream nodes read the override as their new upstream — propagation continues from there.
- **Override defeats exclude on the same node** (the override is more specific).

---

## 6. Cycle Handling

### 6.1 Detection

- Both milestone and task cascade run Kahn's topological sort first.
- If `sorted.length < nodes.length`, there's a cycle.
- Task cascade also surfaces `cyclePath: string[]` — the set of task ids still in the residual graph (in-degree > 0 after Kahn's), so the UI can name the offending tasks.

### 6.2 Behavior on cycle

- Milestone cascade: returns `{ milestones: original.slice(), error: "Circular dependency" }`. No partial result, no propagation.
- Task cascade: returns `{ tasks: original.slice(), affected: [], error: "Dependency cycle detected — Tasks involved: T1 → T2 → T3" }`. UI shows this as a dedicated warnings row in the drawer.
- **The original edit is also not applied** when there's a cycle. The PM must break the cycle first.

---

## 7. Pre-existing Inconsistencies

### 7.1 Principle

> The engine reports inconsistencies; it never silently fixes them.

If the data already has `task.dueDate < dep.dueDate + 1` before the user's edit (legacy data, dogfood drift, imported file), `findConstraintViolations` flags it. The cascade does NOT auto-correct it.

### 7.2 Why this matters

- Auto-correction would shift dates on save without the PM realising — destructive and surprise-inducing.
- Auto-correction would pollute the M20.2 audit log with "phantom" changes that no human authorised.
- The M20.1 baseline/diff pattern (drawer captures baseline at open, diffs after recompute) lets us distinguish "violations caused by THIS edit" from "violations that already existed". The drawer surfaces both in separate sections.

### 7.3 Where pre-existing inconsistencies show

- The M20.2 Project Health card on the dashboard surfaces all pre-existing violations across the project, scored.
- The cascade drawer surfaces pre-existing violations as an informational secondary section, never as new-caused-by-this-edit.

---

## 8. Critical Path (`computeCriticalPath`)

- Forward pass: assumes `cascade()` has already run, so `plannedStart` / `plannedEnd` are valid ES/EF.
- Backward pass: for each milestone in reverse topo order:
  - Terminal milestones (no successors): `LF = max(plannedEnd across all milestones)` (project end).
  - Others: `LF = min over successors of (successor.LS - successor.lag - 1 working day)`.
  - `LS = LF - (duration - 1) working days`.
- Slack: working days between `plannedStart` (ES) and `LS`. If `LS <= plannedStart`, slack is 0.
- Critical path: all milestones with `slack === 0`.

**Caveat:** if the milestone graph has a cycle, `computeCriticalPath` returns empty (no meaningful CP exists). Today the UI silently shows no CP badges instead of an error. See PL-5.

---

## 9. Prior-Art Cross-Check

### 9.1 PMBOK Guide §6.5 (Schedule Network Analysis)

PMBOK 7th edition prescribes Critical Path Method (CPM) for deterministic schedules: forward pass for ES/EF, backward pass for LS/LF, slack = LS − ES, critical path = slack ≤ 0. Our `computeCriticalPath` implements this exactly with `slack === 0` (we don't model negative slack because we don't have a project deadline constraint separate from the latest planned end).

**Conformance:** ✅ on forward/backward pass, ✅ on slack definition, ⚠️ on constraint types (we only support FS+1WD, PMBOK acknowledges all four FS/SS/FF/SF but FS dominates real schedules). PMBOK also expects negative-slack reporting against a deadline — we don't have a deadline mechanism beyond `goLiveDate` (which `scheduleBackward()` uses but `computeCriticalPath` does not).

### 9.2 MS Project — auto-scheduled vs manually-scheduled

MS Project distinguishes "Auto Scheduled" tasks (engine moves them per constraints) from "Manually Scheduled" tasks (user-set dates win; constraints are advisory). Their constraint hierarchy: hard constraints (Must-Start-On, Must-Finish-On) > soft constraints (As-Soon-As-Possible, As-Late-As-Possible) > dependency relationships.

**Our equivalent:** `lockDate: true` ≈ Manually Scheduled. Everything else ≈ Auto Scheduled with the ASAP soft preference. We have no "Must Finish On" or "As Late As Possible" mode. MS Project would push an in-progress task earlier if the predecessor finished earlier — we explicitly do NOT (§4.1 quirk).

### 9.3 Primavera P6 — constraint hierarchy

P6 supports 8 constraint types (Start-On-or-After, Finish-On-or-Before, Mandatory Start/Finish, etc.). It also distinguishes "Early" dates (from forward pass) from "Late" dates (from backward pass). Its "Retained Logic" vs "Progress Override" setting governs how completed work interacts with the forward pass.

**Our equivalent:** We don't have user-facing constraint types beyond `lockDate`. Our "Not Started → forward-pull allowed; In Progress → forward-shift only" rule (§4.1) is loosely analogous to Primavera's Retained Logic — completed/in-progress work is not retroactively rescheduled earlier.

### 9.4 Theory of Constraints / Critical Chain Method (Goldratt)

CCM differs from CPM by:
1. Sizing tasks at 50% confidence (median) instead of 90%+ contingency-padded estimates.
2. Pooling task contingency into shared **feeding buffers** (before merge points into the critical chain) and a **project buffer** (at the end).
3. Levelling for the single most-constrained resource (the "drum").
4. Monitoring buffer consumption as the schedule's health signal, not individual task slip.

**What we adopt:** CCM's philosophy of buffer visualisation (M20 selective cascade lets the PM see and reallocate buffer); CCM's "absorb or shift" framing in the drawer.

**What we don't:** explicit feeding/project buffers, 50%-confidence estimating, resource-driven levelling. The cascade engine is pure CPM mechanics; CCM's deeper concepts are out of scope.

### 9.5 Asana / Monday / Smartsheet — what mid-market tools actually do

Most mid-market PM tools do *not* run a constraint-aware cascade engine. They visualise dependencies (the arrow drawing) and surface a warning if a task is scheduled after its dependent, but they don't auto-propagate shifts. Smartsheet has "auto-schedule" but it's opt-in and basic. Asana has "rules" that can shift downstream tasks but it's user-configured per-project, not engine-level.

**Our position:** we run a real CPM engine, in the browser, in milliseconds, with selective cascade (override/exclude/slack) the mid-market tools don't have. Enterprise tools (MS Project, Primavera, Planisware) have all this and more — but at heavy weight, on-prem, and at enterprise licensing. The wedge is "CPM-correct + browser-light + PM-controlled cascade".

---

## 10. Punch List — Gaps & Surprises

Each item: severity (P0 wrong / P1 surprising / P2 cosmetic), one-line fix sketch. These become M20.5 scope.

| ID | Sev | Issue | Fix sketch / Resolution |
|---|---|---|---|
| **PL-1** | P1 | In-progress milestone won't pull earlier (§4.1). If predecessor finishes ahead of plan, in-progress milestone stays at its old start instead of advancing. | Documented as intentional protection. Not changing — in-progress work shouldn't auto-rewind. |
| **PL-2** | **P0 ✅ M20.5** | Task→milestone push is **one-hop only**. M20.3's claim of "fully transitive" is currently false. | **Resolved:** `previewTaskToMilestonePush` now runs `previewCascade` on each proposed shift; transitive milestones marked `transitive: true` with `drivenByTaskId` ancestry preserved. |
| **PL-3** | **P1 ✅ M20.5** | `daysShifted` everywhere uses calendar days; constraints use working days. PM sees inconsistent numbers. | **Resolved:** new `workingDaysBetween` helper in `dates.ts`. All `daysShifted` / `slackDays` / `daysBehind` switched to working days. Drawer labels show " WD" suffix to make the unit explicit. |
| **PL-4** | **P1 ✅ M20.5** | `previewTaskToMilestonePush` proposes milestone date = task dueDate. Should be after, for the gate-review pattern. | **Resolved:** new `gateBufferWorkingDays` opt (default `1`). Milestone lands `gateBuffer` working days AFTER the binding task. Configurable per-project later. |
| **PL-5** | P2 | If milestone graph has a cycle, `computeCriticalPath` silently returns empty (no CP badges anywhere). UX swallows the underlying problem. | Return `{ criticalIds, slackById, error: "Cycle prevents CP" }`; surface in dashboard or Gantt header. |
| **PL-6** | P1 | `scheduleBackward()` from go-live can schedule milestones into the past with no warning. If go-live is in 2 weeks and there are 8 weeks of dependent work, milestones land before `today` silently. | After backward schedule, if any milestone's `plannedStart < today`, return a warning surface ("schedule infeasible: m3 lands 2025-12-04, 5 months ago"). |
| **PL-7** | P2 | Override defeats exclude (§5.3), but the drawer UI lets you check both checkbox AND edit the date. Intent is clear from the code but not enforced in UI. | When user edits a date, auto-uncheck-exclude (visually clear). Already partially handled in `toggleExclude` (drops override on exclude); needs symmetric behavior. |
| **PL-8** | P2 | `findConstraintViolations` silently drops references to unknown task ids in `dependsOn`. Could mask data quality issues (orphan dependencies after a delete). | Add to validator (M20.2 ProjectValidator) as a new rule: "task has dependsOn references to missing tasks". Not a cascade engine concern. |
| **PL-9** | P1 | No detection of cycle introduced **by** the user's edit. E.g. edit task t3 to depend on t5 where t5 already depends on t3 — the topo sort fails but the user only sees "Dependency cycle detected" with no hint that THEIR change caused it. | At drawer open, sort baseline. On recompute, if topo now fails but baseline didn't, surface "Your edit introduced a cycle" instead of generic message. |
| **PL-10** | P2 | Holiday list is per-call (passed every invocation from settings). No validation that holidays are valid ISO dates — bad data silently no-ops in `addWorkingDays`. | Validate at settings save (M8) — not a cascade engine concern but worth flagging here. |
| **PL-11** | **P0 ✅ M20.5** | **Cascade silently "auto-fixes" pre-existing violations downstream of any edit, even a no-op edit.** Phantom save (re-saving the same date) silently re-dates downstream tasks with pre-existing violations. | **Resolved:** `previewTaskCascade` takes a `respectPreExisting` opt (default `true`). When the edit is a no-op (`newDueDate === currentDueDate`), the cascade short-circuits with `affected: []`. Pre-existing violations remain visible via `findConstraintViolations` and the M20.2 Project Health card — engine reports, never silently fixes. Pass `respectPreExisting: false` to opt out (e.g. data-cleanup pass). |
| **PL-12** | **P0 ✅ M20.7** | **Pre-existing cycle in seed/persisted data blocks every individual edit.** The cascade engine correctly detected the cycle and returned an error; but the tasks-grid `onApply` then refused to commit even the originator (the user's explicit change), silently dropping it. The drawer's recompute also short-circuited on cycle, returning only a warnings row — so the polished mini-timeline / grouping / ancestry from M20.6 never rendered, making the drawer look broken to the PM. | **Resolved (caller-side):** tasks-grid `onApply` now: (a) commits the originator edit regardless of cycle, (b) skips cascade propagation (engine couldn't safely walk the DAG), (c) emits `toast.warning("Cascade skipped — cycle in dependency data")` with audit `cascade-skipped-cycle`. Drawer recompute on engine error now ALSO surfaces the cycle members on the timeline (with their unchanged dates + `ancestry: "in dependency cycle"`) so the visual polish is preserved. Drawer's Apply button label becomes "Apply edit (cascade skipped)" to be honest about what's happening. Engine itself unchanged — its cycle-detection contract was correct; the bug was in caller semantics. |

### How the punch list flows into M20.5

After this session lands, M20.5 picks the P0 + the highest-impact P1s (PL-2 + PL-3 are the strongest candidates) and fixes them with new tests. P2s go to §7 Backlog of the operating doc.

---

## 11. Test Matrix Index

Each row in §10 has a corresponding test that demonstrates the behavior (or the gap, if currently broken). The matrix file `v2/lib/domain/scheduling.algorithm.test.ts` is organised by:

1. **Topology** — linear / fan-out / fan-in / diamond / cycle / self-loop / disconnected
2. **Operations** — forward shift / backward shift / lock-mid-chain / override-mid-chain / exclude-mid-chain / combined
3. **Calendar** — Fri→Mon boundary / holiday mid-chain / lag interaction
4. **Cross-entity** — 3-hop (PL-2 repro) / binding-constraint task / slack semantics / conflict semantics
5. **Hygiene** — pre-existing violation isolation / empty cascade / single-node cascade
6. **Punch list reproductions** — one test per PL-* item that currently has incorrect behaviour, marked with `it.skip` or `expect-to-fail` so the test file documents the gap without failing CI.

The convention is: **green tests = current behaviour matches the spec**. **Skipped tests = punch list items**. **A failing test in this file is always a regression** — never a "discovered" gap (those become new skipped tests + a new PL entry).
