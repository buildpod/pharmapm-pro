---
name: session-bootstrap
description: Optimizes how a new Claude Code session reads the project's persistent memory. Instead of reading the entire AIVELLO_OPERATING_DOC.md (~1700 lines / ~50k tokens) at session start, fetch only the sections needed to start work. Triggers on the first read of AIVELLO_OPERATING_DOC.md in a session, or when invoked explicitly at session start. Reduces cold-start token usage by 30-40k per session.
---

# Session Bootstrap

## When to apply

Apply this skill on the **first interaction with `AIVELLO_OPERATING_DOC.md`** in a new session — typically the first thing Claude does per CLAUDE.md guidance.

## The pattern

Do NOT read the entire operating doc. Instead, fetch sections progressively based on the work at hand:

### Always read at session start (mandatory minimum)

1. **§4 — Current Module** (lines ~89–250 typically)
   - The DoD, out-of-scope, status of what's being worked on
   - Recent module completion summaries (last 1-2)
2. **The most recent §8 entry** (the latest "Last Session Log" block)
   - What just happened, what's pending, decided rationale
3. **CLAUDE.md** (entire file, it's small)

### Read lazily — only when relevant

| Section | Trigger to read |
|---|---|
| §1–§3 (intent, v1 state, ADRs) | Only when a decision needs cross-referencing OR when starting first-ever session on the project |
| §5.1 (post-launch module sequence) | Only when planning M21+ (new feature module) |
| §5.2 (tech-debt index) | Only at architectural checkpoints OR when introducing/clearing debt |
| §5.3 (design tokens & tone) | When touching color / tone / UI — but the `tone-discipline` skill embeds this already |
| §6 (known issues) | When a user-reported bug needs context |
| §7 (backlog) | When considering scope additions |
| §8 (older entries) | When a past decision is referenced explicitly (search by module ID) |
| §9 (anti-drift rules) | When approaching a scope-creep decision OR proposing a new ADR |
| §10 (glossary) | When a term is ambiguous |

## How to execute the read

Use the `Read` tool with `offset` + `limit` to fetch just the §4 + latest §8 entry:

```
1. grep -n "^## 4 \|^## 8 \|^### Session " AIVELLO_OPERATING_DOC.md  → find section line numbers
2. Read AIVELLO_OPERATING_DOC.md offset=<§4 start> limit=<§4 length>
3. Read AIVELLO_OPERATING_DOC.md offset=<latest §8 entry> limit=~150
```

That's typically ~400 lines / ~10-12k tokens vs the full ~50k.

## What to do when work touches more sections

When the conversation reveals work needs more context:
- "User asks about an ADR" → read §3
- "User asks about a past module" → grep §8 for the module ID, read that block
- "User raises tech-debt question" → read §5.2
- "User proposes a new module" → read §5.1 + §7

Always read the **minimum needed**, never the whole doc by default.

## Sanity check

If at any point in a session you find yourself unsure of project conventions, anti-drift rules, or a locked decision, **the right move is to grep for the specific term in the operating doc**, not to re-read the whole thing. The operating doc is a lookup table, not a book to be read end-to-end every session.

## Estimated impact

- Token savings per session start: 30-40k tokens (vs reading the whole doc)
- At 30 sessions / project lifetime: ~1M tokens saved
- Cache benefit: §4 + latest §8 fit comfortably in the 5-min prompt cache window, so consecutive reads in the same session are free
