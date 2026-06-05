// M30 — EVM engine test matrix.
//
// Verifies each formula in isolation + integrated scenarios (on-plan,
// over-budget, behind-schedule, ahead, unrecoverable) against hand-computed
// expected values. Formula names match TRANSPARENCY_MODEL.md §2/§3 for
// PMBOK / AACE cross-check.

import { describe, it, expect } from "vitest";
import {
  plannedValue, earnedValue,
  costVariance, scheduleVariance, cpi, spi,
  eacAtypical, eacCostPerf, eacCostSchedule, etc, vac, tcpi,
  earnedSchedule, svt, spit,
  computeEvm, forecastRange,
  type PvPoint, type EvmItem,
} from "./evm";

// ─── Canonical baseline — a linear $120k / 6-month project ─────────────────────
// Jan 1 → Jul 1, $20k planned per month, BAC = $120k.
const CURVE: PvPoint[] = [
  { date: "2026-01-01", cumulativePV: 0 },
  { date: "2026-02-01", cumulativePV: 20_000 },
  { date: "2026-03-01", cumulativePV: 40_000 },
  { date: "2026-04-01", cumulativePV: 60_000 },
  { date: "2026-05-01", cumulativePV: 80_000 },
  { date: "2026-06-01", cumulativePV: 100_000 },
  { date: "2026-07-01", cumulativePV: 120_000 },
];
const BAC = 120_000;
const START = "2026-01-01";

// ─── plannedValue ──────────────────────────────────────────────────────────────

describe("M30 evm.plannedValue", () => {
  it("0 before the project starts", () => {
    expect(plannedValue(CURVE, "2025-12-01")).toBe(0);
  });
  it("exact curve point returns its value", () => {
    expect(plannedValue(CURVE, "2026-04-01")).toBe(60_000);
  });
  it("BAC at/after the final point", () => {
    expect(plannedValue(CURVE, "2026-07-01")).toBe(120_000);
    expect(plannedValue(CURVE, "2026-09-01")).toBe(120_000);
  });
  it("linear interpolation mid-segment (mid-April ≈ 70k)", () => {
    // Apr 1 = 60k, May 1 = 80k. Apr 16 is ~half → ~70k.
    const pv = plannedValue(CURVE, "2026-04-16");
    expect(pv).toBeGreaterThan(68_000);
    expect(pv).toBeLessThan(72_000);
  });
  it("empty curve returns 0", () => {
    expect(plannedValue([], "2026-04-01")).toBe(0);
  });
});

// ─── earnedValue ────────────────────────────────────────────────────────────────

describe("M30 evm.earnedValue", () => {
  const items: EvmItem[] = [
    { id: "a", budget: 40_000, progress: 1 },     // done → 40k
    { id: "b", budget: 40_000, progress: 0.5 },   // half → 20k
    { id: "c", budget: 40_000, progress: 0 },     // none → 0
  ];
  it("sums budget × progress", () => {
    expect(earnedValue(items)).toBe(60_000);
  });
  it("clamps progress to 0..1", () => {
    expect(earnedValue([{ id: "x", budget: 100, progress: 1.5 }])).toBe(100);
    expect(earnedValue([{ id: "y", budget: 100, progress: -0.2 }])).toBe(0);
  });
  it("empty items → 0", () => {
    expect(earnedValue([])).toBe(0);
  });
});

// ─── variances + indices ──────────────────────────────────────────────────────

describe("M30 evm variances + indices", () => {
  it("CV / SV signs", () => {
    expect(costVariance(60_000, 70_000)).toBe(-10_000);   // over budget
    expect(costVariance(60_000, 50_000)).toBe(10_000);    // under budget
    expect(scheduleVariance(60_000, 80_000)).toBe(-20_000); // behind
  });
  it("CPI < 1 = burning faster than earning", () => {
    expect(cpi(60_000, 75_000)).toBeCloseTo(0.8, 5);
  });
  it("SPI < 1 = behind schedule", () => {
    expect(spi(60_000, 80_000)).toBeCloseTo(0.75, 5);
  });
  it("CPI guards divide-by-zero (AC=0 → 1)", () => {
    expect(cpi(60_000, 0)).toBe(1);
  });
  it("SPI guards divide-by-zero (PV=0 → 1)", () => {
    expect(spi(60_000, 0)).toBe(1);
  });
});

