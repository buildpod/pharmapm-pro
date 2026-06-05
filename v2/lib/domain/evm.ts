// Earned Value Management engine — pure compute layer.
//
// Implements the formulas locked in v2/docs/TRANSPARENCY_MODEL.md §2/§3.
// Standard EVM (PMBOK §7, AACE RP) + Earned Schedule (Lipke). No UI, no
// entity-store coupling — takes a baseline + items + status date, returns
// the full snapshot. Same pattern as scheduling.ts: pure, heavily tested,
// the algorithmic core every transparency surface reads from.
//
// Canonical names are in comments so each formula is cross-checkable against
// a PMBOK / AACE reference before it drives a leadership-facing number.

import { compare, daysBetween } from "./dates";

// ─── Inputs ───────────────────────────────────────────────────────────────────

// A single point on the time-phased planned-value curve: cumulative budgeted
// cost that *should* be earned by `date`. Curve must be sorted ascending and
// non-decreasing in cumulativePV. The last point's cumulativePV === BAC.
export interface PvPoint {
  date: string;            // ISO yyyy-mm-dd
  cumulativePV: number;
}

// A work item contributing to Earned Value. budget is its slice of BAC;
// progress is 0..1 (fraction complete).
export interface EvmItem {
  id: string;
  budget: number;          // this item's budgeted cost (Σ items.budget === BAC)
  progress: number;        // 0..1
}

export interface EvmInput {
  bac: number;             // Budget at Completion
  curve: PvPoint[];        // time-phased planned value
  items: EvmItem[];        // work items with budget + progress
  actualCost: number;      // AC / ACWP — actual cost incurred to date
  statusDate: string;      // "today" for the computation
  projectStart: string;    // for Earned Schedule actual-time
}

// ─── Snapshot output ──────────────────────────────────────────────────────────

export interface EvmSnapshot {
  // primitives
  bac: number;
  pv: number;              // Planned Value (BCWS) at status date
  ev: number;              // Earned Value (BCWP)
  ac: number;              // Actual Cost (ACWP)
  // variances
  cv: number;              // Cost Variance = EV − AC
  sv: number;              // Schedule Variance = EV − PV (cost units)
  // indices
  cpi: number;             // EV / AC
  spi: number;             // EV / PV
  // forecasts
  eac1: number;            // AC + (BAC − EV)            — variance atypical
  eac2: number;            // BAC / CPI                  — cost perf continues (PMBOK default)
  eac3: number;            // AC + (BAC − EV)/(CPI×SPI)  — cost+schedule drag continues
  eacHeadline: number;     // = eac2 (default surfaced number)
  etc: number;             // EAC − AC (uses headline EAC)
  vac: number;             // BAC − EAC (uses headline EAC) — >0 = under budget
  tcpi: number;            // (BAC − EV)/(BAC − AC) — efficiency remaining work must hit
  // earned schedule (time-based)
  es: number;              // Earned Schedule, in days from projectStart
  at: number;              // Actual Time, in days from projectStart
  svt: number;             // SV(t) = ES − AT (days; <0 = behind)
  spit: number;            // SPI(t) = ES / AT
  // convenience
  percentComplete: number; // EV / BAC
  percentSpent: number;    // AC / BAC
}

// ─── Guards ─────────────────────────────────────────────────────────────────

// Safe divide — returns `fallback` when denominator is ~0. EVM indices are
// undefined at AC=0 or PV=0; we surface a defined fallback rather than NaN so
// downstream UI never renders "NaN".
function safeDiv(numerator: number, denominator: number, fallback: number): number {
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-9) return fallback;
  return numerator / denominator;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

// Planned Value at a status date: interpolate the cumulative PV curve.
// Before the first point → 0. After the last point → BAC (last cumulativePV).
// Between points → linear interpolation (B1: linear curve default).
export function plannedValue(curve: PvPoint[], statusDate: string): number {
  if (curve.length === 0) return 0;
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (compare(statusDate, first.date) <= 0) {
    return compare(statusDate, first.date) === 0 ? first.cumulativePV : 0;
  }
  if (compare(statusDate, last.date) >= 0) return last.cumulativePV;

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (compare(statusDate, a.date) >= 0 && compare(statusDate, b.date) <= 0) {
      const span = daysBetween(a.date, b.date);
      if (span === 0) return b.cumulativePV;
      const into = daysBetween(a.date, statusDate);
      const frac = into / span;
      return a.cumulativePV + frac * (b.cumulativePV - a.cumulativePV);
    }
  }
  return last.cumulativePV; // unreachable given sorted curve
}

// Earned Value: budgeted cost of work actually completed = Σ (budget × progress).
export function earnedValue(items: EvmItem[]): number {
  return items.reduce((sum, it) => {
    const p = Math.max(0, Math.min(1, it.progress));
    return sum + it.budget * p;
  }, 0);
}

