# Project Skills

Project-level Claude Code skills for AivelloStudio RIM. Each skill lives in its own folder with a `SKILL.md` file containing frontmatter + content.

Authored 2026-05-17 across three sessions:
- Quality skills (1-3) — prevent common UI/UX failure modes seen in M20.7 dogfood
- Efficiency skills (4-8) — reduce token burn observed across M18 → M21-Checkpoint
- Architectural skills (9-11) — prevent the M22.1 class of bug (behavioural parity, pre-existing-state distinction, cross-entity consistency)

## Quality skills

| Skill | Purpose | Catches |
|---|---|---|
| `ui-string-audit` | Plain-language user strings | "Dependency cycle detected — cannot cascade" / broken template literals |
| `tone-discipline` | Enforce §5.3 color semantics | Rose-themed partial-success states, emerald-for-warnings |
| `error-message-pattern` | What / Why / Next structure | "Cannot apply cascade" toast with no remediation path |

## Efficiency skills

| Skill | Purpose | Savings |
|---|---|---|
| `session-bootstrap` | Read only §4 + latest §8 at session start | 30-40k tokens / session start |
| `focused-read` | Grep before reading large files | 5-15k tokens / large-file lookup |
| `lean-test-output` | Pipe test/build output through tail | 2-3k tokens / verification run |
| `parallel-tool-calls` | Batch independent tool calls | Latency 3x faster |
| `audit-log-compression` | Cap §8 session log entries | 50% smaller per entry |

## Architectural skills (M22.2)

These operate at the code-structure layer, complementing the surface-layer quality skills. Each was authored after a specific architectural bug evaded the quality skills.

| Skill | Purpose | Catches |
|---|---|---|
| `save-flow-parity` | Inline + form save paths on the same field must trigger the same side-effects | M22.1 #1 — milestone form bypassed cascade preview that the inline edit triggered |
| `pre-existing-state-distinction` | Every guard / validator must distinguish baseline-broken from user-introduced state | PL-11 — engine silent auto-fix of pre-existing violations; M22.1 #2 — cycle guard blocking saves on pre-existing graphs |
| `cross-entity-parity` | When changing one entity's behaviour, check if siblings need the parallel | M22.1 #1 — tasks had cascade-on-save, milestones didn't |

## Built-in skills to use proactively

Beyond authored skills, two built-in skills are available in Claude Code that we should invoke deliberately:

| Built-in | When |
|---|---|
| `simplify` | Before commit on any architectural module (M-N feature modules, refactors, new entity types). Reviews changed code for reuse, quality, efficiency. Would have flagged M22.1 #1 as a reuse miss. |
| `review` | Before commit on PR-style changes when an independent code review pass would add value. Skip for pure copy / pure styling. |

CLAUDE.md captures this in the per-session protocol.

## Adding new skills

Each skill is a folder with `SKILL.md`. Frontmatter:

```yaml
---
name: <kebab-case-name>
description: <when this skill applies + what it does, ≤2 sentences>
---
```

Skills should be:
- Specific (not "write good code"; instead "audit user-facing strings for these terms")
- Triggered by concrete contexts (file type, tool name, pattern in code)
- Grounded in real failure modes from this project where possible
- Reviewed and tightened over time as we hit new cases

## Authoring sources

- Quality skills derived from M20.7 cycle-state UX failure (rose-themed, dev-jargon, no next step)
- Efficiency skills derived from observed token-burn patterns across M18 → M21-Checkpoint
- Conventions from `LEARNINGS.md` at repo root
- Anti-drift / tone references in `AIVELLO_OPERATING_DOC.md` §5.3, §9
