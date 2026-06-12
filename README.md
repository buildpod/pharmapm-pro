> [!IMPORTANT]
> **This repository is archived as reference (June 2026).** Active development of the
> AivelloStudio product moved to
> [pharmapm-command-center](https://github.com/buildpod/pharmapm-command-center),
> which absorbed this repo's v2 line — the EVM/Earned-Schedule engines, the
> Decisions/Issues registers, the design discipline, and the project skills.
> What stays here: the **v1 reference app** (deployed and working, 305 tests —
> see below) and the full module history (`AIVELLO_OPERATING_DOC.md`, M0–M33).
> Do not build new features here.

# PharmaPM Pro — Multi-File Hardened Backbone

This is the v1.1 hardened architecture backbone, physically split into module files.
No build step. No npm install. No bundler. Just open `index.html` and run.

## Status

- **Phase 1 (hardening):** ✅ Complete.
- **Physical file split:** ✅ Complete.
- **Section 2 — B1 (shell + welcome + banners):** ✅ Built.
- **Section 2 — B2 (4-step wizard):** ✅ Built.
- **Section 2 — B3a (5 grid views + detail pane):** ✅ Built.
- **UI architecture correction pass:** ✅ Complete. UI strictly consumes services + schema; no direct domain or adapter calls. Enforced by automated source scan in test runner.
- **Section 2 — B3b (Dashboard + SteerCo report):** ⬜ Next.
- **Section 3 (backend, auth, multi-tenant, audit emission, connectors):** ⬜ Deferred per ADR pack — only when commercial signal exists.

## How to run

### Option A (recommended) — local web server

Some browsers restrict `file://` access for sub-script loading. Easiest fix:

```bash
# from the pharmapm-pro/ folder
python3 -m http.server 8000
# then open http://localhost:8000/ in your browser
```

Or use any other static server (`npx serve`, `php -S localhost:8000`, etc).

### Option B — directly open `index.html`

Works in some browsers (Firefox does, recent Chrome may not without flags). If you see "PPM is not defined" in the console, switch to Option A.

### Verifying it works

1. Click **Run all tests** — expect `128/128 passed` in green.
2. Click **Inspect public APIs** — see frozen surface across all layers.
3. Click **Inspect schema v1** — see entity definitions and v1.1 default state shape.
4. Click **Inspect config rules** — see tunable thresholds and rule tables.
5. Click **Build sample project** — load demo project; observe computed health, KPIs, badges.

## File structure

```
pharmapm-pro/
├── index.html                          ← boot only; loads scripts in dep order
├── README.md                           ← you are here
├── src/
│   ├── ppm.js                          ← window.PPM = {} (must load first)
│   ├── config/
│   │   └── rules.js                    ← PPM.config — RAG/risk/burn thresholds, methodology templates, doc rules
│   ├── schema/
│   │   ├── schema.js                   ← PPM.schema — entity definitions, defaultState, newProjectId
│   │   └── migrations.js               ← PPM.migrations — schema version migrations
│   ├── domain/                         ← PURE FUNCTIONS ONLY. No DOM, no storage, no services.
│   │   ├── dates.js                    ← ISO-8601 date math (replaces native Date in domain)
│   │   ├── scheduling.js               ← topo sort, cascade, RAG
│   │   ├── risk.js                     ← P×I score, score band, count critical
│   │   ├── budget.js                   ← burn %, burn band, cost totals
│   │   ├── documents.js                ← generateDocList from characteristics
│   │   ├── milestones.js               ← generateFromMethodology
│   │   ├── health.js                   ← computeProjectHealth, computeBadges
│   │   └── validation.js               ← validateState, validateWizardStep1, validateField
│   ├── adapters/                       ← I/O ONLY. Implements domain interfaces. Swappable.
│   │   ├── storage.js                  ← localStorage (v1); REST in v2
│   │   ├── exporter.js                 ← JSON/CSV import/export
│   │   └── printer.js                  ← window.print
│   ├── services/                       ← USE CASE ORCHESTRATION. No DOM. Reads adapters via interface.
│   │   ├── events.js                   ← PPM.events pub/sub bus
│   │   ├── projectService.js           ← create/load/import/demo/reset/exportToFile
│   │   ├── editService.js              ← cell edits + cascade trigger + autosave + immutability guards
│   │   ├── lifecycleService.js         ← only allowed path for lifecycle mutation
│   │   ├── commentService.js           ← comments CRUD per row
│   │   ├── reportService.js            ← buildDashboardData, buildSteerCoData
│   │   └── viewService.js              ← UI-facing read-only synthesis (enrichRow, badges, previews)
│   ├── ui/
│   │   ├── icons.js                    ← inline SVG icon system
│   │   ├── toast.js                    ← bottom toast notifications
│   │   ├── router.js                   ← currentView state + ui:view_changed events
│   │   ├── banner.js                   ← DEMO banner + storage quota banner
│   │   ├── welcome.js                  ← first-run welcome screen
│   │   ├── wizard.js                   ← 4-step project creation wizard
│   │   ├── columns.js                  ← column definitions per table
│   │   ├── grid.js                     ← editable grid with sort/filter/click-to-edit
│   │   ├── detail.js                   ← context-sensitive detail pane
│   │   ├── shell.js                    ← top bar, sidebar, context bar, status bar
│   │   ├── boot.js                     ← page-load decision (welcome vs shell)
│   │   └── verification.js             ← buttons on the verification page (dev-only)
│   └── test/
│       └── test.js                     ← PPM.test.runAll() — 128 assertions
```

## Dependency rules (enforced by tests, not just documented)

| From layer | May import | May NOT import |
|---|---|---|
| domain | `PPM.domain.*` (siblings), `PPM.config` | UI, services, adapters, DOM, native Date, localStorage |
| schema | nothing | anything |
| config | nothing | anything |
| adapters | domain (interface only) | UI, services |
| services | domain, adapters, schema, events | UI, DOM |
| ui | services (public API), schema (read-only) | domain (direct), adapters (direct), localStorage |
| migrations | schema | anything else |

The test harness verifies these at runtime:
- Domain source code grep-checked for forbidden references (`PPM.ui`, `PPM.services`, `PPM.adapters`, `localStorage`, `document.`, `new Date(`).
- Public APIs frozen with `Object.freeze()` — runtime tests verify methods cannot be overwritten.

## Headless test runner (for development)

A Node-based test runner is included for verifying logic changes without opening a browser. Useful when working with Claude during development — Claude runs this before claiming any backend change is complete.

```bash
node tools/run_tests.js              # quick run (failed tests only)
node tools/run_tests.js --verbose    # show all 128 passing tests too
```

**Exit codes:** 0 = all green, 1 = at least one failure, 2 = could not load a module.

**What this DOES test:** all domain logic, schema, migrations, adapters, services, UI architecture compliance (filesystem scan), plus regression tests for the correction-pass bugs. ~187 assertions.

**What this does NOT test:** UI rendering, click handlers, CSS, mobile responsive behavior, real localStorage quota. Those still require opening `index.html` in a browser.

**Requires:** Node 19+ (for `crypto.randomUUID`). Node 22 tested.

## How to add new code

### Adding a new domain function

1. Find the right module (e.g. `src/domain/risk.js`).
2. Add the function inside the IIFE.
3. Add it to the frozen public API at the bottom of the file.
4. Add a unit test in `src/test/test.js`.
5. If the function needs config values, read from `PPM.config.rules.*`. Do NOT hardcode.

### Adding a new service

1. Create `src/services/yourService.js`.
2. Use the IIFE pattern with header comment listing dependencies.
3. Attach to `PPM.services.yourService` and freeze with `Object.freeze()`.
4. Emit events via `PPM.events.emit(...)` for any state changes.
5. Add `<script src="src/services/yourService.js"></script>` to `index.html` AFTER the services it depends on.
6. Add tests.

### Bumping the schema (e.g. v1.1 → v1.2)

1. Update `PPM.schema.CURRENT_VERSION` in `src/schema/schema.js`.
2. Update the schema definition (`stateV1`).
3. Update `defaultState()` to return the new version.
4. Add a migration `'1.1->1.2'` in `src/schema/migrations.js` that transforms old state to new.
5. Update tests for the new version assertions.

## Public API surface (what UI may call)

The UI layer **must** consume only `PPM.services.*`, `PPM.schema` (read-only), `PPM.config.rules` (read-only), and `PPM.events`. It must **never** call `PPM.domain.*` or `PPM.adapters.*` directly. This is enforced by automated source scan in the test runner; CI fails if any UI file regresses.

```javascript
// ----- Services UI may use -----

// Project lifecycle and I/O (wraps adapters internally)
PPM.services.projectService.getState()
PPM.services.projectService.create(wizardAnswers)
PPM.services.projectService.loadFromStorage()
PPM.services.projectService.importFromJSON(text)
PPM.services.projectService.loadDemo()
PPM.services.projectService.reset()
PPM.services.projectService.exportToFile()      // wraps exporter; returns {ok, filename?, error?}

// Mutations
PPM.services.editService.applyCellEdit(table, id, field, value)
PPM.services.editService.addRow(table, defaults)
PPM.services.editService.deleteRow(table, id)
PPM.services.editService.forceSave()
PPM.services.lifecycleService.transition(targetLifecycle)
PPM.services.commentService.add(table, id, text, author)
PPM.services.commentService.remove(table, id, index)

// Reads
PPM.services.commentService.list(table, id)
PPM.services.commentService.count(table, id)

// Read-only synthesis (replaces direct domain calls from UI)
PPM.services.viewService.enrichRow(table, row)         // returns row + computed fields
PPM.services.viewService.enrichRows(table, rows)
PPM.services.viewService.computeProjectHealth(state)
PPM.services.viewService.computeBadges(state)
PPM.services.viewService.previewMilestones(methodology, startDate)
PPM.services.viewService.previewDocuments(characteristics)
PPM.services.viewService.listMethodologies()
PPM.services.viewService.today()
PPM.services.viewService.addWorkingDays(date, n)
PPM.services.viewService.daysBetween(from, to)
PPM.services.viewService.validateWizardStep1(answers)

// Reports
PPM.services.reportService.buildDashboardData(state)
PPM.services.reportService.buildSteerCoData(state)

// ----- Schema (read-only) -----
PPM.schema.entities
PPM.schema.CURRENT_VERSION
PPM.schema.defaultState()
PPM.schema.newProjectId()
PPM.schema.v1                                     // shape definition incl. enum allowed lists

// ----- Config (read-only) -----
PPM.config.rules.*                                 // RAG/risk/burn thresholds, methodology templates

// ----- Events -----
PPM.events.on(eventName, handler)
PPM.events.off(eventName, handler)
```

UI **must NOT**:
- Call `PPM.domain.*` directly (use `viewService` instead)
- Call `PPM.adapters.*` directly (use `projectService.exportToFile`, `importFromJSON`, etc.)
- Touch `localStorage` directly (always go through services)
- Mutate `state.*` directly (use editService / lifecycleService / commentService)
- Read or write top-level immutable fields (`projectId`, `createdAt`, `schemaVersion`, `isDemo`, `lifecycle`)
- Bypass schema validation

## Documentation

- `PROD-002B_UserJourney_IA_v2.0.md` — UX and IA spec
- `PROD-002B_ADR_Pack_v1.0.md` — 8 architecture decisions for v2 enterprise
- `PROD-002B_Implementation_Reconciliation_v1.0.md` — current status, schema spec, build sequence
