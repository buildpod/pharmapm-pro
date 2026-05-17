---
name: parallel-tool-calls
description: Batches independent tool calls into a single message instead of running them sequentially. Triggers when multiple Read / Grep / Bash / Edit operations are independent (no result from one needed before another). Reduces latency dramatically and slightly reduces token usage by avoiding repeated turn overhead. Most common application: git status + git diff + git log at commit time, OR multiple Reads of unrelated files.
---

# Parallel Tool Calls

## When to apply

Apply this skill whenever you're about to make multiple tool calls that **do not depend on each other's results**.

A dependency exists when:
- Tool B's input requires Tool A's output (e.g. read a file path that grep just found)
- Tool B's correctness depends on Tool A's state mutation (e.g. read file after edit)

If neither holds, the calls are independent and should be batched.

## The pattern

Send a single message with multiple tool-use blocks. The harness runs them in parallel and returns all results before the next turn.

```
Message:
  Bash: git status
  Bash: git diff
  Bash: git log --oneline -5
  → all return in parallel
```

Versus the anti-pattern:

```
Message: Bash git status  →  wait for result  →
Message: Bash git diff    →  wait for result  →
Message: Bash git log     →  wait for result
```

Three round-trips of latency instead of one.

## Common applications in this project

### Commit-time inspection (pre-commit ritual)

```
Bash 1: git status
Bash 2: git diff --stat
Bash 3: git log --oneline -5
```

All three are independent. Always batch.

### Multi-file source inspection

When understanding a feature that spans multiple files:

```
Read 1: v2/components/ui/impact-drawer.tsx (slice)
Read 2: v2/components/tasks/tasks-grid.tsx (slice)
Read 3: v2/lib/domain/scheduling.ts (slice)
```

Independent — batch them.

### Cross-cutting greps

When auditing a pattern across the codebase:

```
Bash 1: grep -rn "toast.error" v2/components/
Bash 2: grep -rn "toast.warning" v2/components/
Bash 3: grep -rn "console.error" v2/components/
```

Independent — batch.

### Verification at module close

```
Bash 1: pnpm test (with lean-test-output skill applied)
Bash 2: pnpm build (with lean-test-output skill applied)
```

Independent — batch.

## When NOT to apply (true dependencies)

These ARE sequential:

```
Bash: grep -n "previewTaskCascade" scheduling.ts   →   line 480
Read: scheduling.ts offset=480 limit=80              (needs grep's result)
```

```
Edit: file.ts (change something)
Bash: pnpm test                                       (verifies the edit landed)
```

```
Bash: pnpm test (fails)
Read: scheduling.ts (to investigate the failure)     (decision needs test output)
```

In these cases, sequential is correct.

## Edge case — Edit calls

`Edit` calls on the **same file** must be sequential (each Edit's `old_string` must still match after the previous Edit). `Edit` calls on **different files** can be parallel.

```
Edit file_a.ts ... }
Edit file_b.ts ...   →  these can be parallel (different files)

Edit file_a.ts (change X)
Edit file_a.ts (change Y)  →  must be sequential (same file)
```

## Concrete heuristic before sending each message

Before sending a message with tool calls, ask:
1. Are these all independent operations? → batch in one message
2. Does any operation need a prior result? → split into sequential messages

When in doubt, batch. The harness handles serialization where needed; over-batching is never wrong.

## Estimated impact

- Latency: 3 sequential calls → 1 parallel batch = ~3x faster wall-clock
- Tokens: minor savings (fewer assistant-message overhead) — primary value is latency
- UX: faster iteration cycles in interactive sessions
