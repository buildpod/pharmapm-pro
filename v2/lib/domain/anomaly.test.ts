// M31 — Anomaly engine test matrix (PT-7).
// Each rule fires on its threshold and stays quiet below it. Multi-period
// rules (A1/A4/A5/A6) tested with history. AI-cost A8 tested with agentTask.

import { describe, it, expect } from "vitest";
import { detectAnomalies, type AnomalyInput, type PeriodMetrics } from "./anomaly";
import type { EvmSnapshot } from "./evm";

// Minimal snapshot factory — only the fields the rules read matter.
function snap(over: Partial<EvmSnapshot> = {}): EvmSnapshot {
  return {
    bac: 120_000, pv: 60_000, ev: 60_000, ac: 60_000,
    cv: 0, sv: 0, cpi: 1, spi: 1,
    eac1: 120_000, eac2: 120_000, eac3: 120_000, eacHeadline: 120_000,
    etc: 60_000, vac: 0, tcpi: 1,
    es: 90, at: 90, svt: 0, spit: 1,
    percentComplete: 0.5, percentSpent: 0.5,
    ...over,
  };
}

function period(over: Partial<PeriodMetrics> = {}): PeriodMetrics {
  return { cpi: 1, spit: 1, periodBurn: 10_000, tasksClosed: 10, openRisks: 5, mitigatedRisks: 5, ...over };
}

function input(over: Partial<AnomalyInput> = {}): AnomalyInput {
  return { snapshot: snap(), current: period(), history: [], ...over };
}

function rules(flags: { rule: string }[]): string[] { return flags.map((f) => f.rule).sort(); }

describe("M31 anomaly — clean project fires nothing", () => {
  it("on-plan snapshot + steady history → no flags", () => {
    const flags = detectAnomalies(input({
      history: [period(), period(), period(), period()],
    }));
    expect(flags).toEqual([]);
  });
});

describe("M31 anomaly — A1 CPI degraded 2 periods", () => {
  it("fires when current AND prior CPI < 0.90", () => {
    const flags = detectAnomalies(input({
      snapshot: snap({ cpi: 0.85 }),
      history: [period({ cpi: 0.88 })],
    }));
    expect(rules(flags)).toContain("A1");
  });
  it("quiet when only the current period is low (one-off)", () => {
    const flags = detectAnomalies(input({
      snapshot: snap({ cpi: 0.85 }),
      history: [period({ cpi: 0.98 })],
    }));
    expect(rules(flags)).not.toContain("A1");
  });
});

describe("M31 anomaly — A2 SPI(t) behind", () => {
  it("fires below 0.90", () => {
    expect(rules(detectAnomalies(input({ snapshot: snap({ spit: 0.8 }) })))).toContain("A2");
  });
  it("quiet at/above 0.90", () => {
    expect(rules(detectAnomalies(input({ snapshot: snap({ spit: 0.95 }) })))).not.toContain("A2");
  });
});

describe("M31 anomaly — A3 unrecoverable budget", () => {
  it("fires when TCPI > 1.10 AND CPI < 1", () => {
    const flags = detectAnomalies(input({ snapshot: snap({ tcpi: 1.33, cpi: 0.8 }) }));
    expect(rules(flags)).toContain("A3");
  });
  it("quiet when TCPI high but CPI healthy (recoverable)", () => {
    const flags = detectAnomalies(input({ snapshot: snap({ tcpi: 1.2, cpi: 1.05 }) }));
    expect(rules(flags)).not.toContain("A3");
  });
});

describe("M31 anomaly — A4 burn spike", () => {
  it("fires when current burn > 1.5× trailing-4 average", () => {
    const flags = detectAnomalies(input({
      current: period({ periodBurn: 30_000 }),
      history: [period({ periodBurn: 10_000 }), period({ periodBurn: 10_000 }),
                period({ periodBurn: 10_000 }), period({ periodBurn: 10_000 })],
    }));
    expect(rules(flags)).toContain("A4"); // 30k vs 10k avg = 3×
  });
  it("quiet when burn is in line with the average", () => {
    const flags = detectAnomalies(input({
      current: period({ periodBurn: 11_000 }),
      history: [period({ periodBurn: 10_000 }), period({ periodBurn: 10_000 })],
    }));
    expect(rules(flags)).not.toContain("A4");
  });
});

