---
name: focused-read
description: Before reading any source file >200 lines, grep for the target symbol first and use Read with offset+limit to fetch just the relevant slice. Prevents the pattern of reading scheduling.ts (~815 lines) or AIVELLO_OPERATING_DOC.md (~1700 lines) repeatedly to look at one function. Triggers when about to Read any TS/TSX/MD file that may be large. Saves 5-15k tokens per "open a large file to check a function" event.
---

# Focused Read

## When to apply

Apply this skill **before** every `Read` call on a file that may exceed 200 lines, especially:

- `v2/lib/domain/scheduling.ts` (~815 lines)
- `v2/lib/domain/scheduling.test.ts` (~500 lines)
- `v2/lib/domain/scheduling.algorithm.test.ts` (~550 lines)
- `v2/components/tasks/tasks-grid.tsx` (~800 lines)
- `v2/components/milestones/milestones-grid.tsx` (~720 lines)
- `v2/components/ui/impact-drawer.tsx` (~600 lines)
- `AIVELLO_OPERATING_DOC.md` (~1700 lines)
- `v2/docs/CASCADE_ALGORITHM.md` (~600 lines)
- `v2/lib/mockData.ts` (large)
- Any other file you suspect is large

## The pattern

### Step 1 — Grep first to find target

```bash
grep -n "<symbol_or_keyword>" <file>
```

Returns matching line numbers. Use these to determine the slice to read.

### Step 2 — Read narrow

```
Read(file_path=<file>, offset=<startLine>, limit=<50-80 lines typically>)
```

50-80 lines is usually enough to see a function + its immediate surroundings. Expand only if structure is incomplete.

### Step 3 — Only read whole file if truly needed

Read whole file ONLY when:
- File is <200 lines
- You're auditing the entire file structure
- The first focused read revealed the relevant code is scattered across many regions

## Common patterns this skill prevents

### Anti-pattern 1: "Let me read the whole scheduling.ts to find one function"

```
Read scheduling.ts  → 815 lines / ~20k tokens
```

**Better:**
```
grep -n "previewTaskCascade" scheduling.ts  → line 480
Read scheduling.ts offset=475 limit=90  → ~90 lines / ~2k tokens
```

Token savings: ~18k.

### Anti-pattern 2: Re-reading a file to check one more thing

You read scheduling.ts at offset 480 to see `previewTaskCascade`. Now you need to check `findConstraintViolations`. **Do not re-read the whole file.**

```
grep -n "findConstraintViolations" scheduling.ts  → line 632
Read scheduling.ts offset=628 limit=35
```

### Anti-pattern 3: Reading a test file to verify a single test passes

You don't need to read a 500-line test file to confirm one test exists. Use grep:

```
grep -n "previewTaskToMilestonePush" scheduling.algorithm.test.ts
```

That tells you the test exists and where. Read only if you need to see its body.

## When NOT to apply this skill

- File is small (<200 lines) — just read it
- You're auditing the entire file as part of a checkpoint or formal-spec exercise
- The file's structure is what's being analyzed (architecture review)

## Estimated impact

- Per large-file lookup: saves 5-15k tokens
- Across a feature module session: typically 5-10 such lookups = 30-100k tokens saved
- Plus latency: a focused read returns faster than a full read

## Tooling notes

The `Read` tool's `offset` parameter is 1-indexed (matches `grep -n` output exactly).
The `limit` parameter is line count, not character count.
