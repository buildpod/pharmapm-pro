# CLAUDE.md

**Project:** PharmaPM Pro (enterprise pharma project management tool)
**Owner:** Vineet Pathak (@buildpod on GitHub)
**Repo:** github.com/buildpod/pharmapm-pro

---

## How to use this file

Claude Code reads this at the start of every session in this repo. Keep it short. The full project history, decisions, and module breakdown live in `AIVELLO_OPERATING_DOC.md` in this same folder.

**Before doing anything in a new session:**
1. Read `AIVELLO_OPERATING_DOC.md` end-to-end
2. Identify the Current Module from section 4
3. Confirm the goal with Vineet before writing any code

**Methodology reference:** `LEARNINGS.md` at repo root captures the operating model, session discipline, and technical patterns this project uses. Read it when starting a session that touches cross-cutting concerns (operating doc structure, ADRs, punch lists, checkpoint cadence).

**Project skills:** `.claude/skills/` contains 11 skills across three categories — read `.claude/skills/README.md` at session start. Invoke applicable skills proactively as you work:
- **Quality (surface):** `ui-string-audit` + `tone-discipline` + `error-message-pattern` for every UI string / color / error
- **Efficiency:** `session-bootstrap` + `focused-read` + `lean-test-output` + `parallel-tool-calls` + `audit-log-compression`
- **Architectural:** `save-flow-parity` + `pre-existing-state-distinction` + `cross-entity-parity` for any save handler / guard / cross-entity behaviour change

**Pre-commit discipline for architectural modules:** before committing any module that adds an entity type, refactors a flow, or changes save handlers, invoke the built-in `simplify` skill on the diff (or `review` for broader inspection). Skip for pure-copy / pure-styling commits. Catches the kind of asymmetry that authored skills + manual review both miss.

---

## What this codebase is

The repo currently contains **v1** — a working vanilla JavaScript app deployed at `https://buildpod.github.io/pharmapm-pro/`. 305 tests pass. The domain logic (scheduling, dependency engine, settings, document workflow) is solid.

We are now building **v2** on branch `enterprisepharmapm-pro`. v2 is a UI rewrite in Next.js + TypeScript + Tailwind + shadcn/ui. It will eventually replace v1's UI while reusing v1's proven domain logic.

**v2 will be deployed to a separate path** (`/v2/` or a new GitHub Pages site) so v1 stays live as reference until v2 is ready.

---

## The stack (locked in ADR-003 of operating doc)

- **Framework:** Next.js 14+ with App Router, static export (`output: 'export'`)
- **Language:** TypeScript with strict mode
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Package manager:** pnpm
- **Hosting:** GitHub Pages (same as v1)
- **Deploy:** GitHub Actions on push to `enterprisepharmapm-pro` branch

Do NOT use: Vercel-specific features, server-side rendering, API routes, anything that prevents static export.

---

## Conventions

- **TypeScript strict mode is non-negotiable.** No `any` types without a `// reason: ...` comment explaining why.
- **One component per file.** File name matches the export.
- **Tailwind classes only.** No custom CSS files except the global stylesheet for tokens.
- **shadcn components go in `components/ui/`.** Custom components go in `components/`.
- **Domain logic goes in `lib/domain/`.** Ported from v1's `src/` JavaScript files into TypeScript.
- **Mock data goes in `lib/mockData.ts`.** No backend, no API calls yet.

---

## Anti-drift rules (from operating doc section 9)

These are non-negotiable. Vineet can quote any of them back.

1. **No new modules without updating section 4 of AIVELLO_OPERATING_DOC.md first.** If something isn't in section 5 of that doc, it doesn't get built this session.
2. **No proposing alternatives that contradict section 3 ADRs.** Re-debating locked decisions requires a new ADR with substantive new evidence.
3. **No starting work without a confirmed Current Module** (section 4 of operating doc).
4. **No ending a session without updating section 8 (Last Session Log) of operating doc.**
5. **One module per session.** "Let me also build X while I'm here" is forbidden. New ideas go to section 7 (Backlog).
6. **No assuming code runs.** Test before claiming it works.
7. **If Vineet says "check the operating doc," stop and re-read `AIVELLO_OPERATING_DOC.md`.**
8. **If Vineet says "you're hallucinating," stop immediately, do not defend, ask which section is being violated.**

---

## v1 reference

The v1 codebase is in this same repo root (`index.html`, `src/`, `tools/`). v1 must continue to work. **Do not modify v1 files on the `enterprisepharmapm-pro` branch except via explicit instruction.**

To run v1 locally:
```bash
node tools/run_tests.js          # confirms 305/305 pass
open index.html                   # opens v1 in browser (no server needed)
```

To verify v1 tests still pass after any changes:
```bash
node tools/run_tests.js
```

This should always print `305/305 passed`. If it doesn't, something is wrong.

---

## Current focus

See section 4 of `AIVELLO_OPERATING_DOC.md` for the Current Module and its definition of done.

Right now (as of 2026-05-11), the Current Module is **M1 — Project setup**. The full M1 spec is in `M1_SPEC.md` in this same folder.
