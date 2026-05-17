# Learnings — Building AivelloStudio RIM with Claude Code

> Living document. Captures the operating model, session discipline, and technical patterns we've found work when building a serious product with an AI pair-coder. Grounded in the actual decisions made across M0 → M20.6 on this project. Use as a template or starting point for the next one.

**Author context:** Vineet Pathak (@buildpod). **Co-author:** Claude (Opus 4.7) over many sessions. **Project:** AivelloStudio RIM (pharma project management tool, Next.js / TypeScript / static export on GitHub Pages).

---

## 1. The thesis

Most "AI-assisted development" anti-patterns trace back to a missing source of truth. Without one, every session restarts cold, scope drifts, decisions get re-debated, and the model invents inconsistencies because nothing pins it down. **The single highest-leverage move is the operating doc.** Everything else in this file is downstream of that one practice.

## 2. The operating doc

A single markdown file at repo root, owned by the human, updated by Claude only in tightly bounded sections. The discipline matters more than the structure, but the structure we've found works:

| Section | Owner | What it holds |
|---|---|---|
| §1 — What we are building | Human | One paragraph of intent. Doesn't change. |
| §2 — What is already built | Human | Snapshot of the deployed predecessor (v1). |
| §3 — Confirmed architectural decisions | Human (with model input) | ADRs. Each one locked. New ones require new ADRs, not edits. |
| **§4 — Current Module + Next Module** | **Claude updates** | The only "live" section. DoD + out-of-scope + status. |
| §5 — Module breakdown | Human | The roadmap. M1, M2, ... |
| §5.1 — Post-launch module sequence | Human | What's next after launch. |
| §5.2 — Tech-debt index | Both | Live ledger. Severity + origin + proposed clearance. |
| §5.3 — Design tokens & tone semantics | Both | Codified visual language. |
| §6 — Known issues being managed | Human | Things deliberately not fixed yet. |
| §7 — Backlog | Both | Captured ideas, explicitly not in scope. |
| **§8 — Last Session Log** | **Claude appends** | Newest at top. Date + what was decided + what was committed + what's next. |
| §9 — Anti-drift rules | Human | Non-negotiable. Claude must obey. |
| §10 — Glossary | Both | Terms used across sessions. |

**Why this works:**

- **§4 is the only place Claude has discretion.** Everything else is human-owned. This bounds the agent's autonomy.
- **§8 is append-only history.** Old sessions stay readable. Future sessions can answer "when did we decide X?" without re-asking.
- **§9 anti-drift rules** are enforceable: when you say "you're hallucinating," Claude is instructed to stop and ask which rule was violated, not defend.

## 3. The session discipline

### 3.1 One module per session

Hard rule. Any session starts by reading §4 of the operating doc. If §4 isn't clear, the first move is to discuss / lock scope — not to write code. "Let me also do X while I'm here" is forbidden; new ideas go to §7 Backlog.

This single rule has prevented more drift than every other practice combined. Each module gets a clean commit history, a clear "what was done", and a clear handoff to the next session.

### 3.2 Confirm before commit

After implementation but before commit:
1. Claude shows what changed (build status, test status, file list)
2. Human dogfoods locally
3. Human says "commit" → Claude commits with a structured message + pushes

The dogfood step catches the things tests don't: feels of UX, real-world edge cases, "this doesn't read right". Skipping it means shipping bugs that look correct in green test output.

### 3.3 Definition of Done is non-negotiable

Every module §4 entry has a DoD bullet list. The session is not complete until every bullet is true OR explicitly demoted to a follow-up module. Claude treats this as a contract.

The DoD makes scope ambiguity impossible. "Is this done?" → "Does every DoD bullet pass?"

### 3.4 Out-of-scope is part of the DoD

Every module §4 also explicitly lists what's deferred. Without this, scope creeps mid-session. With it, when Claude (or you) catches yourself reaching for something extra, you check the list. If it's "deferred," it goes to §7 Backlog and waits.

### 3.5 Session log is append-only

§8 grows. Each session adds a dated entry: strategic context, what was built, what was decided, what's pending. **Decisions get a paragraph.** "Why we picked X over Y" is more valuable in 3 months than "what X is."

### 3.6 Periodic architectural checkpoint (every N modules)

Anti-drift rule §9.9 on this project: every 4 feature modules, the next slot is a checkpoint session — no new features, just tests + competitive scan + tech-debt review. M20.2 was the first such checkpoint and prevented at least one structural refactor we'd have hit at M23.

## 4. Technical patterns that consistently worked

### 4.1 Module numbering with sub-versions

