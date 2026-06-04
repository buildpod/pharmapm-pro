# Transparency Model — Architectural Specification

> **Status:** Spec phase, not implemented. Authored M28 (2026-05-21).
> **Sibling specs:** `AGENT_AS_RESOURCE.md` (M27, ✅), `CALENDAR_INTEGRATION.md` (M29, pending).
> **Pattern:** M20.4 — formalise data model + formulas + lifecycle + worked example BEFORE code.
> **Verification note:** EVM/ES formulas below are standard PM concepts (PMBOK §7, AACE RP, Earned Schedule). They were NOT in the NotebookLM source set; verify against PMBOK / AACE before implementation. Each formula carries its canonical name for cross-checking.

This document specifies how AivelloStudio RIM turns raw project data into the cost/schedule **truth** a CFO and CTO need: not "we're 12% over" but "we're 12% over *because* of X, and at this rate we'll finish at $Y, Z weeks late." Both this fork and the Codex fork currently compute only backward-looking tallies (total spent, burn %, RAG against hardcoded thresholds). This spec defines the predictive layer neither has.

---

## 1. Why this matters

### 1.1 The gap today

Current state (both forks): `burn% = actual / budget`, RAG against fixed thresholds, raw counts of blocked/overdue items. All **lagging indicators** — they tell you the budget already burned, after it's too late to act.

What leadership actually asks:
- **CFO:** "Will we finish on budget? If not, by how much, and *why*?"
- **CTO:** "Are we going to hit Go-Live? What's the earliest reliable signal we won't?"

Neither question is answerable from a burn %. Both require **EVM** (objective performance indices) + **forecasting** (project the endpoint) + **attribution** (decompose the variance into causes).

### 1.2 The differentiator

Confirmed via NotebookLM + Codex source review: neither fork has EVM. Asana/Monday/Smartsheet don't either (they're task trackers). MS Project / Primavera do, but heavyweight + on-prem. **A browser-light, EVM-correct, forecast-driven PM tool with variance attribution is genuinely differentiated** — especially with the AI-cost extension below.

### 1.3 The AI-cost tie-back (links to M27)

EVM applied to AI token consumption is novel and valuable: instead of flagging an agent "Red" *after* its budget burns, compute the agent-task's CPI in-flight and **forecast the overrun before it happens**. "Agent task T9 at 40% complete has consumed 70% of its token budget → CPI 0.57 → forecast final cost 1.75× budget → intervene now." No one does this. It's the FinOps-for-AI angle made concrete via 60-year-old EVM math.

---

## 2. Earned Value Management — the core formulas

### 2.1 The three primitives

Everything derives from three time-phased numbers, measured at a status date (today):

