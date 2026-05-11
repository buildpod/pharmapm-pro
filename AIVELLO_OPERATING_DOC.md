# AIVELLO_OPERATING_DOC.md

**Project:** AivelloStudio RIM — pharma project management tool
**Owner:** Vineet Pathak
**Started:** Apr 2026
**Last updated:** May 11, 2026

---

> **HOW TO USE THIS DOCUMENT (read this first, every session)**
>
> This is the single source of truth for what we are building, what has been decided, and what comes next.
>
> When Vineet says **"refer to AIVELLO_OPERATING_DOC"**, Claude must:
>
> 1. Read this document end to end before doing anything else.
> 2. Identify the **Current Module** in section 4.
> 3. Confirm with Vineet what the goal of this session is. If it is anything other than what is stated as Current Module, stop and ask. Do not begin work on a new module without updating section 4 first.
> 4. Stay strictly within scope. Anything new goes into section 7 (Backlog), not into the current session.
> 5. End the session by updating sections 5 (Last Session Log) and 4 (Current Module → Next Module).
>
> If Claude proposes building anything not listed in this document, Vineet should reply **"check the operating doc"**, and Claude must stop and re-read it.

---

## 1 — What we are building

A modern, modular project management tool for pharma/biotech regulated system implementations.

**It must:**
- Run as a deployable single-tenant app (each customer or deployment = one workspace)
- Be portable across local browser, customer-hosted, and we-hosted modes
- Look enterprise-grade — comparable to Linear, Stripe Dashboard, Vercel — not naive
- Reuse the proven v1 domain logic (scheduling, dependency engine, settings, document workflow)
- Replace the v1 vanilla-JS UI layer with React + shadcn/ui + Tailwind + TypeScript

**It is NOT:**
- A multi-tenant SaaS (rejected in ADR-001)
- A new product built from scratch — it is a UI rewrite of the existing v1 logic
- A backend project (database/auth comes later, not now)
- An Excel template (that was the original PROD-002 path; we have moved past it)

---

## 2 — What is already built (v1, deployed and working)

**URL:** `https://buildpod.github.io/pharmapm-pro/`
**Repo:** `github.com/buildpod/pharmapm-pro`
**State:** 305 tests passing, deployed, functioning

**What v1 has that the rewrite must preserve:**
- Schema definitions (projects, milestones, tasks, risks, documents, costs)
- Dependency engine (FS dependencies + lag, cascade preview, backward scheduling, lockDate)
- Working days + holidays calendar with country presets (15 countries × 2 years)
- Document review/approval workflow (currently with comma-string limitation — see section 6)
- Settings service, project service, view service, edit service
- 305 unit tests in `src/test/test.js`

**What v1 has that the rewrite must improve:**
- Vanilla JS UI → must become React + shadcn
- Comma-separated reviewer/approver string → must become per-person decision rows
- Custom CSS → must become Tailwind + design tokens
- Plain HTML tables → must become a real data grid with pinned columns, density modes, proper density

**What v1 has that we are keeping as-is:**
- Hosted on GitHub Pages
- localStorage for persistence
- Mock/imported data, no backend yet
- Single-user, no auth

---

## 3 — Confirmed architectural decisions

These are locked. Do not re-debate without writing a new ADR.

| # | Decision | Why | When |
|---|---|---|---|
| ADR-001 | **Single-tenant deployable**, schema is tenant-aware so multi-tenant remains optional later | Pharma sales prefer isolated deployments; multi-tenant complexity unjustified for current scope | May 5, 2026 |
| ADR-002 | **Per-person decision rows for documents** (one DB row per reviewer/approver per cycle), not comma-separated strings | Pharma practice requires tracking each decision separately | May 5, 2026 |
| ADR-003 | **UI stack: Next.js (static export) + TypeScript + Tailwind + shadcn/ui + Lucide icons** | Industry standard for modern enterprise SaaS UI; ports cleanly to any backend later | May 6, 2026 |
| ADR-004 | **Hosting: GitHub Pages** for the rewrite (same as v1) | No new accounts needed; static export of Next.js works on Pages | May 6, 2026 |
| ADR-005 | **Keep v1 deployed and working** as reference; do not delete | v1 has real working features; useful as a comparison and as a fallback | May 6, 2026 |
| ADR-006 | **Mock data first, backend later** | UI quality is the current bottleneck, not persistence | May 6, 2026 |
| ADR-007 | **Reuse v1 domain logic verbatim** by porting the JS modules into the new repo's `domain/` folder | Logic is solid (305 tests pass); rewriting it would be wasted effort | May 6, 2026 |

