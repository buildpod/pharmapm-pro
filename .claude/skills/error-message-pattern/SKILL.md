---
name: error-message-pattern
description: Enforces a consistent three-part structure for every user-facing error / warning / info message in this project. Triggers when writing toast.X(...) calls, setError(...) calls, or any error / warning / status string passed to a UI component. Prevents the "stack-trace as user message" anti-pattern (e.g. "Dependency cycle detected — cannot cascade. Tasks involved: T1 → T3 → ...") and ensures every error has a clear next step for the user.
---

# Error Message Pattern

## When to apply

Apply this skill whenever you:
- Write a `toast.error(...)` / `toast.warning(...)` / `toast.info(...)` / `toast.success(...)` call
- Set an error state that renders to the UI: `setError("...")`, `<ErrorBanner message=...>`, etc.
- Build an `engine-error` row, `ViolationRow`, or any user-facing error section
- Write a `disabled` reason / tooltip explaining why something can't be done

## The three-part structure

Every error / warning message answers three questions, in this order:

| Part | Question | Required? |
|---|---|---|
| **What** | What happened? In plain language. | Always |
| **Why** | Why did it happen? One sentence, optional. | Encouraged when non-obvious |
| **Next** | What can the user do about it? | Always |

If you can't write the "Next" without effort, that's a signal the error is incomplete — either you don't yet know what the user should do, or the error shouldn't be surfaced at all.

## Format conventions

Sonner's toast API splits content into `title` (first arg) and `description` (in options object). Use this split deliberately:

```ts
toast.warning("What happened — title", {
  description: "Why + what to do next."
});
```

- **Title** = the "What" (≤60 chars, stands alone meaningfully).
- **Description** = "Why" + "Next" combined into one sentence (≤120 chars).
- If you need more space, you're showing too much in a toast — promote to a banner / dialog / drawer section instead.

For non-toast errors (banner / inline / dialog), the same structure applies; spacing and typography differ.

## Anti-patterns this skill catches

### Anti-pattern 1: Stack-trace as user message

**Bad (current M20.7 output):**
> Title: "Cannot apply cascade"
> Description: "Dependency cycle detected — cannot cascade. Tasks involved: T1 → T3 → T4 → T5 → T6 → T7 → T8 → T13 → T14 → T15"

Violations: technical jargon, no "Next" action, raw ID list belongs in collapsible detail not a toast.

**Good:**
> Title: "Downstream preview unavailable"
> Description: "Some tasks reference each other in a loop. Open the Tasks page to fix it."

### Anti-pattern 2: Only "What", no "Next"

**Bad:**
> Title: "Save failed"
> Description: "Validation error."

User is left with no path forward.

**Good:**
> Title: "Couldn't save changes"
> Description: "Due date must be between 2026-01-01 and 2027-12-31. Pick a date in range and try again."

### Anti-pattern 3: Wrong tone for outcome

**Bad:**
> `toast.error("Task updated", { description: "Some downstream tasks have cycles" });`

The user's edit saved successfully. Using `toast.error` is dishonest about the outcome.

**Good:**
> `toast.warning("Task saved · downstream preview skipped", { description: "Fix dependency cycle in Tasks page to re-enable previews." });`

### Anti-pattern 4: "Something went wrong"

**Bad:**
> Title: "Something went wrong"
> Description: "Please try again"

This is the worst-case fallback — never first choice. If you can't describe what happened, fix the error-handling code so it knows.

**Acceptable (only as final catch-all):**
> Title: "Couldn't save changes"
> Description: "We're not sure what went wrong. Try again, or copy your edits and refresh the page."

## Verification checklist

Before shipping any error / warning / info message:

1. [ ] Does the title clearly state **what happened** in plain language?
2. [ ] If non-obvious, does the description state **why**?
3. [ ] Does the message tell the user **what to do next**?
4. [ ] Is the chosen tone (`error` / `warning` / `info` / `success`) consistent with the actual outcome? (See `tone-discipline` skill.)
5. [ ] Are user-facing strings free of developer jargon? (See `ui-string-audit` skill.)
6. [ ] Is the message length within budget (60 / 120 chars)?
7. [ ] Is technical detail (IDs, error codes, stack traces) collapsed behind an optional "Show details" — not inline in the toast?

## Wording library — common errors in this project

Reuse these wordings for consistency across the product:

| Situation | Title | Description |
|---|---|---|
| Cascade preview blocked by data cycle | "Downstream preview unavailable" | "Some tasks reference each other in a loop. Your change saved — fix the cycle to enable previews." |
| Cycle prevented at form-save | "Pick a different upstream task" | "{ID} already depends on this one. Picking it back would create a loop." |
| Date out of project range | "Date out of range" | "Pick a date between {min} and {max}." |
| Validation rule violated | "Couldn't save changes" | "{specific rule explanation}. Update the field and try again." |
| Cascade succeeded, slack created | "Schedule has new buffer" | "{N} tasks now have +{X} working days of slack. Reallocate if useful." |
| Cascade succeeded, tasks shifted | "{N} task{s} updated" | "{originator name} change applied, downstream shifts saved." |
| Save succeeded cleanly | "{Entity} updated" | "{name}" (no extra description needed) |
| Loading slow | (avoid surfacing unless >2s) | (avoid surfacing unless actionable) |

This table grows as new situations come up. Add to it when authoring new error paths.

## Special case — engine-error states

When the cascade engine can't compute a result (cycle, missing data, etc.), the user's intent is usually still valid. Two-step pattern:

1. The originator edit saves through the store as a normal action.
2. A `toast.warning` (not error) communicates the partial-success state.
3. The drawer / panel surfaces the cycle as informational, not blocking.

Never let an engine-can't-cascade scenario block the user's primary action.
