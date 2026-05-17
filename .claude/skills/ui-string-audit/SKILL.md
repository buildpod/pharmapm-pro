---
name: ui-string-audit
description: Audits user-facing strings in TSX / TS files for developer jargon, broken template-literal grammar, and over-long messages. Triggers when writing or editing any string that the end user will see — toast messages, button labels, section headers, error text, captions, dialog titles, placeholder text, tooltip content. Does NOT trigger on internal identifiers, code comments, audit-log notes, or test descriptions.
---

# UI String Audit

## When to apply

Apply this skill before writing or after editing **any string that will render in the rendered DOM** — every `toast.X("...")`, every JSX text child, every `aria-label`, every `placeholder`, every `title` attribute, every `setError("...")`, every section header / button label / dialog title.

Do NOT apply to:
- Console logs / `console.error`
- Audit-log notes (`{ source: "cascade", note: "..." }`) — these are internal telemetry
- Test names / `describe` / `it` strings
- Code comments
- Internal type names, function names, file names

## The forbidden-in-user-text vocabulary

These words are fine in code / comments / types, but **must not appear in user-facing strings**. They read as developer jargon to a PM:

| Forbidden | Use instead |
|---|---|
| cascade (as noun for "downstream effects") | "downstream impact" · "knock-on changes" · "schedule shifts" |
| cascade engine | (drop entirely) · "schedule preview" |
| cascade propagation | "downstream shifts" |
| engine error | "preview unavailable" · "couldn't compute the change" |
| dependency cycle | "tasks reference each other in a loop" · "circular dependency" (acceptable in less prominent text) |
| topology / topological | (never user-facing — drop entirely) |
| dispatch / dispatcher | "save" · "apply" |
| entity / entities | use the specific noun: "task" / "milestone" / "risk" / "document" / "cost line" |
| repository | (never user-facing — drop entirely) |
| audit log | "history" · "activity" |
| validator | "checks" · "rules" |
| affected[] / affected rows | "tasks that will shift" · "changes" |
| override (as verb to engine) | "change the suggested date" · "use a different date" |
| respectPreExisting | (never user-facing — drop entirely) |
| originator | "your edit" · "this change" |

## Pattern: template-literal grammar errors

When building a string like `${prefix} ${value}` or `${verb} by ${actor}`:

1. Verify the `value` / `actor` is always a noun phrase that grammatically completes the sentence.
2. If the value can be a status label, status code, or "category descriptor" (e.g. "in dependency cycle"), drop the prefix or use a different sentence structure.

**Real example from M20.7 we got wrong:**
```ts
ancestry: "in dependency cycle"
// rendered as: "← driven by in dependency cycle"
```
Result reads as broken English. Fix: drop the `← driven by` prefix when the value isn't a noun phrase, or pass a different field for status-style labels.

**Checklist for every template literal in user text:**
- [ ] Read it aloud with every possible value substituted. Does it always parse?
- [ ] If any substitution produces broken grammar, restructure.

## Pattern: message length + structure

For toast / dialog / error messages:

- **Title**: ≤60 characters. Stand-alone meaningful even without the description.
- **Description** (if any): one sentence, ≤120 characters. Should tell the user what happened AND what to do next.
- **Single-line strings in tight UI** (badges, chips, table cells): ≤25 characters. If longer, redesign or truncate with tooltip.

If a message can't fit, it's usually mixing two concerns — split them.

## Pattern: every error needs a next step

Every error / warning surface must answer three questions, in order:

1. **What happened?** ("We couldn't preview the downstream changes.")
2. **Why?** (optional, ≤1 sentence: "Some tasks reference each other in a loop.")
3. **What can the user do?** (always required: "Open the Tasks page to review dependencies.")

A message that only describes the problem ("Dependency cycle detected") fails — the user is left without an action.

## Pattern: tone matches outcome, not loudest signal

If the user's primary action succeeded but a secondary action failed: that's **partial success**, not failure.

- Use `toast.warning` not `toast.error` when the user's edit saved but a preview / cascade / side-effect didn't run.
- Use `toast.info` when the user's edit saved cleanly and we're just nudging them about something.
- Reserve `toast.error` for true failures (the user's primary action did not complete).

## Verification checklist (run before writing the string)

For any user-facing string you're about to write or change:

1. [ ] Does it use any word from the forbidden vocabulary? Rewrite.
2. [ ] If it's a template literal, does it parse correctly for ALL possible substitutions? Restructure if not.
3. [ ] If it's an error: does it answer what / why / what-next?
4. [ ] If it's a toast: does the tone (error / warning / info / success) match the actual outcome severity?
5. [ ] Is the length within budget for its surface (60 / 120 / 25 chars per §)?

## Examples — real fixes from this project

### Before (M20.7, screenshot dogfooded):
> "Dependency cycle detected — cannot cascade. Tasks involved: T1 → T3 → T4 → T5 → T6 → T7 → T8 → T13 → T14 → T15. Your edit will still save; cascade propagation is skipped until the cycle is fixed."

**Violations:** jargon ("cascade" × 2, "propagation"), no next-step action, way over length budget, dumps technical detail inline instead of collapsing.

### After:
> **Title:** "Downstream preview unavailable"
> **Description:** "Some tasks reference each other in a loop. Your change to T2 will still save."
> **Action button:** "Open Tasks page" (deep-links to cycle members)

### Before:
> "Apply edit (cascade skipped)"

**Violations:** jargon ("cascade"), parenthetical adds cognitive load.

### After:
> Button: **"Save"**
> Adjacent chip (amber): "preview unavailable"

### Before:
> "← driven by in dependency cycle"

**Violations:** broken grammar from template misuse.

### After:
> Drop the ancestry prefix entirely on cycle rows. Use a small slate chip: `in loop`.

---

## Glossary updates

This file is the canonical source of forbidden-vs-preferred terms for this project. When new jargon leaks into user strings, add a row to the forbidden vocabulary table above with the preferred alternative. The glossary grows with the product.
