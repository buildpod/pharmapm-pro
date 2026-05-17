---
name: save-flow-parity
description: Enforces behavioural parity between inline-edit save paths and form-drawer save paths within the same entity surface. Triggers when editing *-grid.tsx save handlers (handleStatusToggle / handleProgressChange / handlePlannedDateChange / handleDrawerSave etc.) or *-form.tsx save flows. Catches the M22.1 #1 class of bug — inline date click triggers cascade preview but form-drawer save bypasses it, producing inconsistent behaviour for the same logical operation on the same field.
---

# Save-Flow Parity

## When to apply

Apply this skill when you are touching ANY save path within an entity grid or its form drawer. Specifically:

- `*-grid.tsx` files — inline edit handlers (`handlePlannedDateChange`, `handleStatusToggle`, `handleProgressChange`, `handleDrawerSave`, `handleDrawerDelete`)
- `*-form.tsx` files — `handleSave` and any conditional save-path branches
- Drag-and-drop reorder handlers
- Bulk-edit / multi-select save flows
- Cascade-apply / impact-drawer `onApply` paths

## The principle

> Same field × same logical operation × same data state ⇒ same behaviour, regardless of which UI path the user took.

If clicking a date in the grid runs cascade preview, then editing that same date in the form drawer must also run cascade preview. If saving a task with a new dependency triggers cycle-prevention from the form picker, the same protection must apply when the dependency is added via any other path (CSV import, copy-paste, etc.).

## Real failures this skill prevents

### M22.1 #1 — milestone form-drawer cascade bypass

- Inline date click on the planned-date cell → `handlePlannedDateChange` → cascade preview drawer
- Form-drawer save with the same field changed → `handleDrawerSave` → `updateMilestone()` direct, no cascade
- Result: user could change planned dates without seeing downstream impact, depending only on which UI surface they clicked
- Fix: form-drawer save detects the planned-date change, hands off to `handlePlannedDateChange` (the inline flow)

### Related risk (preventable)

- Task form drawer change on `dueDate` going LATER → triggers cascade. Going EARLIER → silent. UX inconsistency: same field, two behaviours by direction. Not currently a bug, but worth challenging.

## Grid / form pair inventory

For AivelloStudio RIM as of M22.1, the entity surfaces with both inline and form save paths:

| Entity | Grid file | Form file | Inline-edit handlers | Form save |
|---|---|---|---|---|
| Milestone | `milestones-grid.tsx` | `milestone-form.tsx` | `handlePlannedDateChange` (cascade), `handleForecastDateChange` (variance toast), `handleStatusChange`, `handleLockToggle` | `handleDrawerSave` |
| Task | `tasks-grid.tsx` | `task-form.tsx` | `handleStatusToggle`, `handleProgressChange` | `handleDrawerSave` (cascade if `dueMovedLater`) |
| Risk | `risks-grid.tsx` | `risk-form.tsx` | (status / probability / impact toggles) | `handleSave` |
| Document | `documents-grid.tsx` | `document-form.tsx` | (status cycle) | `handleSave` |
| Cost line | `costs-grid.tsx` | `cost-form.tsx` | (inline edits) | `handleSave` |
| Charter (M22) | `charter-view.tsx` (no grid; single read view) | `charter-form.tsx` | n/a | `handleSave` |

When you change one save handler in this matrix, **check the parallel column in the same row**.

## Verification checklist

Before shipping any save-path change, run through:

1. [ ] What field is this handler saving / mutating?
2. [ ] Does that field have an **inline-edit path** in the grid? Find it.
3. [ ] Does the inline path trigger any side-effects (cascade, validation, toast, audit log, navigation)?
4. [ ] Does the form-drawer save trigger the same side-effects when the same field changes?
5. [ ] If asymmetry exists: is it intentional and documented (comment in code OR mention in `§5.2 Tech-debt`)? If not, the inline path is canonical — the form must match.
6. [ ] Are there OTHER save paths (drag, multi-select, import) that touch the same field? Same parity check.

## Common patterns

### Pattern A — factor the side-effect into a shared helper

When inline + form both need cascade preview on planned-date change, extract:

```ts
function applyPlannedDateChange(id: string, newDate: string) { ... }
```

Both inline and form call this helper. Asymmetry impossible by construction.

### Pattern B — form delegates to inline handler

If the inline handler is well-tested, the form save can detect the changed field and delegate:

```ts
function handleDrawerSave(m: Milestone) {
  if (existing.plannedDate !== m.plannedDate) {
    handlePlannedDateChange(m.id, m.plannedDate);
    return;
  }
  // …non-cascade fields save directly
}
```

This is what M22.1 #1's fix did.

### Pattern C — explicit "no cascade here, by design" comment

If a save path *intentionally* skips a side-effect, comment it:

```ts
// Forecast-date saves directly — forecast is a projection, not the baseline.
// Variance toast is the only side-effect (see M22.1).
```

The comment makes the asymmetry deliberate; future Claude won't "fix" it.

## Why this skill exists at all

This bug class evaded `ui-string-audit`, `tone-discipline`, and `error-message-pattern` because all three are concerned with surface-layer concerns (what strings look like, what colors they use, whether errors have a remediation hint). They don't reason about whether two parallel code paths *do the same thing*. This skill operates at the code-structure layer — adjacent to the built-in `simplify` and `review` skills but more targeted.