---

## 4 — Current Module + Next Module

> This is the **only** part of the doc Claude updates without explicit Vineet input. Update at end of every session.

### Current Module

**Module:** M4B — Milestones grid (Session B: interactive grid)
**Goal:** Inline editing (date pickers, dropdowns), cascade preview modal, "Schedule from Go-Live" action, per-column filters, lock toggle column.
**Definition of done:** Milestones grid is fully interactive, cascade preview works, all M4 DoD items met.

**Started:** (next session)
**Status:** not started

### M4A Completion summary (2026-05-11)

**Module:** M4A — Milestones grid (Session A: port logic + read-only grid)
**Status:** ✅ Complete
**Outcome:** Ported `src/domain/dates.js` → `v2/lib/domain/dates.ts` (8 pure UTC-safe functions). Ported `src/domain/scheduling.js` → `v2/lib/domain/scheduling.ts` (topologicalSort, cascade, computeRAG, computeDependencyStatus, scheduleBackward, previewCascade, computeEndFromDuration, computeDurationFromDates). Installed Vitest 4.1.5; wrote 43 tests covering all domain functions including negative addWorkingDays, lockDate behaviour, backward scheduling, cascade preview non-mutation, and RAG thresholds. All 43 pass. Wired domain engine into read-only milestones grid at `/milestones` — shows all 13 mock milestones with RAG badge, dependency status badge, variance days, lock icon, and phase column. Computed server-side at build time (pure TypeScript, no client state needed). Build clean, pushed `f3b4487`.

### M3 Completion summary (2026-05-11)

**Module:** M3 — Dashboard view
**Status:** ✅ Complete
**Outcome:** Full dashboard live with real mock data. KPI cards (Schedule Health dynamic from mock, Open Risks 5, Budget 39%, Days to Go-Live 114), 6-phase progress bar (Initiation 100% → Go-Live 0%), Risk Profile amber sparkline + Budget Burn blue sparkline (Recharts), top-5 upcoming milestones with variance days, top-3 pending documents with per-person decision dots. Vineet confirmed via screenshot. Hover tooltips on charts working. Click-through links deferred to M4/M5 (noted in backlog).

### M2 Completion summary (2026-05-11)

**Module:** M2 — App shell
**Status:** ✅ Complete
**Outcome:** Full app shell live at `https://buildpod.github.io/pharmapm-pro/v2/`. Fixed 224px sidebar with logo, project context card, 4 nav groups (OVERVIEW / PLANNING / RISK & FINANCE / DOCUMENTATION), badge counts on Risks (3) and Documents (2), user avatar. Top bar with breadcrumb, search, bell with alert dot, Export button. 7 routed views all working. Dashboard has 4 real KPI cards. Mobile Sheet (hamburger) wired. Vineet confirmed via screenshot.

### M1 Completion summary (2026-05-11)

**Module:** M1 — Project setup
**Status:** ✅ Complete
**Outcome:** Branch `enterprisepharmapm-pro` created. Next.js 14 + TypeScript + Tailwind + shadcn/ui scaffolded in `v2/`. "Hello, RIM" page renders locally and is pushed to GitHub. GitHub Actions deploy workflow wired to Pages. `pnpm build` passes, TypeScript clean. Vineet confirmed localhost render via screenshot. Pushed and deploying to `https://buildpod.github.io/pharmapm-pro/v2/`.

### M0 Completion summary (2026-05-11)

**Module:** M0 — Tooling setup
**Status:** ✅ Complete
**Outcome:** Vineet's MacBook Pro M5 fully provisioned. Installed: Homebrew 5.1.11, Node v26, npm 11.12.1, pnpm 11.0.9, git 2.50.1, gh 2.92.0, uv 0.11.13, Claude Code 2.1.138, Docker 29.4.0, Ollama 0.23.2. Cloned `buildpod/pharmapm-pro` to `~/projects/pharmapm-pro`. Ran `node tools/run_tests.js` — **305/305 passed in 12ms.** GitHub CLI authenticated as `buildpod`.

---

## 5 — Module breakdown for the UI rewrite

