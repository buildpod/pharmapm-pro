---
name: cross-entity-parity
description: When changing behaviour on one entity surface (tasks-grid / milestones-grid / risks-grid / etc.), prompts the question "do the sibling entity surfaces need the parallel behaviour?". Triggers when editing any *-grid.tsx, *-form.tsx, or domain logic that operates on a specific entity type. Catches the M22.1 #1 class of bug where tasks had cascade-on-save but milestones didn't — the asymmetry shipped silently because nothing forced cross-surface comparison at write-time.
---

# Cross-Entity Parity

## When to apply

Apply this skill whenever you are changing behaviour on a specific entity surface — adding a guard, a side-effect, a validation rule, a save flow, a UI affordance — and asking "do the other entity surfaces need the same?"

Trigger files:
- `v2/components/{milestones,tasks,risks,documents,costs,resources,charter}/`
- `v2/lib/domain/scheduling.ts` (milestone + task domain)
- `v2/lib/validation/project-validator.ts` (cross-entity rules)
- `v2/lib/stores/entity-store.ts` (when adding actions specific to one entity)

## The principle

> Asymmetry is a design decision, not an accident. Make it explicit.

When two entity types have similar shape and use, users will expect them to behave similarly. If you give tasks cascade-on-save but milestones not, the user discovers the difference accidentally — through the cheap-product feel of "why does this work over here but not over there?".

Either:
- Apply the new behaviour to every relevant sibling (parity by construction), OR
- Document why the sibling intentionally lacks it (asymmetry by design)

## Real failures this skill prevents

### M22.1 #1 — tasks had cascade-on-save, milestones didn't

Task form-drawer save included cascade preview logic when `dueDate` moved later. Milestone form-drawer save did NOT include similar cascade preview when `plannedDate` changed. The asymmetry shipped in M22 and only surfaced via Vineet's screenshot dogfood.

Both entity types have:
- A baseline schedule field (task.dueDate / milestone.plannedDate)
- Dependency relationships (task.dependsOn / milestone.predecessor)
- A cascade engine that propagates date shifts (previewTaskCascade / previewCascade)
- A grid with inline date editing AND a form drawer

Yet the form-drawer behaviour diverged. Per `save-flow-parity` skill: the inline path triggers cascade for both; only the form path was asymmetric. Cross-entity-parity would have asked at M22 time: "tasks form has cascade-on-save; does milestones form have the same?"

### Related risk (preventable)

- Task form has cycle-prevention picker. Milestone form does NOT have predecessor-cycle prevention (single-predecessor model makes it rare but not impossible). Currently documented as out-of-scope in M21-Checkpoint §4.

## Entity surface feature matrix (M22.1 snapshot)

For each entity, mark which behavioural feature exists. Asymmetry should be **deliberate**, not accidental.

| Feature | Milestone | Task | Risk | Document | Cost line | Charter |
|---|---|---|---|---|---|---|
| Inline date edit on grid | ✅ planned, ✅ forecast | ✅ due | n/a | n/a | n/a | n/a |
| Form drawer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ M22 |
| Cascade on date change | ✅ M20 (inline + M22.1 form) | ✅ M18 / M20 | n/a | n/a | n/a | n/a |
| Cross-entity cascade impact | ✅ M20.3 (→ tasks) | ✅ M20.3 (→ milestones) | n/a | n/a | n/a | n/a |
| Form-layer cycle prevention | ❌ deferred (single predecessor) | ✅ M21-Checkpoint + M22.1 #2 | n/a | n/a | n/a | n/a |
| Locked-state respect | ✅ lockDate | n/a | n/a | n/a | n/a | n/a (status=approved is the equiv) |
| Variance / RAG indicator | ✅ M16 | ⚠️ implicit via dueDate vs deps | ✅ score / band | ✅ pending count | ✅ burn % | n/a |
| Audit log on save | ✅ M20.2 | ✅ M20.2 | ✅ M20.2 | ✅ M20.2 | ✅ M20.2 | ✅ M22 |
| Validation rules | ✅ go-live constraint | ✅ FS rules, milestone-link | ✅ owner required | ✅ reviewers required | ✅ actual ≤ budget | ⚠️ form-only field validation |
| Export sheet (M19) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ deferred to M22.1+ |

**Maintain this matrix.** When adding a feature column or filling a cell, update this skill.

## Verification checklist

Before shipping any change to one entity's behaviour:

1. [ ] Which behavioural row in the matrix does this change touch?
2. [ ] For each sibling entity that has the same row marked ✅: does this change need to apply there too?
3. [ ] For each sibling entity that has the same row marked ❌ or ⚠️: is the asymmetry intentional? Documented in code / operating doc?
4. [ ] If you're adding a NEW row to the matrix: which siblings should also support it eventually? Capture as backlog (§7) or as M-X.Y candidates.
5. [ ] If user-visible asymmetry is intentional, can a tooltip / comment in the UI explain it? ("Forecast saves directly — it's a projection, not the baseline.")

## When asymmetry IS intentional

These are deliberate, documented asymmetries — not bugs:

- **Forecast date** has no cascade (forecast = projection, not commitment) — documented inline in code + §8 history
- **Milestone single-predecessor** vs **task multi-predecessor `dependsOn`** — by design; milestones model gates, tasks model granular work
- **Charter has no cascade** — Charter is an authorising document, not a schedule entity
- **Documents have multi-reviewer matrix** but **tasks have a single owner** — RACI model vs RAM model

Each was a deliberate choice. The skill catches *new* asymmetries entering by accident.

## Common patterns

### Pattern A — DRY helper across entity surfaces

If cascade-on-save logic exists on tasks-grid, extract to a helper like `lib/cascade/apply-from-form.ts` callable by any entity form. Adding milestones is then one call site, not a parallel reimplementation.

### Pattern B — entity-typed feature flag

For features that *might* apply to a sibling but you're not sure: introduce as opt-in per entity. Tasks-grid passes `enableCascadeOnSave: true`, milestones-grid passes the same when ready. Skill catches "wait, milestones-grid doesn't have this prop yet?".

### Pattern C — operating-doc out-of-scope row

When you choose NOT to give a sibling parity, log in §4 out-of-scope: "Milestone-form cycle prevention parallel to task-form (single-predecessor makes it rare; defer until reported)". Future Claude reads it and doesn't quietly add the missing parity OR mistakenly assume it's an oversight.

## Why this skill exists at all

The cheap-product feel users complain about is rarely caused by a single bad component. It's caused by 6 components that each individually look fine but behave inconsistently with each other. PMs notice "the milestones page feels different from the tasks page" without being able to articulate why. This skill is the mechanical check that prevents accidental divergence at the moment behaviour is being defined.