describe("M31 anomaly — A5 velocity collapse", () => {
  it("fires when tasks-closed drops > 30% vs last period", () => {
    const flags = detectAnomalies(input({
      current: period({ tasksClosed: 6 }),       // from 10 → 6 = 40% drop
      history: [period({ tasksClosed: 10 })],
    }));
    expect(rules(flags)).toContain("A5");
  });
  it("quiet on a small dip", () => {
    const flags = detectAnomalies(input({
      current: period({ tasksClosed: 9 }),        // 10% drop
      history: [period({ tasksClosed: 10 })],
    }));
    expect(rules(flags)).not.toContain("A5");
  });
});

describe("M31 anomaly — A6 risk posture", () => {
  it("fires when open risks outgrow mitigation over 3 periods", () => {
    const flags = detectAnomalies(input({
      current: period({ openRisks: 12, mitigatedRisks: 5 }),
      history: [period({ openRisks: 6, mitigatedRisks: 4 }), period({ openRisks: 9, mitigatedRisks: 4 })],
    }));
    // open +6 (6→12), mitigated +1 (4→5) → open outruns mitigation
    expect(rules(flags)).toContain("A6");
  });
  it("quiet when mitigation keeps pace", () => {
    const flags = detectAnomalies(input({
      current: period({ openRisks: 8, mitigatedRisks: 8 }),
      history: [period({ openRisks: 6, mitigatedRisks: 4 }), period({ openRisks: 7, mitigatedRisks: 6 })],
    }));
    expect(rules(flags)).not.toContain("A6");
  });
});

describe("M31 anomaly — A7 forecast breach", () => {
  it("fires when EAC₂ > BAC × 1.10", () => {
    const flags = detectAnomalies(input({ snapshot: snap({ bac: 120_000, eac2: 140_000 }) }));
    expect(rules(flags)).toContain("A7");
  });
  it("quiet within 10% tolerance", () => {
    const flags = detectAnomalies(input({ snapshot: snap({ bac: 120_000, eac2: 125_000 }) }));
    expect(rules(flags)).not.toContain("A7");
  });
});

describe("M31 anomaly — A8 AI-cost runaway", () => {
  it("fires when token-CPI < 0.6 at >30% progress", () => {
    const flags = detectAnomalies(input({
      agentTask: { tokenCpi: 0.5, progress: 0.4, taskId: "t9", taskName: "Migration mapping" },
    }));
    expect(rules(flags)).toContain("A8");
  });
  it("quiet early in the task (<30% progress) even if efficiency is low", () => {
    const flags = detectAnomalies(input({
      agentTask: { tokenCpi: 0.5, progress: 0.2, taskId: "t9" },
    }));
    expect(rules(flags)).not.toContain("A8");
  });
  it("not evaluated when no agentTask provided", () => {
    const flags = detectAnomalies(input());
    expect(rules(flags)).not.toContain("A8");
  });
});

describe("M31 anomaly — multiple rules compound", () => {
  it("a troubled project trips several flags at once", () => {
    const flags = detectAnomalies(input({
      snapshot: snap({ cpi: 0.8, spit: 0.85, tcpi: 1.33, bac: 120_000, eac2: 150_000 }),
      current: period({ periodBurn: 40_000, tasksClosed: 4 }),
      history: [period({ cpi: 0.85, periodBurn: 10_000, tasksClosed: 10 })],
    }));
    const r = rules(flags);
    expect(r).toContain("A1"); // cpi 2-period
    expect(r).toContain("A2"); // spi(t)
    expect(r).toContain("A3"); // unrecoverable
    expect(r).toContain("A4"); // burn spike
    expect(r).toContain("A5"); // velocity
    expect(r).toContain("A7"); // forecast breach
    expect(flags.length).toBeGreaterThanOrEqual(6);
  });
});
