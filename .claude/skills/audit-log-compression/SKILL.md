---
name: audit-log-compression
description: Enforces a structured, capped format for §8 Session Log entries in AIVELLO_OPERATING_DOC.md. Keeps each session entry under ~150 lines with 5 standard subsections. Prevents §8 from growing into an unreadable wall of text and reduces token cost when older sessions are read for context. Triggers when appending a new §8 entry at the end of a module session.
---

# Audit Log Compression

## When to apply

Apply this skill when **writing a new entry in §8 — Last Session Log** of `AIVELLO_OPERATING_DOC.md`. This is the only place Claude appends-to-history per the operating-doc protocol.

## The structured format

Every §8 entry follows this exact structure. Hard caps enforced.

```markdown
### Session — YYYY-MM-DD (M{ID} — short module name)

**Strategic context:**
[≤3 sentences. WHY this session happened. Reference user feedback or
prior-module trigger. NO list of work done here — that's "Built".]

**Built:**
[Bulleted list of concrete deliverables. ≤8 bullets. Each bullet ≤2 lines.
Files / functions touched. NOT "redesigned the UI" → "added MiniTimeline
component (~50 lines) rendering pos+width bars per row".]

**Decided:**
[Bulleted list of decisions made with rationale. ≤5 bullets. Each bullet
is one decision + one-line "why". Cross-link to ADR if applicable.]

**Pending:**
[≤3 bullets. What this session left for the next one.]

**Followup observations:** (optional, ≤3 bullets)
[Things noticed during the work that aren't pending action but worth
recording for future you.]
```

## What goes WHERE

| Goes in **Built** | Goes in **Decided** | Goes in **Followup observations** |
|---|---|---|
| "Added X function" | "Chose A over B because..." | "Bundle delta was smaller than expected" |
| "Refactored Y" | "Defaulted Z to N because..." | "Test naming convention drift noticed" |
| "Updated docs" | "Decided NOT to do W because..." | "Found a latent bug elsewhere" |
| "Test count Δ" | "ADR-N added to lock decision" | "Future module will benefit from..." |

## Hard caps

| Section | Cap |
|---|---|
| Strategic context | 3 sentences |
| Built bullets | 8 max |
| Each Built bullet | 2 lines max |
| Decided bullets | 5 max |
| Pending bullets | 3 max |
| Followup observations | 3 max |
| Total entry length | ~150 lines / ~3000 words |

If you can't fit, the symptom is usually "this session did too much" — split into two §8 entries (one per logical phase) OR offload narrative detail into a separate doc that §8 links to.

## What §8 entries should NOT contain

- **Full file diffs** — those are in the commit, link to commit hash instead
- **Tutorials** for future Claude — those go in `LEARNINGS.md` or skills
- **Long reasoning chains** — distill to the decision + one-line why
- **Code blocks longer than 10 lines** — link to file paths instead
- **Copy-pasted command output** — summarize: "build clean, 121 tests pass, /tasks 7.31 kB"
- **Multi-paragraph speculation** about future modules — backlog (§7) or out-of-scope notes belong elsewhere

## Reference — good entry

(From M20.6, abridged to show the shape):

```markdown
### Session — 2026-05-17 (M20.6 — cascade impact drawer UX polish)

**Strategic context:**
Vineet's dogfood feedback after M20.5: "i hope the whole cascading and all
have better UI as well or its in later phase". Engine is now PMBOK-correct;
drawer UX still functional rather than enterprise-looking. Four targeted UI
changes turn it from "works" to "feels expensive". No engine changes.

**Built:**
- Mini-timeline per row in impact-drawer.tsx — old → new position on shared
  axis, rose forward / emerald backward, ~50 lines pure CSS
- Workstream / phase grouping — collapsible sub-sections when row.group set
- Ancestry trace — `← driven by ${id}` caption below name on transitive rows
- Apply-count fix — clean "Apply edit · N of M shifts" semantics

**Decided:**
- Mini-timeline as 1.5px bar, not full Gantt strip — glance value not view
- Grouping is opt-in via row.group field — keeps API composable
- Group collapse state is per-group local, not lifted — drawer is short-lived

**Pending:**
- Commit + push after Vineet review
```

## Reference — bad entry (what NOT to do)

```markdown
### Session — 2026-05-17 (M20.6 — drawer polish)

**Strategic context:**
After we shipped M20.5, Vineet did some dogfooding and came back with
feedback that the drawer didn't feel quite right yet. He said it was
functional but not enterprise-looking. We talked about what enterprise
looking means and decided four areas needed work...

[continues for 8 paragraphs of narrative]

**Built:**
- I added a new MiniTimeline component. It's a horizontal bar that shows
  each affected row's old and new position on a shared axis. The axis is
  scaled to the min/max date range across all rows in the drawer...

[continues for 3 more paragraphs per bullet]
```

The bad version takes 4x the tokens to convey the same information.

## When you find yourself wanting to write more

That's usually a signal that a detail belongs in:

- The commit message (technical detail of what changed)
- `CASCADE_ALGORITHM.md` or similar spec doc (semantics)
- `LEARNINGS.md` (cross-cutting pattern)
- A new code comment (file-local detail)

§8 should remain scannable in <60 seconds per entry.

## Estimated impact

- Per session entry: ~50% size reduction vs current entries
- Cumulative §8 size: stays manageable indefinitely
- Token cost on re-read: each entry fits comfortably in working memory
- Side benefit: writing the structured format forces clearer thinking about what was actually decided vs what was just done
