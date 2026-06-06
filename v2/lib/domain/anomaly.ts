// Anomaly detection — pure heuristic rule engine (PT-7).
//
// The 8 rules from v2/docs/TRANSPARENCY_MODEL.md §5. Statistical-process-
// control style: each rule is a concrete computable threshold, NO machine
// learning — auditable, explainable, cheap. Evaluated per status period over
// an EvmSnapshot plus optional history (prior periods, oldest→newest).
//
// Pure: no side effects, no store/UI imports. Returns AnomalyFlag[].

import type { EvmSnapshot } from "./evm";

// ─── Period history ─────────────────────────────────────────────────────────

// A lightweight per-period record so multi-period rules (A1/A4/A5/A6) can look
// back. The current period is passed as `snapshot`; `history` holds prior
// periods oldest→newest (excluding current).
export interface PeriodMetrics {
  cpi: number;
  spit: number;
  periodBurn: number;        // cost incurred in that period (not cumulative)
  tasksClosed: number;       // tasks completed in that period
  openRisks: number;         // open-risk count at period end
  mitigatedRisks: number;    // mitigated-risk count at period end
}

export interface AnomalyInput {
  snapshot: EvmSnapshot;
  current: PeriodMetrics;        // current-period non-EVM metrics
  history: PeriodMetrics[];      // prior periods, oldest → newest
  // AI-cost (A8) — optional; only evaluated when provided
  agentTask?: { tokenCpi: number; progress: number; taskId: string; taskName?: string };
}

export type AnomalySeverity = "warn" | "risk";

export interface AnomalyFlag {
  rule: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";
  severity: AnomalySeverity;
  title: string;
  message: string;          // plain-language, what + why + what-to-check
  value: number;            // the computed figure that tripped the rule
}

// ─── Thresholds (named, from spec §5) ───────────────────────────────────────

const T = {
  cpiDegraded: 0.90,        // A1
  spitBehind: 0.90,         // A2
  tcpiUnrecoverable: 1.10,  // A3 (with CPI < 1)
  burnSpikeMultiple: 1.5,   // A4 vs trailing-4 avg
  velocityDropPct: 0.30,    // A5 week-over-week
  forecastBreachMultiple: 1.10, // A7 EAC vs BAC
  tokenCpiRunaway: 0.6,     // A8
  tokenProgressMin: 0.30,   // A8
} as const;

// ─── The engine ───────────────────────────────────────────────────────────────

export function detectAnomalies(input: AnomalyInput): AnomalyFlag[] {
  const { snapshot: s, current, history, agentTask } = input;
  const flags: AnomalyFlag[] = [];

  // A1 — CPI < 0.90 for 2 consecutive periods (current + most-recent prior)
  if (s.cpi < T.cpiDegraded) {
    const prev = history[history.length - 1];
    if (prev && prev.cpi < T.cpiDegraded) {
      flags.push({
        rule: "A1", severity: "risk",
        title: "Cost efficiency degrading",
        message: `CPI has been below ${T.cpiDegraded} for two periods (now ${s.cpi.toFixed(2)}). Sustained overspend, not noise — review the cost lines driving it.`,
        value: s.cpi,
      });
    }
  }

  // A2 — SPI(t) < 0.90 (behind in real time)
  if (s.spit < T.spitBehind) {
    flags.push({
      rule: "A2", severity: "warn",
      title: "Schedule slipping",
      message: `SPI(t) is ${s.spit.toFixed(2)} — the project is behind in real time. Check the critical-path tasks.`,
      value: s.spit,
    });
  }

  // A3 — TCPI > 1.10 while CPI < 1.0 (budget effectively unrecoverable)
  if (s.tcpi > T.tcpiUnrecoverable && s.cpi < 1.0) {
    flags.push({
      rule: "A3", severity: "risk",
      title: "Budget likely unrecoverable",
      message: `Remaining work must run at ${s.tcpi.toFixed(2)} efficiency to still hit budget, but current efficiency is ${s.cpi.toFixed(2)}. The budget can't realistically be clawed back — escalate or re-baseline.`,
      value: s.tcpi,
    });
  }

  // A4 — current-period burn > 1.5× trailing-4-period average
  const trailing = history.slice(-4);
  if (trailing.length >= 1) {
    const avg = trailing.reduce((sum, p) => sum + p.periodBurn, 0) / trailing.length;
    if (avg > 0 && current.periodBurn > T.burnSpikeMultiple * avg) {
      flags.push({
        rule: "A4", severity: "warn",
        title: "Spend accelerating",
        message: `This period's spend (${current.periodBurn.toFixed(0)}) is ${(current.periodBurn / avg).toFixed(1)}× the recent average. Sudden cost acceleration — check for an unplanned cost (incl. AI-token usage).`,
        value: current.periodBurn / avg,
      });
    }
  }

  // A5 — tasks-closed drops > 30% vs the most-recent prior period
  const prevPeriod = history[history.length - 1];
  if (prevPeriod && prevPeriod.tasksClosed > 0) {
    const drop = (prevPeriod.tasksClosed - current.tasksClosed) / prevPeriod.tasksClosed;
    if (drop > T.velocityDropPct) {
      flags.push({
        rule: "A5", severity: "warn",
        title: "Delivery velocity dropping",
        message: `Tasks completed fell ${(drop * 100).toFixed(0)}% versus last period (${prevPeriod.tasksClosed} → ${current.tasksClosed}). The team may be stalling or blockers are compounding.`,
        value: drop,
      });
    }
  }

  // A6 — open-risk count growing faster than mitigated over 3 periods
  const window = [...history.slice(-2), current]; // last 3 incl current
  if (window.length === 3) {
    const openGrowth = window[2].openRisks - window[0].openRisks;
    const mitigatedGrowth = window[2].mitigatedRisks - window[0].mitigatedRisks;
    if (openGrowth > 0 && openGrowth > mitigatedGrowth) {
      flags.push({
        rule: "A6", severity: "warn",
        title: "Risk posture deteriorating",
        message: `Open risks grew by ${openGrowth} over three periods while mitigation only kept pace at ${mitigatedGrowth}. Risks are outrunning mitigation.`,
        value: openGrowth - mitigatedGrowth,
      });
    }
  }

  // A7 — forecast (EAC₂) breaches BAC by >10%
  if (s.eac2 > s.bac * T.forecastBreachMultiple) {
    const overPct = ((s.eac2 / s.bac) - 1) * 100;
    flags.push({
      rule: "A7", severity: "risk",
      title: "Forecast over budget",
      message: `Projected final cost (${s.eac2.toFixed(0)}) breaches budget (${s.bac.toFixed(0)}) by ${overPct.toFixed(0)}%. Acts now while there's runway to correct.`,
      value: s.eac2 / s.bac,
    });
  }

  // A8 — AI-cost runaway: token-CPI < 0.6 at >30% progress (predict before burn)
  if (agentTask && agentTask.progress > T.tokenProgressMin && agentTask.tokenCpi < T.tokenCpiRunaway) {
    flags.push({
      rule: "A8", severity: "risk",
      title: "AI task on track to overrun its budget",
      message: `${agentTask.taskName ?? agentTask.taskId.toUpperCase()} is ${(agentTask.progress * 100).toFixed(0)}% done but its token efficiency is ${agentTask.tokenCpi.toFixed(2)} — it will likely blow its compute budget. Intervene before it burns through.`,
      value: agentTask.tokenCpi,
    });
  }

  return flags;
}
