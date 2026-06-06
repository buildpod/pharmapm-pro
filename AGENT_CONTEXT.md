# PharmaPM Pro — Agent Context

**Project:** Enterprise pharma project management tool (UI rewrite)  
**Repo:** `github.com/buildpod/pharmapm-pro`  
**Branch:** `enterprisepharmapm-pro`  
**v2 root:** `v2/`  
**v1:** Deployed vanilla JS at repo root — must stay working.

---

## Before doing ANYTHING — read this first

1. **Read `AIVELLO_OPERATING_DOC.md`** — section 4 has the Current Module and its Definition of Done.
2. **Confirm the goal matches the Current Module.** If it doesn't, stop and ask Vineet.
3. **End every session** by updating section 8 (Last Session Log) of the operating doc.

These rules are non-negotiable (from `CLAUDE.md` anti-drift rules).

---

## Current state (as of 2026-06-06)

- **Current Module:** M30 — EVM engine (pure compute layer, `v2/lib/domain/evm.ts`)
- **v2 test count:** 164 passing (Vitest)
- **v1 test count:** 305 passing (must stay green)
- **Stack:** Next.js 14 + TypeScript strict + Tailwind v4 + shadcn/ui + pnpm

---

## Run before starting any session

```bash
cd ~/projects/pharmapm-pro
bash scripts/preflight.sh
```

---

## Hard constraints

| Rule | Detail |
|------|--------|
| TypeScript strict | No `any` without `// reason: ...` comment |
| Tailwind only | No custom CSS except `v2/app/globals.css` tokens |
| One component per file | Filename matches the export |
| Domain logic location | `v2/lib/domain/` — ported from v1 `src/` JavaScript |
| No SSR / API routes | Must `output: 'export'` for GitHub Pages static deploy |
| pnpm only | Not npm, not yarn |
| One module per session | New ideas go to section 7 (Backlog) of operating doc |
| v1 stays green | `node tools/run_tests.js` must always print `305/305 passed` |

---

## Test commands

```bash
# From repo root
node tools/run_tests.js          # v1 — must stay 305/305

# From v2/
cd v2
pnpm test                        # Vitest unit tests
pnpm build                       # Type-check + Next.js static export
```

---

## Skills to invoke (from `.claude/skills/`)

| Trigger | Invoke |
|---------|--------|
| Session start | `session-bootstrap` |
| Any UI string / color / toast | `ui-string-audit` + `tone-discipline` + `error-message-pattern` |
| Reading large file (>200 lines) | `focused-read` |
| Multiple independent tool calls | `parallel-tool-calls` |
| Any save handler or guard | `save-flow-parity` + `pre-existing-state-distinction` |
| Entity surface changes (grid/form) | `cross-entity-parity` |
| Appending §8 at session end | `audit-log-compression` |
| Routine pnpm test / build output | `lean-test-output` |

---

## Key file map

```
AIVELLO_OPERATING_DOC.md   Single source of truth — modules, ADRs, backlog, session logs
CLAUDE.md                  Short project brief (this file's companion)
LEARNINGS.md               Operating model patterns — read for cross-cutting concerns
v2/
  app/                     Next.js App Router pages
  components/              Custom React components (ui/ = shadcn)
  lib/
    domain/                Pure TypeScript domain logic (ported from v1 src/)
    mockData.ts            Mock data — no backend yet
  docs/                    Architecture specs (TRANSPARENCY_MODEL.md etc.)
src/                       v1 domain logic (JavaScript) — reference only, do not modify
tools/run_tests.js         v1 test runner
```

---

## Role routing → `AGENT_CONTEXT_INDEX.json`

Read `AGENT_CONTEXT_INDEX.json` for role-specific file lists.  
Roles: `builder-domain` · `builder-ui` · `builder-spec` · `architect-review`
