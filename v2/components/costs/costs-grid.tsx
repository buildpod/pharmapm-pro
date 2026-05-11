import { costLines, budgetTrend } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const TOTAL_BUDGET_K = 2000;

const categoryColor: Record<string, string> = {
  Implementation: "bg-blue-100 text-blue-700",
  Validation:     "bg-purple-100 text-purple-700",
  Migration:      "bg-orange-100 text-orange-700",
  Integration:    "bg-cyan-100 text-cyan-700",
  Training:       "bg-pink-100 text-pink-700",
  License:        "bg-indigo-100 text-indigo-700",
  Internal:       "bg-muted text-muted-foreground",
};

const contractBadge: Record<string, string> = {
  "T&M":      "bg-amber-50 text-amber-700",
  "Fixed":    "bg-green-50 text-green-700",
  "Internal": "bg-muted text-muted-foreground",
};

function BurnBar({ pct, warn }: { pct: number; warn: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", warn ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn("w-8 text-right text-[10px] font-semibold tabular-nums shrink-0", warn ? "text-amber-600" : "text-foreground")}>
        {pct}%
      </span>
    </div>
  );
}

export function CostsGrid() {
  const totalActualK  = costLines.reduce((s, c) => s + c.actualK, 0);
  const totalBurnPct  = Math.round((totalActualK / TOTAL_BUDGET_K) * 100);
  const remainingK    = TOTAL_BUDGET_K - totalActualK;

  // Monthly deltas from cumulative trend
  const withDelta = budgetTrend.map((row, i) => {
    const prevPlanned = i > 0 ? budgetTrend[i - 1].planned : 0;
    const prevActual  = i > 0 ? budgetTrend[i - 1].actual  : 0;
    return {
      ...row,
      deltaPlanned: row.planned - prevPlanned,
      deltaActual:  row.actual > 0 ? row.actual - prevActual : null,
    };
  });

  return (
    <div className="space-y-5">
      {/* ── KPI summary ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Budget",   value: `$${(TOTAL_BUDGET_K / 1000).toFixed(1)}M`, sub: "project ceiling" },
          { label: "Spent to Date",  value: `$${(totalActualK / 1000).toFixed(2)}M`,   sub: `${totalBurnPct}% utilised` },
          { label: "Remaining",      value: `$${(remainingK / 1000).toFixed(2)}M`,     sub: `${100 - totalBurnPct}% available` },
          { label: "Cost Lines",     value: String(costLines.length),                   sub: "categories tracked" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Overall burn bar ───────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Overall Budget Burn</p>
          <span className="text-xs text-muted-foreground">${totalActualK}k of $2,000k</span>
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full", totalBurnPct > 85 ? "bg-destructive" : totalBurnPct > 60 ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${totalBurnPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>$0</span>
          <span className="font-semibold text-foreground">{totalBurnPct}% burned</span>
          <span>$2.0M</span>
        </div>
      </div>

      {/* ── Cost line breakdown ────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-foreground">Cost Breakdown by Category</p>
          <span className="text-xs text-muted-foreground">budget · actual · burn</span>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-center w-20">Type</th>
              <th className="px-3 py-2 text-right w-20">Budget</th>
              <th className="px-3 py-2 text-right w-20">Actual</th>
              <th className="px-5 py-2 text-left w-40">Burn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {costLines.map((c) => {
              const pct  = c.budgetK > 0 ? Math.round((c.actualK / c.budgetK) * 100) : 0;
              const warn = pct > 80;
              return (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", categoryColor[c.category] ?? "bg-muted text-muted-foreground")}>
                      {c.category}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{c.description}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", contractBadge[c.contractType])}>
                      {c.contractType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-foreground">
                    ${c.budgetK}k
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {c.actualK > 0 ? `$${c.actualK}k` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <BurnBar pct={pct} warn={warn} />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals row */}
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="px-5 py-3 text-xs text-foreground">Total</td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3" />
              <td className="px-3 py-3 text-right text-xs tabular-nums text-foreground">
                ${TOTAL_BUDGET_K}k
              </td>
              <td className="px-3 py-3 text-right text-xs tabular-nums text-foreground">
                ${totalActualK}k
              </td>
              <td className="px-5 py-3">
                <BurnBar pct={totalBurnPct} warn={totalBurnPct > 80} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Monthly burn trend ─────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-foreground">Monthly Burn Trend</p>
          <span className="text-xs text-muted-foreground">cumulative $k · Jan – Jun 2026</span>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2 text-left w-16">Month</th>
              <th className="px-3 py-2 text-right">Plan (month)</th>
              <th className="px-3 py-2 text-right">Actual (month)</th>
              <th className="px-3 py-2 text-right">Plan (cumul.)</th>
              <th className="px-5 py-2 text-right">Actual (cumul.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {withDelta.map((row) => {
              const isForecast = row.actual === 0;
              const variance   = row.deltaActual != null
                ? row.deltaActual - row.deltaPlanned
                : null;
              return (
                <tr key={row.month} className={cn("hover:bg-muted/20 transition-colors", isForecast && "opacity-60")}>
                  <td className="px-5 py-2.5 font-medium text-foreground">
                    {row.month}
                    {isForecast && (
                      <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">forecast</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    ${row.deltaPlanned}k
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.deltaActual != null ? (
                      <span className="text-foreground">${row.deltaActual}k</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {variance != null && variance !== 0 && (
                      <span className={cn("ml-1 text-[10px]", variance > 0 ? "text-destructive" : "text-green-600")}>
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    ${row.planned}k
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {row.actual > 0 ? (
                      <span className="font-medium text-foreground">${row.actual}k</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
