"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DollarSign, TrendingDown, Wallet, Layers, Plus } from "lucide-react";
import { budgetTrend, type CostLine } from "@/lib/mockData";
import { CostLineFormDrawer } from "./cost-line-form";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";
import { cn } from "@/lib/utils";

const TOTAL_BUDGET_K = 2000;

const categoryColor: Record<string, string> = {
  Implementation: "bg-blue-50 text-blue-700 border-blue-200",
  Validation:     "bg-violet-50 text-violet-700 border-violet-200",
  Migration:      "bg-orange-50 text-orange-700 border-orange-200",
  Integration:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  Training:       "bg-pink-50 text-pink-700 border-pink-200",
  License:        "bg-indigo-50 text-indigo-700 border-indigo-200",
  Internal:       "bg-slate-100 text-slate-600 border-slate-200",
};

const contractBadge: Record<string, string> = {
  "T&M":      "bg-amber-50 text-amber-700 border-amber-200",
  "Fixed":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Internal": "bg-slate-100 text-slate-600 border-slate-200",
};

function BurnBar({ pct, warn, danger }: { pct: number; warn: boolean; danger?: boolean }) {
  const fill = danger ? "bg-rose-500" : warn ? "bg-amber-500" : "bg-blue-500";
  const textTone = danger ? "text-rose-600" : warn ? "text-amber-600" : "text-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cn("h-full rounded-full transition-all", fill)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={cn("w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums", textTone)}>
        {pct}%
      </span>
    </div>
  );
}

// ─── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, Icon, tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof DollarSign;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneStyles = {
    neutral: { value: "text-foreground",  chipBg: "bg-muted text-muted-foreground" },
    good:    { value: "text-emerald-600", chipBg: "bg-emerald-50 text-emerald-700" },
    warn:    { value: "text-amber-600",   chipBg: "bg-amber-50 text-amber-700"     },
    bad:     { value: "text-rose-600",    chipBg: "bg-rose-50 text-rose-700"       },
  };
  const t = toneStyles[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", t.chipBg)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-4 text-3xl font-bold tabular-nums leading-none", t.value)}>{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Main grid ──────────────────────────────────────────────────────────────

type CostDrawerState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; line: CostLine };