// ─── forecasting ────────────────────────────────────────────────────────────────

describe("M30 evm forecasting (EAC / ETC / VAC / TCPI)", () => {
  // Scenario: BAC 120k, EV 60k, AC 75k → CPI 0.8; PV 80k → SPI 0.75.
  const ev = 60_000, ac = 75_000, cpiVal = 0.8, spiVal = 0.75;

  it("EAC₁ (atypical) = AC + (BAC − EV)", () => {
    expect(eacAtypical(ac, BAC, ev)).toBe(75_000 + 60_000); // 135k
  });
  it("EAC₂ (cost perf) = BAC / CPI", () => {
    expect(eacCostPerf(BAC, cpiVal)).toBeCloseTo(150_000, 0); // 120k/0.8
  });
  it("EAC₃ (cost+schedule) = AC + (BAC−EV)/(CPI×SPI)", () => {
    // 75k + 60k/(0.6) = 75k + 100k = 175k
    expect(eacCostSchedule(ac, BAC, ev, cpiVal, spiVal)).toBeCloseTo(175_000, 0);
  });
  it("EAC ordering: atypical < cost-perf < cost+schedule for a troubled project", () => {
    const e1 = eacAtypical(ac, BAC, ev);
    const e2 = eacCostPerf(BAC, cpiVal);
    const e3 = eacCostSchedule(ac, BAC, ev, cpiVal, spiVal);
    expect(e1).toBeLessThan(e2);
    expect(e2).toBeLessThan(e3);
  });
  it("ETC = EAC − AC", () => {
    expect(etc(150_000, 75_000)).toBe(75_000);
  });
  it("VAC > 0 under budget, < 0 over budget", () => {
    expect(vac(BAC, 100_000)).toBe(20_000);   // forecast under
    expect(vac(BAC, 150_000)).toBe(-30_000);  // forecast over
  });
  it("TCPI = (BAC−EV)/(BAC−AC)", () => {
    // (120k−60k)/(120k−75k) = 60k/45k ≈ 1.333
    expect(tcpi(BAC, 60_000, 75_000)).toBeCloseTo(1.333, 2);
  });
  it("TCPI unrecoverable signal: >1.1 while CPI<1", () => {
    const t = tcpi(BAC, 60_000, 75_000);
    const c = cpi(60_000, 75_000);
    expect(t).toBeGreaterThan(1.1);
    expect(c).toBeLessThan(1.0);   // remaining work must beat 1.33 while running at 0.8 — unrecoverable
  });
});

// ─── Earned Schedule ────────────────────────────────────────────────────────────

describe("M30 evm Earned Schedule", () => {
  it("ES = full duration when EV ≥ BAC", () => {
    const es = earnedSchedule(CURVE, 120_000, START);
    expect(es).toBeCloseTo(181, 0); // Jan 1 → Jul 1 = 181 days
  });
  it("ES interpolates: EV 60k → ES at Apr 1 (~90 days)", () => {
    // 60k cumulativePV is exactly the Apr 1 point → 90 days from Jan 1
    const es = earnedSchedule(CURVE, 60_000, START);
    expect(es).toBeCloseTo(90, 0);
  });
  it("ES 0 when EV ≤ 0", () => {
    expect(earnedSchedule(CURVE, 0, START)).toBe(0);
  });
  it("SV(t) negative = behind in time", () => {
    // EV earned 60k (worth Apr 1 / 90d) but actual time is Jun 1 (~151d) → behind
    const es = earnedSchedule(CURVE, 60_000, START);  // ~90
    const at = 151;                                    // Jan 1 → Jun 1
    expect(svt(es, at)).toBeLessThan(0);
    expect(spit(es, at)).toBeLessThan(1);
  });
  it("SV(t) stays meaningful at project end (EVM's SV would be ~0)", () => {
    // At end: EV near BAC but late. Classic SV = EV − PV → ~0 (both ≈ BAC).
    // ES-based SV(t) still shows the lateness.
    const ev = 118_000;                                // almost done
    const pvAtEnd = plannedValue(CURVE, "2026-07-01"); // 120k
    const classicSV = scheduleVariance(ev, pvAtEnd);   // −2k, nearly hidden
    const es = earnedSchedule(CURVE, ev, START);
    const at = 200;                                    // overran past Jul 1
    expect(Math.abs(classicSV)).toBeLessThan(3_000);   // classic SV nearly blind
    expect(svt(es, at)).toBeLessThan(-15);             // ES-based still shows weeks late
  });
});