When a module's dogfood reveals a real issue, don't shoehorn the fix into M21. Branch to M20.1, M20.2, etc. This project's cascade arc:
- M18 — basic drawer
- M20 — selective cascade
- M20.1 — cascade UX polish + cycle bug fix
- M20.2 — architectural pre-flight refactor
- M20.3 — bidirectional task↔milestone
- M20.4 — formal spec + test matrix
- M20.5 — engine fixes from spec gaps
- M20.6 — drawer UX polish

Each sub-version was a real focused module. Numbering keeps history linear and the "why M20.x exists" reasoning readable from §4 history.

### 4.2 Formal spec before fix — the M20.4 pattern

Mid-arc, before fixing what looked like bugs in the cascade engine, we paused to formally write down what the engine does. Output: `CASCADE_ALGORITHM.md` (11 sections, cross-checked against PMBOK / MS Project / Primavera / CCM). The doc itself revealed two P0 gaps we hadn't noticed.

**Pattern:** when a feature is critical (here, cascade output flows to SteerCo decisions), spending a session formalising-then-testing beats spending three sessions ad-hoc fixing. The test matrix becomes the regression net forever after.

### 4.3 Punch lists with severity + fix sketch

Every gap found gets:
- **ID** (PL-1, PL-2, ...)
- **Severity** (P0 wrong / P1 surprising / P2 cosmetic)
- **Issue** in one sentence
- **Fix sketch** — not the fix, just the shape of it

Punch lists live in the spec doc. When you commit fixes, you update the table to ✅ Resolved with the commit hash. Lets you scan "what's known broken" without git archaeology.

### 4.4 Skipped tests as living documentation

When a test demonstrates a known gap, `it.skip(...)` it with a `// PL-N` comment. It documents the gap, can't fail CI, and flips to active `it(...)` when fixed. Better than a TODO comment because it's executable.

**Convention enforced on this project:** *failing tests in this file are always regressions, never discovered gaps*. Discoveries become skipped tests + new PL entries. This keeps green-CI meaningful.

### 4.5 Engine first, UI later

For features where correctness matters more than visual polish (cascade engine → SteerCo accuracy), we landed the engine module-by-module before doing UX polish. M20.5 fixed the engine; M20.6 polished the drawer. The reverse order would have meant polishing a UI on top of incorrect numbers.

When the user asks for both, sequence engine first. UI polish gets cheaper once the engine is stable.

### 4.6 Tone discipline

Codified in §5.3 of the operating doc:
- **Rose** = blocking violation (action needed)
- **Amber** = soft conflict (consider)
- **Blue** = informational / opportunity
- **Emerald** = success / resolved
- **Slate** = neutral

Applied uniformly across toasts, badges, card borders, drawer sections, notification bell items. The discipline matters more than the specific palette — what matters is *one* meaning per color, *across* the product.

Caught a real bug: post-M20 a "Task updated" green toast was firing alongside a "Task due after milestone" amber toast on the same action. Competing tones for the same event read as cheap product. §5.3 prevented the next instance.

### 4.7 Tech-debt index as live ledger

§5.2 of the operating doc. Every architectural compromise goes in. Severity, origin, proposed clearance. Reviewed at every checkpoint. Stops debt from accumulating invisibly. M20.2 cleared 4 items; logged 4 more for follow-up.

### 4.8 ADRs for locked decisions

Anti-debate guard: §3 of the operating doc holds Architectural Decision Records. Each one names the decision, the alternatives considered, the chosen path, and the reason. Re-debating a locked ADR requires a new ADR with substantive new evidence. Without this, every session risks re-litigating "should we use Supabase?" or "Vercel or static export?".

## 5. Patterns specific to working with Claude Code

### 5.1 Treat the agent like a smart engineer with no context

Every session, the model starts cold. The operating doc + CLAUDE.md are how it "remembers." A new session that doesn't read those will repeat decisions, suggest already-rejected alternatives, and waste tokens.

CLAUDE.md (per Claude Code convention) lives at repo root and tells Claude: "Read AIVELLO_OPERATING_DOC.md first, then identify Current Module from §4, then confirm goal with Vineet before writing code." Three sentences; saves entire sessions.

### 5.2 Be specific about "do this" vs "research this"

Worked examples in our sessions:
- ✅ "Implement PL-3: switch daysShifted to working days, here's the helper signature, update these four call-sites." → clean implementation.
- ❌ "Improve the cascade." → drift.
- ✅ "Audit what's left before this branch can ship — punch list under 200 words." → useful research.
- ❌ "What do you think we should do next?" → fluff.

### 5.3 Long sessions: use the operating doc as anchor

When a session exceeds a few hours and you start to see context-cache misses or the model losing thread, the fix is almost always: "Re-read §4 + relevant §8 entry, summarise current state in three lines, then continue." Forces alignment without restarting.