export function CostsGrid() {
  const { activeProjectId } = useProject();
  const costLines       = useEntityStore((s) => s.costLines);
  const addCostLine     = useEntityStore((s) => s.addCostLine);
  const updateCostLine  = useEntityStore((s) => s.updateCostLine);
  const deleteCostLineAction = useEntityStore((s) => s.deleteCostLine);
  const [drawer, setDrawer]       = useState<CostDrawerState>({ mode: "closed" });

  const projectCostLines = costLines.filter((c) => c.projectId === activeProjectId);
  const knownCategories  = Array.from(new Set(projectCostLines.map((c) => c.category)));

  function handleDrawerSave(c: CostLine) {
    const withProj: CostLine = { ...c, projectId: c.projectId || activeProjectId };
    const exists = costLines.some((x) => x.id === withProj.id);
    if (exists) {
      updateCostLine(withProj);
      toast.success("Cost line updated", { description: withProj.description });
    } else {
      addCostLine(withProj);
      toast.success("Cost line added", { description: withProj.description });
    }
    setDrawer({ mode: "closed" });
  }
  function handleDrawerDelete(id: string) {
    const target = costLines.find((c) => c.id === id);
    deleteCostLineAction(id);
    toast.success("Cost line deleted", { description: target?.description });
    setDrawer({ mode: "closed" });
  }

  // Totals computed from the project's own cost lines (not a hardcoded ceiling)
  const totalBudgetK  = projectCostLines.reduce((s, c) => s + c.budgetK, 0) || TOTAL_BUDGET_K;
  const totalActualK  = projectCostLines.reduce((s, c) => s + c.actualK, 0);
  const totalBurnPct  = totalBudgetK > 0 ? Math.round((totalActualK / totalBudgetK) * 100) : 0;
  const remainingK    = totalBudgetK - totalActualK;

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
    <div className="space-y-6">
      {/* KPI summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Budget"  value={`$${(totalBudgetK / 1000).toFixed(1)}M`} sub="project ceiling" Icon={Wallet} tone="neutral" />
        <KpiCard label="Spent to Date" value={`$${(totalActualK / 1000).toFixed(2)}M`}  sub={`${totalBurnPct}% utilised`}
          Icon={DollarSign} tone={totalBurnPct >= 85 ? "bad" : totalBurnPct >= 60 ? "warn" : "neutral"} />
        <KpiCard label="Remaining"     value={`$${(remainingK / 1000).toFixed(2)}M`}    sub={`${100 - totalBurnPct}% available`}
          Icon={TrendingDown} tone="good" />
        <KpiCard label="Cost Lines"    value={String(projectCostLines.length)} sub="categories tracked" Icon={Layers} tone="neutral" />
      </div>

      {/* Overall burn bar */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Overall Budget Burn</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">${totalActualK}k</span> of ${totalBudgetK}k
            </p>
          </div>
          <span className={cn(
            "rounded-md px-2.5 py-1 text-sm font-bold tabular-nums",
            totalBurnPct >= 85 ? "bg-rose-50 text-rose-700"
            : totalBurnPct >= 60 ? "bg-amber-50 text-amber-700"
            : "bg-blue-50 text-blue-700",
          )}>
            {totalBurnPct}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              totalBurnPct > 85 ? "bg-rose-500" : totalBurnPct > 60 ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${totalBurnPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>$0</span>
          <span>$1.0M</span>
          <span>$2.0M</span>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-foreground">Cost Breakdown by Category</p>
            <p className="mt-0.5 text-xs text-muted-foreground">budget · actual · burn % per line</p>
          </div>
          <button
            onClick={() => setDrawer({ mode: "new" })}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-2.5 text-left">Category</th>
              <th className="px-3 py-2.5 text-left">Description</th>
              <th className="w-24 px-3 py-2.5 text-center">Type</th>
              <th className="w-24 px-3 py-2.5 text-right">Budget</th>
              <th className="w-24 px-3 py-2.5 text-right">Actual</th>
              <th className="w-44 px-5 py-2.5 text-left">Burn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projectCostLines.map((c) => {
              const pct  = c.budgetK > 0 ? Math.round((c.actualK / c.budgetK) * 100) : 0;
              const warn = pct > 60 && pct <= 85;
              const danger = pct > 85;
              return (
                <tr key={c.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      categoryColor[c.category] ?? "bg-slate-100 text-slate-600 border-slate-200",
                    )}>
                      {c.category}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <button
                      onClick={() => setDrawer({ mode: "edit", line: c })}
                      className="text-left text-xs text-muted-foreground hover:text-primary hover:underline"
                      title="Click to edit"
                    >
                      {c.description}
                    </button>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", contractBadge[c.contractType])}>
                      {c.contractType}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm font-medium tabular-nums text-foreground">
                    ${c.budgetK}k
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm tabular-nums text-foreground">
                    {c.actualK > 0 ? `$${c.actualK}k` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <BurnBar pct={pct} warn={warn} danger={danger} />
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 text-sm font-semibold">
              <td className="px-5 py-3.5 text-foreground">Total</td>
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                ${totalBudgetK}k
              </td>
              <td className="px-3 py-3.5 text-right tabular-nums text-foreground">
                ${totalActualK}k
              </td>
              <td className="px-5 py-3.5">
                <BurnBar pct={totalBurnPct} warn={totalBurnPct > 60 && totalBurnPct <= 85} danger={totalBurnPct > 85} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <CostLineFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.line : null}
        allCostLines={costLines}
        knownCategories={knownCategories}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />

      {/* Monthly burn trend */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-foreground">Monthly Burn Trend</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Cumulative $k · Jan – Jun 2026</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="w-20 px-5 py-2.5 text-left">Month</th>
              <th className="px-3 py-2.5 text-right">Plan (month)</th>
              <th className="px-3 py-2.5 text-right">Actual (month)</th>
              <th className="px-3 py-2.5 text-right">Plan (cumul.)</th>
              <th className="px-5 py-2.5 text-right">Actual (cumul.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {withDelta.map((row) => {
              const isForecast = row.actual === 0;
              const variance = row.deltaActual != null ? row.deltaActual - row.deltaPlanned : null;
              return (
                <tr key={row.month} className={cn("transition-colors hover:bg-muted/20", isForecast && "opacity-60")}>
                  <td className="px-5 py-3 font-medium text-foreground">
                    {row.month}
                    {isForecast && (
                      <span className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        forecast
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                    ${row.deltaPlanned}k
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.deltaActual != null ? (
                      <span className="text-foreground">${row.deltaActual}k</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {variance != null && variance !== 0 && (
                      <span className={cn(
                        "ml-1.5 text-[11px] font-semibold",
                        variance > 0 ? "text-rose-600" : "text-emerald-600",
                      )}>
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                    ${row.planned}k
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
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
