// M31 — Variance attribution test matrix (PT-6).
// Verifies the rate/volume/scope decomposition against hand-computed values,
// including the spec §4 worked "bridge" example. Sign convention: positive =
// over budget.

import { describe, it, expect } from "vitest";
import {
  rateVariance, volumeVariance, scopeVariance, attributeVariance,
  type VarianceLine, type ScopeAddition,
} from "./variance";

describe("M31 variance — per-line formulas", () => {
  it("rateVariance = (actualRate − plannedRate) × actualQuantity", () => {
    // paid 260 vs planned 200, over 60 actual units → 60 × 60 = 3600
    const line: VarianceLine = {
      id: "v", plannedRate: 200, actualRate: 260,
      plannedQuantity: 50, actualQuantity: 60,
    };
    expect(rateVariance(line)).toBe(3_600);
  });

  it("volumeVariance = (actualQuantity − plannedQuantity) × plannedRate", () => {
    // 10 extra units at planned 200 → 2000
    const line: VarianceLine = {
      id: "v", plannedRate: 200, actualRate: 260,
      plannedQuantity: 50, actualQuantity: 60,
    };
    expect(volumeVariance(line)).toBe(2_000);
  });

  it("rate + volume reconciles to total cost delta of the line", () => {
    const line: VarianceLine = {
      id: "v", plannedRate: 200, actualRate: 260,
      plannedQuantity: 50, actualQuantity: 60,
    };
    const planned = line.plannedRate * line.plannedQuantity; // 10,000
    const actual = line.actualRate * line.actualQuantity;    // 15,600
    const delta = actual - planned;                          // 5,600
    expect(rateVariance(line) + volumeVariance(line)).toBe(delta);
  });

  it("on-plan line → zero variance", () => {
    const line: VarianceLine = {
      id: "ok", plannedRate: 100, actualRate: 100,
      plannedQuantity: 10, actualQuantity: 10,
    };
    expect(rateVariance(line)).toBe(0);
    expect(volumeVariance(line)).toBe(0);
  });

  it("under-budget line → negative variance (came in cheaper)", () => {
    const line: VarianceLine = {
      id: "under", plannedRate: 100, actualRate: 90,
      plannedQuantity: 10, actualQuantity: 10,
    };
    expect(rateVariance(line)).toBe(-100); // saved $10/unit × 10
  });

  it("scopeVariance sums approved out-of-baseline work", () => {
    const additions: ScopeAddition[] = [
      { id: "cr1", cost: 20_000, decisionRef: "d-cr1" },
      { id: "cr2", cost: 5_000 },
    ];
    expect(scopeVariance(additions)).toBe(25_000);
  });
});

describe("M31 variance — attributeVariance bridge", () => {
  // Spec §4 worked example, made numerically exact:
  // Configuration $120k over =
  //   rate:   vendor day-rate 200→260, over 80 actual days → 60×80 = 48,000
  //   volume: 40 extra days vs plan at planned 200          → 40×200 = 8,000
  //   ... (we tune quantities so rate=48k, volume=52k, scope=20k = 120k)
  // To hit rate 48k + volume 52k: plannedRate 200, actualRate 260,
  // plannedQuantity P, actualQuantity A.
  //   rate   = 60 × A   = 48,000  → A = 800
  //   volume = (A − P) × 200 = 52,000 → A − P = 260 → P = 540
  const lines: VarianceLine[] = [
    { id: "vendor", label: "Vendor consultant days",
      plannedRate: 200, actualRate: 260, plannedQuantity: 540, actualQuantity: 800 },
  ];
  const scope: ScopeAddition[] = [
    { id: "cr3", label: "CR-3 add submission-type", cost: 20_000, decisionRef: "d3" },
  ];

  it("decomposes into rate 48k + volume 52k + scope 20k = 120k", () => {
    const bridge = attributeVariance(lines, scope);
    expect(bridge.rateVariance).toBe(48_000);
    expect(bridge.volumeVariance).toBe(52_000);
    expect(bridge.scopeVariance).toBe(20_000);
    expect(bridge.totalVariance).toBe(120_000);
  });

  it("components always sum to total", () => {
    const bridge = attributeVariance(lines, scope);
    expect(bridge.rateVariance + bridge.volumeVariance + bridge.scopeVariance)
      .toBe(bridge.totalVariance);
  });

  it("retains per-line + per-scope detail for drill-down", () => {
    const bridge = attributeVariance(lines, scope);
    expect(bridge.lines).toHaveLength(1);
    expect(bridge.lines[0].id).toBe("vendor");
    expect(bridge.lines[0].total).toBe(100_000); // 48k + 52k
    expect(bridge.scopeItems).toHaveLength(1);
    expect(bridge.scopeItems[0].decisionRef).toBe("d3");
  });

  it("empty inputs → zero bridge", () => {
    const bridge = attributeVariance([], []);
    expect(bridge.totalVariance).toBe(0);
    expect(bridge.lines).toEqual([]);
    expect(bridge.scopeItems).toEqual([]);
  });

  it("multi-line aggregation", () => {
    const multi: VarianceLine[] = [
      { id: "a", plannedRate: 100, actualRate: 110, plannedQuantity: 10, actualQuantity: 10 }, // rate +100, vol 0
      { id: "b", plannedRate: 50,  actualRate: 50,  plannedQuantity: 20, actualQuantity: 25 }, // rate 0, vol +250
    ];
    const bridge = attributeVariance(multi);
    expect(bridge.rateVariance).toBe(100);
    expect(bridge.volumeVariance).toBe(250);
    expect(bridge.scopeVariance).toBe(0);
    expect(bridge.totalVariance).toBe(350);
  });
});