| Term | Canonical name | Definition | Our data source |
|---|---|---|---|
| **PV** | Planned Value (BCWS) | Budgeted cost of work *scheduled* by today | Time-phased baseline (NEW — we don't have this yet) |
| **EV** | Earned Value (BCWP) | Budgeted cost of work *actually completed* = BAC × %complete | task.progress × task budget (computable) |
| **AC** | Actual Cost (ACWP) | Actual cost incurred to date | cost-line actuals + AgentRun costs (computable) |
| **BAC** | Budget at Completion | Total project budget baseline | sum of cost-line budgets (computable) |

**The one thing we're missing: PV requires a time-phased baseline** — how much of the budget *should* be spent by each date. Today we have total budget (BAC) but not its distribution over time. §6 covers how we derive it.

### 2.2 Variance + performance indices

| Metric | Formula | Reads as |
|---|---|---|
| **CV** Cost Variance | `EV − AC` | >0 under budget, <0 over budget |
| **SV** Schedule Variance | `EV − PV` | >0 ahead, <0 behind |
| **CPI** Cost Performance Index | `EV / AC` | >1 efficient, <1 burning faster than earning |
| **SPI** Schedule Performance Index | `EV / PV` | >1 ahead, <1 behind |

CPI/SPI are the objective, normalised health signals that replace our hardcoded-threshold RAG.

### 2.3 Forecasting — Estimate at Completion (EAC)

Three EAC variants. **Which one to use is itself a judgement the tool should expose, not hide:**

| EAC variant | Formula | Assumption | When to use |
|---|---|---|---|
| **EAC₁ (variance is atypical)** | `AC + (BAC − EV)` | The overrun was a one-off; rest of project runs to plan | Early, or a known one-time cause |
| **EAC₂ (cost performance continues)** | `BAC / CPI` | Current cost efficiency persists to the end | Default for steady-state projects |
| **EAC₃ (cost + schedule drag continue)** | `AC + (BAC − EV) / (CPI × SPI)` | Both cost AND schedule pressure persist | Most conservative; late-stage troubled projects |

The product **shows all three as a range** (see §4 confidence framing) and defaults the headline to EAC₂, the PMBOK default.

### 2.4 The rest

| Metric | Formula | Reads as |
|---|---|---|
| **ETC** Estimate to Complete | `EAC − AC` | Funds still required |
| **VAC** Variance at Completion | `BAC − EAC` | Projected final over/under (>0 = under budget) |
| **TCPI** To-Complete Performance Index | `(BAC − EV) / (BAC − AC)` | The CPI the remaining work MUST achieve to still hit BAC. If TCPI > ~1.1 while CPI < 1, the budget is effectively unrecoverable — a hard CFO signal. |

---

## 3. Earned Schedule — fixing EVM's late-project blindness

Classic EVM's SV is in *dollars* and converges to $0 at project end even if you finish late (because EV → BAC and PV → BAC regardless of timing). So SV/SPI become useless in the final third — exactly when leadership most needs schedule truth.

**Earned Schedule (Lipke)** fixes this by measuring schedule variance in *time*:

| Term | Definition | Formula |
|---|---|---|
| **ES** Earned Schedule | The time at which the current EV *should* have been earned per the PV curve | interpolate: find the date where PV = current EV |
| **AT** Actual Time | Elapsed duration to status date | today − project start |
| **SV(t)** | Schedule variance in time | `ES − AT` (negative = behind, in time units) |
| **SPI(t)** | Schedule performance in time | `ES / AT` |

SV(t)/SPI(t) stay meaningful all the way to completion. For a Go-Live-date-driven pharma project, **SPI(t) is the metric that answers "will we hit Go-Live?"** better than classic SPI.

---

## 4. Variance attribution — the "why", not just the "how much"

A CFO seeing CV = −$120k asks "why?". Standard decomposition (price/quantity variance, the cost-accounting "bridge"):

```
Total cost variance  =  Rate variance  +  Volume/Usage variance  +  Scope variance

Rate variance    = (actual_rate − planned_rate) × actual_quantity
                   "we paid more per unit than planned"
Volume variance  = (actual_quantity − planned_quantity) × planned_rate
                   "we used more units than planned"
Scope variance   = cost of approved-change-request work not in the baseline
                   "we agreed to do more than originally scoped"
```

**Worked CFO example:**
> Configuration workstream is $120k over.
> - Rate: vendor day-rate rose €200→€260 → **+$48k** (rate)
> - Volume: 40 extra consultant-days vs plan → **+$52k** (volume)
> - Scope: CR-3 (add submission-type) approved → **+$20k** (scope)
> Total: **+$120k**, fully attributed. Each line drill-able to its source records.

This is the **"bridge" / waterfall** CFOs expect. It turns one scary number into three actionable, traceable causes — and **the Trace feature** (M31) links each to its source: rate→vendor contract, volume→timesheets/AgentRuns, scope→approved DecisionRecord/CR.

---

## 5. Anomaly detection — proactive flags (heuristics, no ML)

Statistical-process-control-style rules. Each is a concrete computable threshold, evaluated per status period. No machine learning — auditable, explainable, cheap.

| # | Rule | Threshold | Signal |
|---|---|---|---|
| A1 | Cost efficiency degrading | `CPI < 0.90` for 2 consecutive periods | Sustained overspend, not noise |
| A2 | Schedule slipping (time-based) | `SPI(t) < 0.90` | Behind in real time |
| A3 | Budget unrecoverable | `TCPI > 1.10` while `CPI < 1.0` | Remaining work can't realistically claw it back |
| A4 | Burn-rate spike | period burn > 1.5× trailing-4-period average | Sudden cost acceleration (incl. AI-token runaway) |
| A5 | Velocity collapse | tasks-closed-per-week drops > 30% week-over-week | Team stalling / blockers compounding |
| A6 | Risk outpacing mitigation | open-risk count growing faster than mitigated count over 3 periods | Risk posture deteriorating |
| A7 | Forecast breach | `EAC₂ > BAC × 1.10` | Projected final cost breaches 10% tolerance |
| A8 | AI-cost overrun (M27 tie-in) | agent-task token-CPI < 0.6 at >30% progress | Predict agent runaway before budget burns |

Surfaced as proactive dashboard alerts (amber/rose per §5.3 tone). Each links to the evidence (Trace).

---

## 6. What our entities have vs need

| EVM input | Have today? | Gap / how to fill |
|---|---|---|
| **BAC** | ✅ sum of cost-line budgets | none |
| **AC** | ✅ cost-line actuals + (M27) AgentRun costs | none |
| **EV** | ⚠️ partial | need per-task / per-cost-line budget so `EV = budget × progress`. Tasks have progress; need a budget weight per task or per workstream. |
| **PV (time-phased baseline)** | ❌ missing | **The core new requirement.** Derive from milestone planned dates + task due dates + linear or S-curve spread of each work item's budget across its planned window. Store as a `baselineCurve: { date, cumulativePV }[]` per project, snapshotted at baseline-approval. |
| **AT / status date** | ✅ today | none |
| **change-request scope deltas** | ⚠️ partial | DecisionRecord exists (M25); add `costImpact` field (decision-cost lineage, §7) |

**New entity needed: `CostBaseline`**

```ts
interface CostBaseline {
  id: string;
  projectId: string;
  approvedDate: string;
  bac: number;
  currency: string;
  // time-phased planned value curve
  curve: { date: string; cumulativePV: number }[];
  // per-work-item budget weights, for EV computation
  itemBudgets: { kind: "task" | "milestone" | "costLine"; id: string; budget: number }[];
  supersededByBaselineId?: string;  // re-baselining keeps history
}
```

EVM only works against a **frozen baseline**. Re-baselining (after an approved major CR) creates a new `CostBaseline` and supersedes the old — history preserved for audit.

---

## 7. Decision-cost lineage

Every material decision predicts a cost/schedule impact; later we measure the actual. Extends M25's `DecisionRecord`:

```ts
interface DecisionRecord {
  // existing M25 fields...
  predictedImpact?: {
    costDelta: number;        // + = adds cost, − = saves
    scheduleDeltaDays: number;
    currency: string;
    rationale: string;
  };
  actualImpact?: {            // backfilled after a measurement window
    costDelta: number;
    scheduleDeltaDays: number;
    measuredDate: string;
    method: string;           // how we attributed it
  };
}
```

**Worked example:**
> D3 (hybrid training delivery): predicted −$50k / +0 days. 60 days later, actual −$42k / +3 days. Lineage shows the decision delivered 84% of predicted savings at a small schedule cost. **This is how mature PMOs prove decision quality** — none of the mid-market tools track it.

Cost of Delay framing (Reinertsen): for decisions that defer work, `cost of delay = value-per-week × weeks-deferred` — captured in `predictedImpact.rationale` where relevant. Not a separate engine; a disciplined field.

---

## 8. UI surfaces (sketch only — no code)

- **Dashboard SteerCo Brief:** the "Confidence" number becomes EVM-grounded — derived from CPI × SPI(t) × forecast-breach, not a hand-set 95. Trend arrow (↓ from last period). EAC range shown as "Forecast: $1.95M–$2.15M (likely $2.02M)".
- **Costs page:** add EVM strip — CPI / SPI(t) / EAC range / VAC / TCPI. Variance waterfall (rate/volume/scope) below the budget rollup. Each bar drill-able.
- **New "Forecast" mini-page or Costs tab:** the three EAC variants side by side with their assumptions, so leadership sees the range and the reasoning.
- **Anomaly alerts:** dashboard banner, amber/rose, each with a "why + Trace" link.
- **Decisions page:** predicted-vs-actual impact column once actuals exist.

---

## 9. Non-goals (explicit)

- **ML / regression forecasting.** Heuristic EVM only. Auditable beats clever.
- **Monte Carlo schedule simulation.** Powerful but heavy; defer indefinitely unless a buyer demands it.
- **Resource-levelled re-planning.** Out of scope (separate from transparency).
- **Automatic re-baselining.** Re-baseline is a deliberate, approved, audited act — never automatic.
- **Replacing the cost-line ledger.** EVM reads from it; doesn't replace it.
- **Per-hour timesheet capture.** We work at cost-line + task-progress granularity, not individual time entries (that's a payroll system's job).

---

## 10. Punch list — implementation items

| ID | Severity | Item | Cost |
|---|---|---|---|
| **PT-1** | P0 | `CostBaseline` entity + store + repository + audit. Baseline-approval action snapshots BAC + PV curve + item budgets. | 1 module |
| **PT-2** | P0 | Per-task / per-workstream budget weights so EV is computable. | 0.5 module |
| **PT-3** | P0 | EVM core: compute PV/EV/AC/CV/SV/CPI/SPI/BAC against a baseline. Pure function + tests (verify formulas vs PMBOK). | 1 module |
| **PT-4** | P1 | Forecasting: EAC₁/₂/₃, ETC, VAC, TCPI. Range display. | 1 module |
| **PT-5** | P1 | Earned Schedule: ES, SV(t), SPI(t) via PV-curve interpolation. | 1 module |
| **PT-6** | P1 | Variance attribution: rate/volume/scope decomposition + waterfall data. | 1 module |
| **PT-7** | P2 | Anomaly rule engine (A1–A8). Per-period evaluation + dashboard alerts. | 1 module |
| **PT-8** | P2 | Decision-cost lineage: `predictedImpact` + `actualImpact` on DecisionRecord + UI. | 0.5 module |
| **PT-9** | P2 | Dashboard Confidence score re-grounded on EVM (replaces hand-set value). | 0.5 module |
| **PT-10** | P2 | Costs page EVM strip + variance waterfall UI. | 1 module |
| **PT-11** | P3 | AI-cost EVM (A8): per-agent-task token-CPI + overrun forecast. Ties to M27 AgentRun. | 1 module |
| **PT-12** | P3 | FX + confidence-range (P50/P80) framing on forecasts. | 0.5 module |

**Aggregate:** ~9–10 modules full; P0+P1 = a usable EVM MVP at ~5 modules. PT-1 → PT-3 is the minimum that makes everything else possible.

---

## 11. Open design questions (need Vineet's call before implementation)

1. **PV curve shape** — linear spread of each item's budget across its window, or S-curve (front/back-loaded)? Linear is simpler + defensible; S-curve is more realistic for implementation projects. Recommendation: linear v1, S-curve option later.
2. **Budget granularity for EV** — per-task budgets (precise, lots of data entry) or per-workstream budgets spread by task count/progress (coarser, far less entry)? Recommendation: per-workstream v1; per-task opt-in.
3. **Default EAC variant for the headline** — PMBOK default is EAC₂ (BAC/CPI). Confirm, or prefer the conservative EAC₃ for pharma's risk-averse culture?
4. **Confidence score formula** — exact weighting of CPI / SPI(t) / forecast-breach into the 0–100 SteerCo number. Needs a defined, documented formula (not a black box). Draft in PT-9.
5. **Re-baseline trigger policy** — what threshold of approved scope change warrants a new `CostBaseline`? Recommendation: manual + audited only; no auto-trigger.

These don't block the spec; they block PT-1 onward.

---

**Last updated:** 2026-05-21 (spec authored, no implementation).
**Next:** Vineet reviews + answers §11. Then M29 = `CALENDAR_INTEGRATION.md` (final spec). After all three locked, implementation begins — likely interleaving PA-* (agents) and PT-* (transparency) since they converge on the Costs page + AI-cost forecasting (A8/PT-11 depends on M27's AgentRun).
