---
name: pre-existing-state-distinction
description: Forces baseline-vs-hypothetical thinking on every guard, validator, detector, or warning that examines current data state. Triggers when writing any code that examines the current state of data and decides to block, warn, or auto-correct. Catches the PL-11 (engine silently auto-fixed pre-existing constraint violations) and M22.1 #2 (form cycle guard blocked saves when cycle pre-existed in data) class of bug — code treating pre-existing-state-of-data as caused by the user's current action.
---

# Pre-Existing State Distinction

## When to apply

Apply this skill whenever you are writing code that:

- **Blocks** a save / action based on a condition examined from current data (form-cycle guard, validation rules)
- **Auto-corrects** data based on a detected condition (cascade engine resolving violations)
- **Warns** the user about something detected in current data
- **Runs a check** that compares the current state to a desired state (constraint violations, RAG calculations, dependency status)

In short: any time your code is the judge of "is this state right or wrong" — apply this skill.

## The principle

> Before blaming the user for state, ask: "would this same condition have been true BEFORE the user's edit?"

If yes, the state is pre-existing. The user did not cause it. Decide deliberately:

- **Block / refuse the user's action?** No — the user can't fix what they didn't break with a single edit.
- **Auto-correct silently?** No — that pollutes the data, hides the issue, and the user is blamed for shifts they didn't cause.
- **Report it as informational, separate from this edit?** **Yes** — surface via Project Health card / validator report / separate audit log entry.

The user's edit is responsible only for **new state** introduced by the edit.

## Real failures this skill prevents

### PL-11 — engine silent auto-fix of pre-existing violations

`previewTaskCascade` ran the topological cascade unconditionally. If task t2 was already ending before its upstream t1 (a pre-existing FS-rule violation), ANY edit on t1 — including a no-op save — would silently shift t2 to fix the violation. The user got blamed (via `affected[]`) for shifts they didn't cause.

Fix: `respectPreExisting: boolean` opt (default true). When the edit is a no-op (`newDueDate === currentDueDate`), short-circuit with no shifts. Real edits cascade fully; phantom saves leave pre-existing violations visible but unrewritten.

### M22.1 #2 — form-layer cycle guard treated pre-existing cycles as user-caused

`task-form.tsx` checked `topoSortTasks(hypothetical).hasCycle` after applying the user's proposed `dependsOn` change. If true → block save. But the cycle existed in stale data from previous sessions; the user's current edit didn't introduce it. User couldn't save *any* task — including edits with no dependency change — because the graph had a pre-existing cycle.

Fix: compute `topoSortTasks(baseline)` too. Block only when `hypothetical.hasCycle && !baseline.hasCycle` — i.e., this edit introduced a NEW cycle.

## The baseline-vs-hypothetical pattern

For any condition `C(state)` that decides whether to block / warn / correct:

```ts
// 1. What's the condition's value on the input state, BEFORE the user's edit?
const baseline = C(currentState);

// 2. What's the condition's value on the hypothetical state, AFTER the edit?
const hypothetical = C(applyEdit(currentState, userEdit));

// 3. Act on the DELTA between baseline and hypothetical, not on hypothetical alone.
if (hypothetical && !baseline) {
  // User's edit caused C to become true. Block / warn / correct.
} else if (hypothetical && baseline) {
  // Pre-existing. Don't blame the user. Surface via separate channel
  // (Project Health card / validator report / informational toast).
} else if (!hypothetical && baseline) {
  // User's edit resolved a pre-existing condition. Optional positive feedback.
}
```

The four-quadrant outcome makes the right action obvious for each case.

## Where this comes up in this project

| Component | What it checks | Already applies pattern? |
|---|---|---|
| `previewTaskCascade` | FS-rule violations after edit | ✅ PL-11 — `respectPreExisting` opt distinguishes |
| `task-form.tsx` cycle guard | New dependsOn would create cycle | ✅ M22.1 #2 — baseline vs hypothetical |
| `findConstraintViolations` | All FS-rule violations | ✅ M20.1 — separates "new" from "pre-existing" via `diffViolations` |
| `project-validator.ts` | Cross-entity rules (milestone-after-go-live, etc.) | ⚠️ Reports current state; doesn't distinguish caller-introduced from pre-existing. Acceptable here because this validator runs continuously, not in response to an edit |
| Future: cost-overrun check | Actual > budget | Should apply: distinguish "this edit caused the overrun" from "actual was already > budget" |
| Future: doc-without-reviewers | Document in review with empty reviewers list | Should apply: distinguish "this edit cleared reviewers" from "doc was already in this state" |

## Verification checklist

For any guard / validator / detector / corrector you are writing:

1. [ ] What condition `C` is this code evaluating?
2. [ ] What state do I have access to BEFORE applying the user's edit? (Usually the function's input.)
3. [ ] What state would I have AFTER applying the edit? (Apply edit to input.)
4. [ ] Compute `C(baseline)` and `C(hypothetical)` separately.
5. [ ] Decide the four-quadrant outcome explicitly: new-only blocks / warns; pre-existing routes to separate surface; resolved triggers positive feedback.
6. [ ] Comment in the code which quadrant each branch handles.

## When this skill does NOT apply

- **Continuous validators** running independently of edits (Project Health card, RAG calculation per render) — these report current state; no edit context exists. They're allowed to flag pre-existing conditions because they're not blaming an edit.
- **Hard system invariants** that should never be true (e.g. duplicate IDs, malformed dates from a parser). These can always block — there's no scenario where stale data should make the invariant violation acceptable.
- **First-write-of-a-field** — if the field was empty before, there's no "pre-existing" to compare to.

## Why this skill exists at all

This is the single most expensive bug-class we've hit on this project. PL-11 was a P0; M22.1 #2 made the entire task form unusable for the active project's data. Both followed the same anti-pattern: code that looks at current state and decides "user is wrong" without checking whether the user is the cause. This skill forces the check at write-time.
