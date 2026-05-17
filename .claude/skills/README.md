# Project Skills

Project-level Claude Code skills for AivelloStudio RIM. Each skill lives in its own folder with a `SKILL.md` file containing frontmatter + content.

Authored 2026-05-17 across two sessions:
- Quality skills (1-3) — prevent common UI/UX failure modes seen in M20.7 dogfood
- Efficiency skills (4-8) — reduce token burn observed across M18 → M21-Checkpoint

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