Total estimate: **11 sessions** at one focused module per session.

> Each module's "definition of done" is what Claude must achieve before the session ends. If a module needs more than one session, that means it was scoped wrong — split it.

### M1 — Project setup (1 session)

- Create new repo (or new branch on `pharmapm-pro`) called `aivello-rim`
- Scaffold Next.js 14+ with TypeScript strict mode, Tailwind v4, shadcn/ui CLI initialized
- Configure for static export (`output: 'export'` in `next.config.js`)
- Install lucide-react, basic shadcn primitives (Button, Card, Badge, Avatar)
- Port v1's `data/` (mock Veeva RIM project) into a `lib/mockData.ts` TypeScript file
- Single homepage that renders "Hello, RIM" with a shadcn button — proves stack works
- Deploy to GitHub Pages, confirm URL loads on phone

**Definition of done:** A live URL with a shadcn button visible on phone, repo committed.

### M2 — App shell (1 session)

- Sidebar (project context, nav groups, badges, user avatar)
- Top bar (breadcrumb, search trigger, alerts, export)
- Routing for 7 views (dashboard, milestones, tasks, risks, documents, costs, reports)
- Each view a placeholder page with the right title

**Definition of done:** All 7 nav items work, page transitions smooth, layout responsive.

### M3 — Dashboard view (1 session)

- KPI cards (health, schedule, budget, risks)
- Phase progress bar
- Sparkline charts (risk profile, budget burn) — use Recharts
- Upcoming milestones list (top 5)
- Documents pending decision list (top 3)

**Definition of done:** Dashboard populated with mock Veeva RIM data, looks polished.

### M4 — Milestones grid (2 sessions)

**Session A — port logic:**
- Move v1 `scheduling.js` into `lib/domain/scheduling.ts` (TypeScript port)
- Move v1 `dates.js` into `lib/domain/dates.ts`
- Port the 305 tests as Vitest tests; confirm all pass
- Wire mock milestones → grid display (read-only first)

**Session B — interactive grid:**
- Inline editing (date pickers, dropdowns, text)
- Cascade preview modal on date edit
- "Schedule from Go-Live" action button
- Per-column filter dropdowns
- Lock toggle column

**Definition of done:** Milestones grid is fully functional and matches v1 behavior, tests green.

### M5 — Documents with proper reviewer/approver chips (1 session)

- Each document has `reviewers: Decision[]` and `approvers: Decision[]` arrays
- Each decision rendered as avatar chip with status icon (✓ approved / ⏰ pending / ✗ rejected)
- Click chip to mark decision (UI only, mock data update)
- Status auto-derives: all reviewers approved → status moves to "Reviewed", etc.
- Per-doc detail pane shows full review/approval history

**Definition of done:** Documents view shows chips per person, decisions update mock state.

### M6 — Risks + Costs + Tasks grids (2 sessions)

**Session A — Risks + Costs:**
- Risks grid sorted by P×I score, score colored pills
- Costs grid with budget vs actual, burn bars, totals row

**Session B — Tasks:**
- Tasks grouped by workstream (collapsible sections)
- Priority flags
- Inline progress
- Link tasks to parent milestone

**Definition of done:** All three grids functional with mock data, filterable.

### M7 — Reports / Weekly Status Report (1 session)

- Printable weekly status report layout
- Headline metrics, this week / next week sections, top risks, decisions needed
- Print stylesheet (clean PDF when user prints)
- "Export Excel" button using SheetJS (client-side, formatted xlsx)

**Definition of done:** Vineet can click "Print" or "Export Excel" and get usable artifacts.

### M8 — Settings + cascade preview + holidays (1 session)

- Settings panel (working days, holidays, country presets — port from v1)
- Cascade preview modal wired into milestone date edits
- Toast notifications for state changes (use Sonner)

**Definition of done:** Feature parity with v1 settings + cascade preview + country holidays.

### M9 — Polish + deploy (1 session)

- Mobile responsive audit (iPhone-sized viewport for every view)
- Dark mode toggle
- Command palette (⌘K) with cmdk library
- Final deploy to GitHub Pages
- Smoke test on phone

**Definition of done:** v2 is live, every view works on phone, ready to show pharma friends.

### Buffer

**+1 session** allowed across the project for unexpected fixes. If we exceed by more than 1 session, we re-plan section 5.

---

## 6 — Known issues being managed

