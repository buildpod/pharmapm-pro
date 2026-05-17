---
name: tone-discipline
description: Enforces the §5.3 tone semantics from AIVELLO_OPERATING_DOC.md across all visual UI choices. Triggers when adding or changing Tailwind color classes (rose / amber / blue / emerald / slate / violet variants) in TSX files, when choosing a toast variant (error / warning / info / success), or when picking icon colors. Catches color-vs-outcome mismatches before they ship — the M20.7 cycle drawer being all-rose when it should have been amber/blue is the canonical failure this skill prevents.
---

# Tone Discipline

## When to apply

Apply this skill whenever you:
- Add or change a Tailwind utility class matching `(rose|amber|blue|emerald|slate|violet|indigo)-(50|100|200|300|400|500|600|700|800|900)` in a TSX file
- Choose between `toast.error` / `toast.warning` / `toast.info` / `toast.success`
- Pick an icon color via `text-X-Y` or border via `border-X-Y` or background via `bg-X-Y`
- Apply CSS to indicate state on a badge / chip / pill / card / drawer section

## The §5.3 tone semantics (canonical)

Lifted from `AIVELLO_OPERATING_DOC.md` §5.3. Re-stated here for skill self-containment.

| Tone | Tailwind base | Used for | NOT for |
|---|---|---|---|
| **rose** | `rose-50` bg + `rose-200` border + `rose-700` text | **Blocking violation**, hard error, missed deadline, overdue. PM action required to clear. | Soft warnings · partial success · info nudges · status of completed past actions |
| **amber** | `amber-50` bg + `amber-200` border + `amber-700` text | **Soft conflict** requiring consideration. At-risk milestone, due-soon task, budget approaching threshold, partial-success states. | Hard violations · success · neutral info |
| **blue** | `blue-50` bg + `blue-200` border + `blue-700` text | **Informational, opportunity, awareness.** Slack created, schedule headroom, project ahead of plan, project metadata, "preview unavailable" with edit-saved success. | Warnings · errors · success |
| **emerald** | `emerald-50` bg + `emerald-200` border + `emerald-700` text | **Success / resolved / on-track.** Task complete, decision approved, milestone met on time, all-clear empty states. | Mid-progress states · informational nudges · errors |
| **slate** | `slate-100` bg + `slate-200` border + `slate-600` text | **Neutral, no signal.** Default text, draft status, unscheduled items, supporting metadata, "in loop" status chips. | Anything actionable — slate is "nothing to see here" |
| **primary / violet / indigo** | `primary` token (deep indigo) | **Active selection / in-progress / primary CTA.** Active project, in-progress status, primary button. | Errors · warnings · neutral states |

## Tone vs outcome — the critical decision

The single most common mistake is using **rose for the loudest signal in the room** instead of matching tone to actual outcome severity. Decision tree:

```
Did the user's primary action complete?
├─ YES — primary action succeeded
│   ├─ Was there a fully-clean result? → emerald (success toast / chip)
│   ├─ Did a side-effect / preview fail? → amber or blue (warning or info — partial success)
│   ├─ Is this just informational? → blue
│   └─ Is this purely cosmetic? → slate
│
└─ NO — primary action did not complete
    ├─ Is there a violated hard constraint? → rose (error toast / blocking)
    ├─ Is the user about to make a risky choice? → amber (warning, not blocking)
    └─ Is recovery automatic? → use a quieter tone — info chip, not full error
```

## Real failure this skill prevents

**M20.7 cycle drawer (deployed, dogfood-flagged):**
- Drawer was entirely rose-themed: rose error banner, rose pill on the cycle list section, rose "Apply" button context.
- **Reality:** the user's edit *did* save. The cycle only blocked the *cascade preview*, which is a secondary feature.
- **Correct tone:** amber for the cycle banner ("partial success — primary action saved, secondary preview unavailable"), blue or slate chips on the cycle-task rows ("informational identification, no action available"), default-primary on the Save button (not error-styled).
- **Diagnosis:** the developer matched tone to the loudest signal ("there's an ERROR!") instead of to the actual outcome ("the user got what they wanted; we're just informing them a preview is unavailable").

## Verification checklist

Before committing any color-class change:

1. [ ] What state is this UI element communicating? (error / warning / info / success / neutral / primary)
2. [ ] Does the chosen tone match the state per the table above?
3. [ ] If using rose: is this actually a blocking violation that the user must act on, or am I matching tone to "this is the loud thing"?
4. [ ] If using emerald: is this actually success/resolved, or am I overselling a partial-success state?
5. [ ] If using blue: is this informational with no action required, or am I burying a warning that needs amber?
6. [ ] Are adjacent UI elements (icons, borders, chips) using consistent tones?

## Toast variant selection

```
toast.error    → primary action failed; user has to retry / fix something
toast.warning  → primary succeeded but with caveats / partial success / risk
toast.info     → primary succeeded cleanly; quiet nudge / awareness
toast.success  → primary succeeded cleanly + want to celebrate / confirm
```

Default to `toast.info` over `toast.warning`, and `toast.warning` over `toast.error`, unless certain you're at the louder severity. Loud-by-default is cheap-product feel.

## Common anti-patterns to catch

- `border-rose-200` on a section whose content is read-only / informational → should be `border-amber-200` or `border-blue-200`
- `bg-rose-50` on a drawer card whose adjacent text says "your edit saved" → tonally contradicts the message; should be amber or blue
- `toast.error("Cannot apply cascade")` when the edit actually saved → should be `toast.warning("Preview unavailable")` with success-tone description
- `bg-emerald-50` on a "0 of 10 shifts included" pill → emerald implies all-good; "0 shifts" might be a problem; use slate or amber
- Mixed tones in the same row (rose badge + emerald checkbox + amber chip) → confusing; pick one dominant tone per row