// ─── Variances + indices ──────────────────────────────────────────────────────

export function costVariance(ev: number, ac: number): number { return ev - ac; }
export function scheduleVariance(ev: number, pv: number): number { return ev - pv; }
export function cpi(ev: number, ac: number): number { return safeDiv(ev, ac, 1); }
export function spi(ev: number, pv: number): number { return safeDiv(ev, pv, 1); }

// ─── Forecasting ──────────────────────────────────────────────────────────────

// EAC₁ — variance is a one-off; remaining work runs to plan.
export function eacAtypical(ac: number, bac: number, ev: number): number {
  return ac + (bac - ev);
}
// EAC₂ — current cost performance continues (PMBOK default).
export function eacCostPerf(bac: number, cpiVal: number): number {
  return safeDiv(bac, cpiVal, bac);
}
// EAC₃ — both cost and schedule pressure continue (most conservative).
export function eacCostSchedule(ac: number, bac: number, ev: number, cpiVal: number, spiVal: number): number {
  const drag = cpiVal * spiVal;
  return ac + safeDiv(bac - ev, drag, bac - ev);
}

export function etc(eac: number, ac: number): number { return eac - ac; }
export function vac(bac: number, eac: number): number { return bac - eac; }

// TCPI — the CPI remaining work MUST achieve to still hit BAC.
// (BAC − EV) / (BAC − AC). If >~1.1 while CPI<1, budget is effectively unrecoverable.
export function tcpi(bac: number, ev: number, ac: number): number {
  return safeDiv(bac - ev, bac - ac, 1);
}

// ─── Earned Schedule (Lipke) ──────────────────────────────────────────────────

// ES — the time (days from projectStart) at which the current EV *should* have
// been earned per the PV curve. Find the curve date where cumulativePV === EV,
// interpolating, then measure days from projectStart to that date.
export function earnedSchedule(curve: PvPoint[], ev: number, projectStart: string): number {
  if (curve.length === 0) return 0;
  const last = curve[curve.length - 1];
  // EV at or beyond the full plan → ES = full planned duration
  if (ev >= last.cumulativePV) return daysBetween(projectStart, last.date);
  if (ev <= 0) return 0;

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (ev >= a.cumulativePV && ev <= b.cumulativePV) {
      const pvSpan = b.cumulativePV - a.cumulativePV;
      const dateSpan = daysBetween(a.date, b.date);
      const frac = pvSpan === 0 ? 0 : (ev - a.cumulativePV) / pvSpan;
      const esDate_daysFromA = frac * dateSpan;
      return daysBetween(projectStart, a.date) + esDate_daysFromA;
    }
  }
  return daysBetween(projectStart, last.date);
}

export function svt(es: number, at: number): number { return es - at; }
export function spit(es: number, at: number): number { return safeDiv(es, at, 1); }

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function computeEvm(input: EvmInput): EvmSnapshot {
  const { bac, curve, items, actualCost: ac, statusDate, projectStart } = input;

  const pv = plannedValue(curve, statusDate);
  const ev = earnedValue(items);

  const cv = costVariance(ev, ac);
  const sv = scheduleVariance(ev, pv);
  const cpiVal = cpi(ev, ac);
  const spiVal = spi(ev, pv);

  const eac1 = eacAtypical(ac, bac, ev);
  const eac2 = eacCostPerf(bac, cpiVal);
  const eac3 = eacCostSchedule(ac, bac, ev, cpiVal, spiVal);
  const eacHeadline = eac2; // PMBOK default (B3: headline EAC₂, EAC₃ surfaced as conservative bound)

  const es = earnedSchedule(curve, ev, projectStart);
  const at = Math.max(0, daysBetween(projectStart, statusDate));

  return {
    bac, pv, ev, ac,
    cv, sv,
    cpi: cpiVal, spi: spiVal,
    eac1, eac2, eac3, eacHeadline,
    etc: etc(eacHeadline, ac),
    vac: vac(bac, eacHeadline),
    tcpi: tcpi(bac, ev, ac),
    es, at,
    svt: svt(es, at),
    spit: spit(es, at),
    percentComplete: safeDiv(ev, bac, 0),
    percentSpent: safeDiv(ac, bac, 0),
  };
}

// Forecast range for leadership display: low / likely / high.
// likely = EAC₂ (PMBOK default); the band spans the optimistic (EAC₁) and
// conservative (EAC₃) variants, ordered so low ≤ likely ≤ high regardless of
// which variant is numerically largest.
export interface ForecastRange {
  low: number;
  likely: number;
  high: number;
}
export function forecastRange(snapshot: EvmSnapshot): ForecastRange {
  const values = [snapshot.eac1, snapshot.eac2, snapshot.eac3];
  return {
    low: Math.min(...values),
    likely: snapshot.eac2,
    high: Math.max(...values),
  };
}