### 5.4 Spawn focused side-agents for parallel work

When you have genuinely independent work (a research question + a code task), launch them in parallel. When you have dependent work (research informs the code), do them sequentially in the main session. Mixing the two wastes the cache.

### 5.5 Commit messages are documentation

Structured commit message convention used here:
- One-line title with module ID
- Empty line
- Bullet list of *what changed and why* (not just "added foo")
- Test/build status line at end
- Co-author line

Future you and future Claude both read these. They're a second-line audit log after §8 of the operating doc.

## 6. What we learned the hard way

### 6.1 Tests document, they don't compensate

70 passing tests aren't a substitute for a formal spec when the feature is critical. We found 11 punch-list items in M20.4 — half of them had passing tests covering the surface area but no test asserting the right semantic. Tests verify what you thought to verify.

### 6.2 "Auto-fix" is silent damage

The PL-11 bug: cascade engine silently corrected pre-existing data inconsistencies whenever the user saved anything. Tests passed because no test asserted "leave pre-existing alone." Found only via formal spec. **Principle for any engine that mutates user data: state explicitly what it *won't* touch.** Then test that.

### 6.3 UI polish without engine correctness is wasted

We spent a session on cascade drawer UI (M20.6) AFTER engine fixes (M20.5). If we'd reversed the order, M20.6's nice visualization would have shown wrong numbers in a pretty way. Customers don't thank you for pretty wrong.

### 6.4 Architectural refactors get cheaper with each module deferred — until they don't

We knew M20.2 (Zustand + audit log + repository pattern + validator) was coming for several modules. Each session we deferred it cost a small amount of patching. By the time we ran it, the cost was one focused session but the *risk* of NOT running it was rising fast — the next 4 modules all depended on it. **The right time to refactor is just before the modules that need the refactor.** Not earlier (you over-design), not later (you patch around it forever).

### 6.5 PMBOK / industry references matter even if you're not building enterprise tools

We cross-checked the cascade engine against PMBOK §6.5, MS Project's auto-vs-manual scheduling, Primavera P6's constraint hierarchy, and Goldratt's Critical Chain Method. Not because we adopt them wholesale — we deliberately don't — but because **stating where you deviate from prior art is part of the spec.** It prevents users from being surprised by "why doesn't this work like Project?" and gives you a defensible answer.

### 6.6 Confirm-before-commit catches what tests miss

Multiple times: green tests, clean build, then Vineet says "the cascade UX still feels off." That's the feedback the test suite can't deliver. The dogfood step is non-negotiable for any UI-touching module.

## 7. How to apply this on a new project

If starting from scratch:

1. **Hour 1:** write the operating doc skeleton. §1 intent, §3 ADRs (pick the stack), §5 module list, §9 anti-drift rules. Don't fill §4 yet — you don't have a current module.
2. **Hour 2:** write CLAUDE.md telling the agent to read the operating doc first. Three sentences.
3. **Hour 3 onward:** for each module, **start the session** with: "Lock M1: here's the goal, here's the DoD, here's what's out of scope." Update §4. Then code.
4. **End every session:** Claude appends §8. Even if the work didn't land — log what was tried, what blocked it, what's next.
5. **Every 4 modules:** checkpoint session. Tests + competitive scan + tech-debt review.
6. **When a feature is critical:** formalise-then-test before fixing. The test matrix is forever value.
7. **When tone matters:** codify §5.3 early. Cheap-product feel comes from inconsistent tone more than any single bug.

If joining an existing project: read every §8 entry top-to-bottom. Most of "how this project really works" is in there.

## 8. What this isn't

- **Not a methodology that scales to teams.** This works for one human + Claude. Multi-human teams need git workflow + PR review on top.
- **Not a substitute for product judgment.** The operating doc captures decisions made; it doesn't make them.
- **Not a guarantee Claude won't hallucinate.** Anti-drift rules limit damage; they don't eliminate it. Always verify Claude's claims against the actual files.
- **Not framework-specific.** Most of this works the same in Next.js, in a Python service, in an iOS app.

## 9. Things still on this project's improvement list

- Multi-project audit log filtering (currently per-project)
- A "what changed today" feed surfaced from the audit log
- Undo/redo UI on top of the M20.2 action infrastructure
- A scenario / what-if save mechanism in the cascade drawer
- Path C transition (Supabase backend) — repository interface is ready, swap is one file
- Periodic-checkpoint cadence enforcement (currently manual)

Logged here so a future "look how far we've come" entry has something to compare against.

---

**Last updated:** 2026-05-17 (after M20.6).
**To update:** add new patterns to §4 or §6 as they emerge. Keep tight — if this doc gets long, you stop reading it.