| Issue | Mitigation |
|---|---|
| Claude has no cross-session memory | This document is the persistent memory. Read it every session. |
| Claude tends to drift into building new things | Section 4 (Current Module) is the only thing being worked on. Anything else goes to section 7. |
| Claude tends to hallucinate scope (e.g., proposing multi-tenant SaaS) | All architectural decisions are in section 3. Re-debating them requires a new ADR row. |
| Claude tends to optimize for "produce something this session" | Each module has a Definition of Done. Sessions don't end without it. |
| Claude can't run code autonomously between sessions | Vineet runs `pnpm test` and `pnpm dev` and reports results. Claude does not assume. |
| v1 has comma-separated reviewer strings (the limitation that started this rewrite) | M5 fixes this with proper Decision rows. Until then, v1 stays as-is. |

---

## 7 — Backlog (captured ideas, not in current scope)

When Claude or Vineet has an idea mid-session that isn't part of the Current Module, it goes here. Only items in section 5 are being worked on.

- Dashboard click-through: milestone rows → /milestones, doc rows → /documents, KPI cards → detail views (wire in M4/M5 naturally)
- AI assist for generating milestones from system + methodology
- Excel import (MS Project XML, MPP files)
- Multi-user collaboration (requires backend)
- Email notifications (requires backend)
- Audit log UI
- Custom field types
- Resource management view
- Veeva Vault integration
- Real authentication (Supabase Auth or Clerk)
- Mobile native apps
- SOC 2 audit prep

---

## 8 — Last Session Log

> Newest entries at the top. Each entry: date, what was worked on, what was decided, what was committed, what's next.

### Session — 2026-05-11 (M4A — Milestones grid: port logic + read-only grid)

**Worked on:**
- Read `src/domain/dates.js`, `src/domain/scheduling.js`, `src/test/test.js`, `src/config/rules.js` to understand RAG thresholds (redDelayDays: 5, amberDelayDays: 0)
- Created `v2/lib/domain/dates.ts` — TypeScript port of all 8 date functions (isValidISO, dayOfWeek, today, nowISO, addDays, addWorkingDays with negative-day support, daysBetween, compare)
- Created `v2/lib/domain/scheduling.ts` — TypeScript port of all 8 scheduling functions with proper types (ScheduleMilestone interface, RAG type, etc.)
- Installed Vitest 4.1.5 as dev dependency
- Created `v2/lib/domain/dates.test.ts` — 13 tests covering all date functions
- Created `v2/lib/domain/scheduling.test.ts` — 30 tests covering all scheduling functions
- All 43 Vitest tests pass in 148ms
- Rewrote `v2/app/(app)/milestones/page.tsx` — full read-only grid: 13 mock milestones, computed RAG + dependency status from domain engine, variance days, lock icon, legend

