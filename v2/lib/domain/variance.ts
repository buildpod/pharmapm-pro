// Variance attribution — pure compute layer (PT-6).
//
// Decomposes a total cost variance into its causes — the "bridge" / waterfall
// a CFO expects: rate variance + volume/usage variance + scope variance.
// Specified in v2/docs/TRANSPARENCY_MODEL.md §4. Standard price/quantity
// variance decomposition from cost accounting.
//
// SIGN CONVENTION (important): this module reports cost OVERRUN, where
// positive = over budget / adds cost. This matches the CFO mental model
// ("we're $120k over"). It is the inverse of EVM Cost Variance (CV = EV − AC,
// where negative = over budget). Relationship:  overrun ≈ −CV.

// ─── Inputs ───────────────────────────────────────────────────────────────────

// A budget line where both rate and quantity can differ from plan.
// e.g. consultant days: plannedRate = day-rate, plannedQuantity = days.
export interface VarianceLine {
  id: string;
  label?: string;
  plannedRate: number;       // budgeted cost per unit
  actualRate: number;        // actual cost per unit
  plannedQuantity: number;   // budgeted units
  actualQuantity: number;    // actual units consumed
}

// Approved scope added AFTER the baseline (change requests). Not a rate/volume
// effect — it's new work the baseline never contained.
export interface ScopeAddition {
  id: string;
  label?: string;
  cost: number;              // cost of the approved out-of-baseline work
  decisionRef?: string;      // link to the DecisionRecord / CR that approved it
}

// ─── Per-line decomposition ─────────────────────────────────────────────────────

// Rate variance: "we paid more per unit than planned."
// (actualRate − plannedRate) × actualQuantity
export function rateVariance(line: VarianceLine): number {
  return (line.actualRate - line.plannedRate) * line.actualQuantity;
}

// Volume/usage variance: "we used more units than planned."
// (actualQuantity − plannedQuantity) × plannedRate
export function volumeVariance(line: VarianceLine): number {
  return (line.actualQuantity - line.plannedQuantity) * line.plannedRate;
}

// Scope variance: total cost of approved out-of-baseline work.
export function scopeVariance(additions: ScopeAddition[]): number {
  return additions.reduce((sum, a) => sum + a.cost, 0);
}

// Sanity: rateVariance + volumeVariance reconciles to the line's total
// cost delta (actualRate×actualQty − plannedRate×plannedQty). The standard
// two-way split assigns the rate×qty interaction term to rate variance
// (multiplied by actualQuantity), which is the conventional choice.

// ─── Bridge (waterfall) ─────────────────────────────────────────────────────────

export interface VarianceLineDetail {
  id: string;
  label?: string;
  rate: number;       // this line's rate variance
  volume: number;     // this line's volume variance
  total: number;      // rate + volume
}

export interface VarianceBridge {
  totalVariance: number;   // rate + volume + scope (positive = over budget)
  rateVariance: number;
  volumeVariance: number;
  scopeVariance: number;
  lines: VarianceLineDetail[];      // per rate/volume source, for drill-down
  scopeItems: ScopeAddition[];      // per scope source, for drill-down
}

// attributeVariance — full decomposition. The three components sum to the
// total. Each line + scope item is retained for drill-down (Trace).
export function attributeVariance(
  lines: VarianceLine[],
  scopeAdditions: ScopeAddition[] = [],
): VarianceBridge {
  const lineDetails: VarianceLineDetail[] = lines.map((l) => {
    const rate = rateVariance(l);
    const volume = volumeVariance(l);
    return { id: l.id, label: l.label, rate, volume, total: rate + volume };
  });

  const rate = lineDetails.reduce((s, d) => s + d.rate, 0);
  const volume = lineDetails.reduce((s, d) => s + d.volume, 0);
  const scope = scopeVariance(scopeAdditions);

  return {
    totalVariance: rate + volume + scope,
    rateVariance: rate,
    volumeVariance: volume,
    scopeVariance: scope,
    lines: lineDetails,
    scopeItems: scopeAdditions.slice(),
  };
}
