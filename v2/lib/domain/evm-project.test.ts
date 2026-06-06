// M32 — Project EVM adapter + confidence test matrix (PT-1 derivation + PT-9).

import { describe, it, expect } from "vitest";
import {
  deriveEvmInput, confidenceScore, executiveVerdict, computeProjectEvm,
  type DeriveInput,
} from "./evm-project";
import { computeEvm } from "./evm";

const BASE: DeriveInput = {
  costLines: [
    { budgetK: 600, actualK: 300 },
    { budgetK: 400, actualK: 200 },
  ], // BAC 1,000k = $1.0M, AC 500k = $0.5M
  plannedCurve: [
    { month: "Jan", planned: 200 },
    { month: "Feb", planned: 400 },
    { month: "Mar", planned: 600 },
    { month: "Apr", planned: 800 },
    { month: "May", planned: 1000 },
  ],
  tasks: [{ progress: 50 }, { progress: 50 }], // avg 50% → EV = 50% of BAC
  projectStart: "2026-01-01",
  statusDate: "2026-03-01",  // PV should = 600k
  curveYear: 2026,
};

describe("M32 evm-project.deriveEvmInput", () => {
  it("BAC and AC scale $k → $ from cost lines", () => {
    const inp = deriveEvmInput(BASE);
    expect(inp.bac).toBe(1_000_000);
    expect(inp.actualCost).toBe(500_000);
  });
  it("PV curve anchors months to the curve year + leading zero point", () => {
    const inp = deriveEvmInput(BASE);
    expect(inp.curve[0]).toEqual({ date: "2026-01-01", cumulativePV: 0 });
    expect(inp.curve).toContainEqual({ date: "2026-03-01", cumulativePV: 600_000 });
  });
  it("EV = BAC × average task progress", () => {
    const inp = deriveEvmInput(BASE);
    // single synthetic item carrying BAC at avg progress 0.5
    expect(inp.items).toHaveLength(1);
    expect(inp.items[0].budget).toBe(1_000_000);
    expect(inp.items[0].progress).toBeCloseTo(0.5, 5);
  });
  it("no tasks → 0 progress (no NaN)", () => {
    const inp = deriveEvmInput({ ...BASE, tasks: [] });
    expect(inp.items[0].progress).toBe(0);
  });
});

describe("M32 evm-project — computed snapshot on derived input", () => {
  it("on-plan-ish: EV 500k, PV 600k, AC 500k → CPI 1, SPI 0.83", () => {
    const snap = computeEvm(deriveEvmInput(BASE));
    expect(snap.ev).toBe(500_000);
    expect(snap.pv).toBe(600_000);
    expect(snap.cpi).toBeCloseTo(1, 5);      // 500k/500k
    expect(snap.spi).toBeCloseTo(0.833, 2);  // 500k/600k
  });
});

describe("M32 evm-project.confidenceScore", () => {
  it("perfect project (CPI 1, SPI(t) 1, on budget) → 100", () => {
    const snap = computeEvm({
      bac: 100, actualCost: 50,
      curve: [{ date: "2026-01-01", cumulativePV: 0 }, { date: "2026-02-01", cumulativePV: 100 }],
      items: [{ id: "x", budget: 100, progress: 0.5 }],
      statusDate: "2026-01-16", projectStart: "2026-01-01",
    });
    // EV 50, PV ~50, AC 50 → CPI 1, SPI(t) ~1, no breach
    expect(confidenceScore(snap)).toBeGreaterThanOrEqual(95);
  });
  it("troubled project (CPI 0.8, behind, over forecast) → low score", () => {
    const snap = computeEvm({
      bac: 120_000, actualCost: 75_000,
      curve: [
        { date: "2026-01-01", cumulativePV: 0 },
        { date: "2026-05-01", cumulativePV: 80_000 },
        { date: "2026-07-01", cumulativePV: 120_000 },
      ],
      items: [{ id: "x", budget: 120_000, progress: 0.5 }], // EV 60k
      statusDate: "2026-05-01", projectStart: "2026-01-01",
    });
    // CPI 0.8, SPI(t) 0.75, EAC₂ 150k vs 120k = 25% breach
    // → 0.4·0.8 + 0.4·0.75 + 0.2·0.75 = 0.77 → 77 (watch band, NOT on-track)
    const score = confidenceScore(snap);
    expect(score).toBeLessThan(80);          // a troubled project must not read "on track"
    expect(score).toBeGreaterThanOrEqual(0);
  });
  it("score is bounded 0..100", () => {
    const snap = computeEvm({
      bac: 100, actualCost: 1000,  // catastrophic overspend
      curve: [{ date: "2026-01-01", cumulativePV: 0 }, { date: "2026-12-01", cumulativePV: 100 }],
      items: [{ id: "x", budget: 100, progress: 0.05 }],
      statusDate: "2026-11-01", projectStart: "2026-01-01",
    });
    const score = confidenceScore(snap);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("M32 evm-project.executiveVerdict", () => {
  it("healthy → on-track headline + reassuring reason", () => {
    const snap = computeEvm({
      bac: 100, actualCost: 50,
      curve: [{ date: "2026-01-01", cumulativePV: 0 }, { date: "2026-02-01", cumulativePV: 100 }],
      items: [{ id: "x", budget: 100, progress: 0.5 }],
      statusDate: "2026-01-16", projectStart: "2026-01-01",
    });
    const v = executiveVerdict(snap);
    expect(v.level).toBe("on-track");
    expect(v.headline).toBe("On track");
  });
  it("cost-dragged project names CPI as the driver", () => {
    const snap = computeEvm({
      bac: 120_000, actualCost: 90_000,
      curve: [
        { date: "2026-01-01", cumulativePV: 0 },
        { date: "2026-06-01", cumulativePV: 60_000 },
        { date: "2026-12-01", cumulativePV: 120_000 },
      ],
      items: [{ id: "x", budget: 120_000, progress: 0.5 }], // EV 60k, AC 90k → CPI 0.67
      statusDate: "2026-06-01", projectStart: "2026-01-01",
    });
    const v = executiveVerdict(snap);
    expect(v.level).not.toBe("on-track");
    expect(v.reason.toLowerCase()).toContain("cost");
  });
});

describe("M32 evm-project.computeProjectEvm", () => {
  it("returns snapshot + verdict + range in one call", () => {
    const out = computeProjectEvm(BASE);
    expect(out.snapshot.bac).toBe(1_000_000);
    expect(out.verdict.score).toBeGreaterThanOrEqual(0);
    expect(out.range.low).toBeLessThanOrEqual(out.range.high);
  });
});