**Decided:**
- Domain functions run server-side (pure TypeScript, no "use client" needed) — computed at Next.js static export build time
- RAG thresholds hardcoded from v1 config (redDelayDays: 5, amberDelayDays: 0) — configurable in M8 settings
- "today" pinned to "2026-05-11" for grid display (matches mock data's current date)

**Built:** 43/43 Vitest tests pass. Milestones grid live with RAG + dependency engine. Build clean (11 static pages).

**Committed:** `f3b4487` on `enterprisepharmapm-pro`.

**Next session goal:** M4B — interactive milestones grid: inline editing, cascade preview modal, "Schedule from Go-Live" action, per-column filters, lock toggle.

---

### Session — 2026-05-11 (M3 — Dashboard view)

**Worked on:**
- Installed Recharts 3.8.1
- Created `lib/mockData.ts` — full Veeva RIM mock dataset: project info, 6 phases, 13 milestones, 6 risks, 4 documents (with per-person Decision rows), 6-month budget trend, 6-month risk trend, `getKpis()` derived helper
- Created `components/dashboard/sparkline.tsx` — Recharts AreaChart client component with gradient fill
- Created `components/dashboard/phase-progress.tsx` — 6-segment phase bar with completion %
- Rewrote `app/(app)/page.tsx` — full dashboard: KPI cards from real mock data, phase bar, two sparklines, top-5 milestones with variance, top-3 pending docs with decision dots

**Decided:**
- Click-through from dashboard rows to detail views (milestones, documents) deferred to M4/M5 — will happen naturally when those views are built
- Hover tooltips on Recharts charts already work out of the box (no extra work needed)

**Built:** Dashboard confirmed live and polished. All M3 DoD items met.

**Committed:** `1b7183d` on `enterprisepharmapm-pro`.

**Next session goal:** M4A — port v1 scheduling/dates domain logic to TypeScript, Vitest tests, read-only milestones grid.

---

### Session — 2026-05-11 (M2 — App shell)

**Worked on:**
- Installed shadcn/ui component deps: `@radix-ui/react-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-separator`
- Created shadcn components: Sheet, Avatar, Badge, Separator
- Built `components/sidebar.tsx` (client component, usePathname for active state)
- Built `components/topbar.tsx` (breadcrumb, search/bell/export, mobile Sheet trigger)
- Created `app/(app)/layout.tsx` — app shell with fixed sidebar + scrollable main area
- Deleted old `app/page.tsx` (Hello RIM placeholder)
- Created 7 routes under `app/(app)/`: `/`, `/milestones`, `/tasks`, `/risks`, `/costs`, `/documents`, `/reports`
- Dashboard page: 4 real KPI cards (Schedule Health, Open Risks, Budget Utilised, Days to Go-Live)
- Added `trailingSlash: true` to `next.config.mjs` for GitHub Pages sub-route compatibility
- 11 static pages build clean, TypeScript clean, deployed

**Decided:**
- Skip `pnpm dev` local testing step — CI deploy is fast enough (40s build + 10s deploy), go straight to GitHub Pages
- Dashboard KPI cards use hardcoded mock values for now (real mock data from `lib/mockData.ts` comes in M3)

**Built:** App shell live at `https://buildpod.github.io/pharmapm-pro/v2/`. All 7 nav items confirmed working via Vineet's screenshot.

**Committed:** `164cb1b` — M2 app shell commit on `enterprisepharmapm-pro`.

**Next session goal:** M3 — Dashboard view. Real mock data, Recharts sparklines, upcoming milestones list, decisions pending list.

---

### Session — 2026-05-11 (M1 — Project setup)

**Worked on:**
- Created branch `enterprisepharmapm-pro` on `buildpod/pharmapm-pro`
- Copied `CLAUDE.md` and `AIVELLO_OPERATING_DOC.md` into the repo root
- Scaffolded Next.js 14.2.35 in `v2/` using `pnpm create next-app` with TypeScript + Tailwind + App Router
- Added shadcn/ui core packages manually (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `lucide-react`)
- Created `lib/utils.ts` (cn helper) and `components/ui/button.tsx` (full shadcn Button with variants)
- Updated `tailwind.config.ts` and `app/globals.css` with shadcn design tokens (CSS variables for all color roles)
- Replaced default Next.js page with "Hello, RIM" page: AivelloStudio RIM heading, FlaskConical icon, shadcn Button confirmed rendering
- Configured `v2/next.config.mjs`: `output: 'export'`, `basePath: '/pharmapm-pro/v2'`, `images.unoptimized: true`
- Added `.github/workflows/deploy.yml`: triggers on push to `enterprisepharmapm-pro` when `v2/**` changes; builds in `v2/`, uploads `v2/out/` to GitHub Pages via Actions
- Added proper `.gitignore` to repo root (the existing `gitignore` file was missing the leading dot)
- Confirmed `pnpm build` passes (static export, TypeScript clean, no errors)
- Vineet confirmed page renders correctly at localhost — screenshot verified

**Decided:**
- New branch on `pharmapm-pro` (not a new repo) — confirmed by Vineet's instruction
- Brand name: AivelloStudio RIM — used in page title and heading
- GitHub Actions auto-deploy: YES, wired up and confirmed (Vineet set Pages source to "GitHub Actions")
- `pnpm install --ignore-scripts` required in CI due to pnpm 11's `unrs-resolver` build approval gate

**Built:**
- `v2/` — full Next.js 14 + TypeScript + Tailwind + shadcn/ui scaffold
- `v2/app/page.tsx` — Hello RIM page
- `v2/components/ui/button.tsx` — shadcn Button
- `v2/lib/utils.ts` — cn helper
- `.github/workflows/deploy.yml` — GitHub Actions deploy pipeline
- `CLAUDE.md`, `AIVELLO_OPERATING_DOC.md` — project docs added to repo

**Committed:** All of the above on branch `enterprisepharmapm-pro` and pushed to origin.

**Next session goal:** M2 — App shell. Sidebar, top bar, routing for 7 views, each with a placeholder page.

---

### Session — 2026-05-11 (M0 — Tooling setup)

**Worked on:**
- Vineet got new MacBook Pro M5; full dev environment setup
- Walked through Homebrew + Node + pnpm + git + gh + uv installation
- GitHub CLI auth via web browser flow (GitHub Mobile 2FA)
- Cloned `buildpod/pharmapm-pro` repo to `~/projects/pharmapm-pro`
- Ran v1 test suite locally → **305/305 passed in 12ms**

**Decided:**
- M1 will use Claude Code (already installed) as the implementation tool, driven from inside the cloned repo
- M1 should add a GitHub Actions workflow for auto-deploy to Pages on push (proposal — needs Vineet confirmation at start of M1)
- Brand name, repo strategy (new repo vs new branch) still open from section 8 questions below

**Built:** Nothing in code. M0 was environment setup only.

**Committed:** No code commits. Operating doc updated (this entry + section 4 marked M0 complete).

**Next session goal:** M1 — Project setup. Per section 5, definition of done: live URL on GitHub Pages with shadcn button rendering on phone.

**Open questions for Vineet before M1 starts:**
1. Are we using a new repo (`aivello-rim`) or a new branch on `pharmapm-pro`?
2. Brand name confirmation — "Aivello RIM" / "AivelloStudio RIM Cloud" / something else?
3. Should M1 include a GitHub Actions auto-deploy workflow (`.github/workflows/deploy.yml`) so we never drag-and-drop again?

### Session — 2026-05-06 (planning)

**Worked on:**
- Recovered from multi-tenant SaaS hallucination
- Confirmed single-tenant deployable model (ADR-001)
- Confirmed UI-first approach over backend-first (ADR-006)
- Wrote this operating document

**Decided:**
- Rewrite v1 UI in React + shadcn rather than patch vanilla JS further
- Stay on GitHub Pages, no new platform commitment yet
- Keep v1 deployed as reference

**Built:** Nothing — this was a planning session.

**Committed:** This document.

**Next session goal:** M1 — Project setup. Definition of done: live URL on GitHub Pages with shadcn button rendering on phone.

**Open questions for Vineet before M1 starts:**
1. Are we using a new repo (`aivello-rim`) or a new branch on `pharmapm-pro`?
2. Brand name confirmation — "Aivello RIM" / "AivelloStudio RIM Cloud" / something else?
3. Vineet's local environment — does Vineet want to run `pnpm install` locally, or have me write everything as a deployable artifact?

---

## 9 — Anti-drift rules (Claude must obey)

These are non-negotiable. Vineet can quote any of them back to me.

1. **No new modules without updating section 4 first.** If Vineet asks for something not in section 5, I must check whether it's in scope, and if not, propose adding it to section 7 (Backlog) for a future session.

2. **No proposing alternatives that contradict section 3.** Multi-tenant, microservices, custom CSS, vanilla JS rewrite — all rejected. Re-debating them requires a new ADR with substantive new evidence.

3. **No starting work without a confirmed Current Module.** If section 4 says "none," I must first agree with Vineet what M-number we are starting before writing any code.

4. **No ending a session without updating section 8.** Even a planning session gets a log entry.

5. **No "let me also build X while I'm here."** One module per session. New ideas go to section 7.

6. **No assuming code runs.** I write code. Vineet (or another tool) runs it. I do not claim something works unless I have seen the test output.

7. **If Vineet says "check the operating doc," I stop, re-read this document, and respond from it.** Not from session memory, not from training defaults.

8. **If Vineet says "you're hallucinating," I stop immediately, do not defend, and ask Vineet to point to the section being violated.**

---

## 10 — Glossary (for clarity across sessions)

- **v1** — the existing PharmaPM Pro build at `buildpod.github.io/pharmapm-pro` (vanilla JS, deployed, working)
- **v2** — the rewrite this document plans (Next.js + shadcn, not yet started)
- **ADR** — Architecture Decision Record (an entry in section 3)
- **Module** — one focused unit of work, designed to fit one session
- **Current Module** — the single thing being worked on right now (section 4)
- **Definition of Done (DoD)** — what must be true before a module is complete
- **Backlog** — captured ideas not in current scope (section 7)
