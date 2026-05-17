---
name: lean-test-output
description: When running pnpm test or pnpm build, pipe the output through tail/grep to extract only pass-fail status and bundle sizes. Avoids dumping the full 100+ line output for routine verification runs. Triggers on any Bash invocation of pnpm test, pnpm build, npm test, npm run build, or equivalent. Saves ~2k tokens per routine run; full output remains accessible by re-running when investigating failures.
---

# Lean Test Output

## When to apply

Apply this skill on every routine test or build verification run. Specifically:

- `pnpm test` / `npm test` / `vitest run`
- `pnpm build` / `npm run build` / `next build`
- `pnpm lint` / `pnpm typecheck` (when added)
- Any CI-style script you're running for confirmation, not investigation

## The pattern

### For `pnpm test` (routine verification)

```bash
pnpm test 2>&1 | tail -8
```

This captures:
- Test files pass/fail count
- Test pass/fail/skipped count
- Run duration
- The "Tests" final line

**Use the full output ONLY when:** there's a failure to debug. Then re-run without the tail.

### For `pnpm build` (routine verification)

```bash
pnpm build 2>&1 | grep -E "Route|First Load|error|Failed|✓|✗|✘|kB" | tail -25
```

This captures:
- Route sizes
- First Load JS sizes
- Errors / failures
- Page generation status

Alternative when you only care about pass/fail + bundle deltas:

```bash
pnpm build 2>&1 | tail -25
```

### For both — running in parallel

When you need both test + build verification, run them as parallel Bash calls in one message:

```
Bash 1: pnpm test 2>&1 | tail -8
Bash 2: pnpm build 2>&1 | tail -20
```

The harness runs them in parallel; latency is bound by the slower one.

## Patterns to avoid

### Anti-pattern 1: Raw `pnpm build` output

```
pnpm build 2>&1
```

Dumps ~150 lines including chunk size table, page generation progress, build traces. ~3-4k tokens of which 90% is noise.

### Anti-pattern 2: Reading full output to "be sure"

If `tail -8` shows `Tests 122 passed | 4 skipped`, that's verified. You don't need to read the per-file breakdown unless something failed.

### Anti-pattern 3: Sequential test then build

```
Bash: pnpm test  (wait for result)
Bash: pnpm build (wait for result)
```

These have no dependency between them. Parallelize.

## When full output IS needed

- A test failed → re-run without tail to see assertion details
- A build failed → re-run without grep to see the TS error
- A new module's first build → glance at full output to confirm new routes appear

For all other cases, lean output is sufficient.

## Standard verification block

When closing out a module (post-implementation, pre-commit), the standard verification is:

```bash
pnpm test 2>&1 | tail -8        # parallel
pnpm build 2>&1 | tail -25      # parallel
```

That's ~30 lines of output total. Enough to confirm tests pass, build clean, bundle sizes within budget.

## Estimated impact

- Per routine run: saves 2-3k tokens
- Per module session (typically 3-5 verification runs): 6-15k tokens
- Side benefit: when output IS dumped in full, the failure is visually obvious instead of buried