// ─── computeEvm orchestrator ──────────────────────────────────────────────────

describe("M30 evm.computeEvm — integrated scenarios", () => {
  const items: EvmItem[] = [
    { id: "a", budget: 40_000, progress: 1 },
    { id: "b", budget: 40_000, progress: 0.5 },
    { id: "c", budget: 40_000, progress: 0 },
  ]; // EV = 60k

  it("on-plan, on-budget project: indices ≈ 1", () => {
    // Status Apr 1 → PV 60k. EV 60k, AC 60k.
    const snap = computeEvm({
      bac: BAC, curve: CURVE, items, actualCost: 60_000,
      statusDate: "2026-04-01", projectStart: START,
    });
    expect(snap.pv).toBe(60_000);
    expect(snap.ev).toBe(60_000);
    expect(snap.cpi).toBeCloseTo(1, 5);
    expect(snap.spi).toBeCloseTo(1, 5);
    expect(snap.cv).toBe(0);
    expect(snap.sv).toBe(0);
    expect(snap.eacHeadline).toBeCloseTo(BAC, 0); // on-budget forecast = BAC
    expect(snap.vac).toBeCloseTo(0, 0);
  });

  it("over-budget + behind: CPI<1, SPI<1, EAC>BAC, VAC<0", () => {
    // Status May 1 → PV 80k. EV 60k (behind), AC 75k (over).
    const snap = computeEvm({
      bac: BAC, curve: CURVE, items, actualCost: 75_000,
      statusDate: "2026-05-01", projectStart: START,
    });
    expect(snap.pv).toBe(80_000);
    expect(snap.ev).toBe(60_000);
    expect(snap.cpi).toBeCloseTo(0.8, 5);
    expect(snap.spi).toBeCloseTo(0.75, 5);
    expect(snap.eacHeadline).toBeGreaterThan(BAC);
    expect(snap.vac).toBeLessThan(0);
    expect(snap.tcpi).toBeGreaterThan(1.1); // unrecoverable
  });

  it("percentComplete / percentSpent", () => {
    const snap = computeEvm({
      bac: BAC, curve: CURVE, items, actualCost: 75_000,
      statusDate: "2026-05-01", projectStart: START,
    });
    expect(snap.percentComplete).toBeCloseTo(0.5, 5);  // 60k/120k
    expect(snap.percentSpent).toBeCloseTo(0.625, 5);   // 75k/120k
  });

  it("zero AC (nothing spent yet) does not produce NaN", () => {
    const snap = computeEvm({
      bac: BAC, curve: CURVE, items: [{ id: "z", budget: 120_000, progress: 0 }],
      actualCost: 0, statusDate: "2026-01-01", projectStart: START,
    });
    expect(Number.isFinite(snap.cpi)).toBe(true);
    expect(Number.isFinite(snap.eacHeadline)).toBe(true);
    expect(Number.isFinite(snap.tcpi)).toBe(true);
  });
});

// ─── forecastRange ──────────────────────────────────────────────────────────────

describe("M30 evm.forecastRange", () => {
  it("low ≤ likely ≤ high, likely = EAC₂", () => {
    const snap = computeEvm({
      bac: BAC, curve: CURVE,
      items: [
        { id: "a", budget: 40_000, progress: 1 },
        { id: "b", budget: 40_000, progress: 0.5 },
        { id: "c", budget: 40_000, progress: 0 },
      ],
      actualCost: 75_000, statusDate: "2026-05-01", projectStart: START,
    });
    const range = forecastRange(snap);
    expect(range.low).toBeLessThanOrEqual(range.likely);
    expect(range.likely).toBeLessThanOrEqual(range.high);
    expect(range.likely).toBe(snap.eac2);
  });
});
