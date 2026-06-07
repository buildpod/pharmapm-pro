# PharmaPM Pro — Codex / Claude Code Task Prompt

Copy the block below. Fill in the three lines marked ✏️. Send as your task prompt.
Everything else is pre-filled from the project's TRACE infrastructure.

---

```
## 1 — Orientation

Read `AGENT_CONTEXT.md`. Do not open any other file until you have read it.
Read `AIVELLO_OPERATING_DOC.md` section 4 to confirm the Current Module.
Then read `AGENT_CONTEXT_INDEX.json` and load the file list for role: ✏️ [ROLE].

Roles available:
  builder-domain  → pure TypeScript in v2/lib/domain/ (no UI, no stores)
  builder-ui      → React components in v2/app/ and v2/components/
  builder-spec    → architecture spec docs in v2/docs/
  architect-review → read-only, no changes

## 2 — Files you are allowed to read

Load from AGENT_CONTEXT_INDEX.json → roles → [ROLE] → source_files + test_files.
Do not read beyond that list.

Do NOT read: src/, tools/, index.html, node_modules/, out/, .next/
Do NOT modify: src/, tools/, index.html (v1 — must stay untouched)

## 3 — Task

✏️ [DESCRIBE THE TASK HERE — reference the Current Module from AIVELLO_OPERATING_DOC §4]

## 4 — Definition of done

- [ ] ✏️ [SPECIFIC OUTCOME matching the Current Module DoD in AIVELLO_OPERATING_DOC §4]
- [ ] New behaviour covered by Vitest tests in same directory as source file
- [ ] Run from v2/: pnpm test → all tests pass (current baseline: 164 passed)
- [ ] v1 still passes: node tools/run_tests.js → 305/305 passed

## 5 — Constraints

- TypeScript strict mode. No `any` without `// reason: ...` comment.
- Tailwind classes only. No custom CSS outside v2/app/globals.css.
- One component per file. Filename matches the export name.
- Domain logic (v2/lib/domain/) must be pure — no imports from app/ or components/.
- No SSR, no API routes, no Vercel features. Must work with output: 'export'.
- pnpm only — not npm, not yarn.
- Do not build anything outside the Current Module scope.
- Do not commit or push.
- If something is ambiguous, stop and say so — do not assume.

## 6 — When done, report

1. Files changed (name + one-line summary)
2. Last 4 lines of: pnpm test (from v2/)
3. Last line of: node tools/run_tests.js
4. Update AIVELLO_OPERATING_DOC.md section 8 (Last Session Log) — required.
5. Anything found but not fixed (out of scope)
```

---

## Why this prompt is short

Full context lives in `AGENT_CONTEXT.md` (stack, constraints, skills, file map).
Module scope lives in `AIVELLO_OPERATING_DOC.md` section 4.
Role file lists live in `AGENT_CONTEXT_INDEX.json`.
The agent reads those files once — you don't repeat them in every prompt.
