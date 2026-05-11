"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { risks as initialRisks, type Risk, type RiskStatus } from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Score bands (from v1 config/rules.js) ───────────────────────────────────

function scoreBand(score: number): "high" | "medium" | "low" {
  if (score >= 15) return "high";
  if (score >= 8)  return "medium";
  return "low";
}

const bandStyles = {
  high:   { pill: "bg-red-100 text-red-700",    cell: "bg-red-50"    },
  medium: { pill: "bg-amber-100 text-amber-700", cell: "bg-amber-50"  },
  low:    { pill: "bg-green-100 text-green-700", cell: "bg-green-50"  },
};

const statusBadge: Record<RiskStatus, string> = {
  open:      "bg-red-100 text-red-700",
  mitigated: "bg-blue-100 text-blue-700",
  closed:    "bg-muted text-muted-foreground",
};

const nextStatus: Record<RiskStatus, RiskStatus> = {
  open: "mitigated",
  mitigated: "closed",
  closed: "open",
};

// ─── 5×5 P×I heatmap ─────────────────────────────────────────────────────────

function cellColor(p: number, i: number) {
  const s = p * i;
  if (s >= 15) return "bg-red-100 border-red-200";
  if (s >= 8)  return "bg-amber-100 border-amber-200";
  if (s >= 4)  return "bg-yellow-50 border-yellow-200";
  return "bg-green-50 border-green-200";
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  // Build a lookup: (probability, impact) → risks there
  const cells: Record<string, Risk[]> = {};
  risks.forEach((r) => {
    const key = `${r.probability}-${r.impact}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push(r);
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-foreground">Risk Matrix (P × I)</p>
      <div className="flex gap-2">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center gap-0 w-4 shrink-0">
          <span className="text-[9px] text-muted-foreground [writing-mode:vertical-rl] rotate-180 tracking-widest uppercase">
            Impact ↑
          </span>
        </div>
        <div className="flex-1">
          {/* Grid: impact rows from 5 (top) down to 1 */}
          <div className="grid gap-0.5" style={{ gridTemplateRows: "repeat(5, 1fr)" }}>
            {[5, 4, 3, 2, 1].map((impact) => (
              <div key={impact} className="flex gap-0.5 items-center">
                <span className="w-3 shrink-0 text-[9px] text-muted-foreground text-right">{impact}</span>
                {[1, 2, 3, 4, 5].map((prob) => {
                  const key = `${prob}-${impact}`;
                  const cellRisks = cells[key] ?? [];
                  return (
                    <div
                      key={prob}
                      className={cn(
                        "flex-1 aspect-square border rounded-sm flex flex-wrap items-center justify-center gap-0.5 p-0.5 min-h-[32px]",
                        cellColor(prob, impact)
                      )}
                      title={`P${prob} × I${impact} = ${prob * impact}`}
                    >
                      {cellRisks.map((r) => (
                        <span
                          key={r.id}
                          title={r.title}
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-white shrink-0",
                            scoreBand(r.score) === "high"   ? "bg-red-500" :
                            scoreBand(r.score) === "medium" ? "bg-amber-500" :
                            "bg-green-500"
                          )}
                        >
                          {r.id.replace("r", "")}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* X-axis labels */}
          <div className="flex gap-0.5 mt-0.5 ml-3.5">
            {[1, 2, 3, 4, 5].map((p) => (
              <div key={p} className="flex-1 text-center text-[9px] text-muted-foreground">{p}</div>
            ))}
          </div>
          <p className="text-center text-[9px] text-muted-foreground mt-0.5 tracking-widest uppercase">
            Probability →
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex gap-3 flex-wrap">
        {(["high", "medium", "low"] as const).map((band) => (
          <span key={band} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", bandStyles[band].pill)}>
            {band === "high" ? "High ≥15" : band === "medium" ? "Medium 8–14" : "Low <8"}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Risk row ─────────────────────────────────────────────────────────────────

function RiskRow({
  risk,
  onStatusToggle,
}: {
  risk: Risk;
  onStatusToggle: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const band = scoreBand(risk.score);

  return (
    <>
      <tr className="hover:bg-muted/20 transition-colors">
        {/* Score */}
        <td className="px-4 py-3 text-center">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums", bandStyles[band].pill)}>
            {risk.score}
          </span>
        </td>

        {/* Title + category */}
        <td className="px-3 py-3">
          <p className="text-xs font-medium text-foreground">{risk.title}</p>
          <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {risk.category}
          </span>
        </td>

        {/* P × I */}
        <td className="px-3 py-3 text-center">
          <span className="text-xs tabular-nums text-foreground">{risk.probability}</span>
          <span className="text-xs text-muted-foreground"> × </span>
          <span className="text-xs tabular-nums text-foreground">{risk.impact}</span>
        </td>

        {/* Status (clickable) */}
        <td className="px-3 py-3 text-center">
          <button
            onClick={() => onStatusToggle(risk.id)}
            title={`Click to mark ${nextStatus[risk.status]}`}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70",
              statusBadge[risk.status]
            )}
          >
            {risk.status.charAt(0).toUpperCase() + risk.status.slice(1)}
          </button>
        </td>

        {/* Owner */}
        <td className="px-3 py-3 text-center text-xs text-muted-foreground">{risk.owner}</td>

        {/* Mitigation expand toggle */}
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Mitigation
          </button>
        </td>
      </tr>

      {/* Expanded mitigation */}
      {expanded && (
        <tr className="bg-muted/20">
          <td />
          <td colSpan={5} className="px-3 pb-3 pt-1 text-xs text-muted-foreground italic">
            {risk.mitigation}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main grid ────────────────────────────────────────────────────────────────

type SortKey = "score" | "probability" | "impact";

export function RisksGrid() {
  const [risks, setRisks] = useState<Risk[]>(initialRisks);
  const [filterStatus, setFilterStatus] = useState<RiskStatus | "All">("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const allCategories = Array.from(new Set(risks.map((r) => r.category)));

  function handleStatusToggle(id: string) {
    setRisks((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: nextStatus[r.status] } : r)
    );
  }

  const filtered = risks
    .filter((r) => filterStatus === "All" || r.status === filterStatus)
    .filter((r) => filterCategory === "All" || r.category === filterCategory)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const openCount      = risks.filter((r) => r.status === "open").length;
  const mitigatedCount = risks.filter((r) => r.status === "mitigated").length;

  return (
    <div className="space-y-4">
      {/* P×I matrix */}
      <RiskMatrix risks={risks} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status pills */}
        {([["All", risks.length], ["open", openCount], ["mitigated", mitigatedCount]] as const).map(
          ([label, count]) => (
            <button
              key={label}
              onClick={() => setFilterStatus(label as RiskStatus | "All")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                filterStatus === label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label === "All" ? `All (${count})` : `${label.charAt(0).toUpperCase() + label.slice(1)} (${count})`}
            </button>
          )
        )}

        <div className="flex-1" />

        {/* Category filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All categories</option>
          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="score">Sort: Score</option>
          <option value="probability">Sort: Probability</option>
          <option value="impact">Sort: Impact</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-center w-16">Score</th>
              <th className="px-3 py-2 text-left">Risk</th>
              <th className="px-3 py-2 text-center w-20">P × I</th>
              <th className="px-3 py-2 text-center w-24">Status</th>
              <th className="px-3 py-2 text-center w-16">Owner</th>
              <th className="px-4 py-2 text-left w-28">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">
                  No risks match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <RiskRow key={r.id} risk={r} onStatusToggle={handleStatusToggle} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground px-1">
        Click a status badge to cycle: Open → Mitigated → Closed. Click Mitigation to expand the response plan.
      </p>
    </div>
  );
}
