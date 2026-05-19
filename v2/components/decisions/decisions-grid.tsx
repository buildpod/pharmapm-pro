"use client";

// M25 — Decisions grid. Mirrors the Issues pattern (cross-entity-parity
// skill) — same layout, different fields. Tone discipline: slate Pending,
// emerald Approved, rose Rejected, muted Superseded.

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Scale, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntityStore } from "@/lib/stores/entity-store";
import { useProject } from "@/components/projects/project-provider";
import { type DecisionRecord, type DecisionRecordStatus } from "@/lib/mockData";
import { DecisionFormDrawer } from "./decision-form";

const statusStyles: Record<DecisionRecordStatus, { pill: string; rank: number }> = {
  "Pending":    { pill: "border-slate-200 bg-slate-50 text-slate-700",       rank: 1 },
  "Approved":   { pill: "border-emerald-200 bg-emerald-50 text-emerald-700", rank: 2 },
  "Rejected":   { pill: "border-rose-200 bg-rose-50 text-rose-700",          rank: 3 },
  "Superseded": { pill: "border-slate-200 bg-slate-100 text-slate-500",      rank: 4 },
};

const STATUSES: (DecisionRecordStatus | "All")[] = ["All", "Pending", "Approved", "Rejected", "Superseded"];

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type DrawerState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; decision: DecisionRecord };

export function DecisionsGrid() {
  const { activeProjectId } = useProject();
  const decisions          = useEntityStore((s) => s.decisionRecords);
  const addDecision        = useEntityStore((s) => s.addDecisionRecord);
  const updateDecision     = useEntityStore((s) => s.updateDecisionRecord);
  const deleteDecision     = useEntityStore((s) => s.deleteDecisionRecord);

  const [filterStatus, setFilterStatus] = useState<DecisionRecordStatus | "All">("All");
  const [filterMine,   setFilterMine]   = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });

  const projectDecisions = decisions.filter((d) => d.projectId === activeProjectId);

  const filtered = projectDecisions
    .filter((d) => filterStatus === "All" || d.status === filterStatus)
    .filter((d) => !filterMine || d.decidedBy === "VP")
    .slice()
    .sort((a, b) => {
      // Sort: newest decisions first, but Superseded goes to the bottom
      const rankDiff = statusStyles[a.status].rank - statusStyles[b.status].rank;
      if (a.status === "Superseded" && b.status !== "Superseded") return 1;
      if (b.status === "Superseded" && a.status !== "Superseded") return -1;
      if (rankDiff !== 0) return rankDiff;
      return b.decidedDate.localeCompare(a.decidedDate);
    });

  // Counts pill
  const pendingCount    = projectDecisions.filter((d) => d.status === "Pending").length;
  const approvedCount   = projectDecisions.filter((d) => d.status === "Approved").length;
  const rejectedCount   = projectDecisions.filter((d) => d.status === "Rejected").length;
  const supersededCount = projectDecisions.filter((d) => d.status === "Superseded").length;

  // Lookup map for supersession trail
  const byId = new Map(projectDecisions.map((d) => [d.id, d]));

  function handleSave(d: DecisionRecord) {
    const withProj: DecisionRecord = { ...d, projectId: d.projectId || activeProjectId };
    const exists = decisions.some((x) => x.id === withProj.id);
    if (exists) {
      updateDecision(withProj);
      toast.success("Decision updated", { description: withProj.title });
    } else {
      addDecision(withProj);
      toast.success("Decision recorded", { description: withProj.title });
    }
    setDrawer({ mode: "closed" });
  }

  function handleDelete(id: string) {
    const target = decisions.find((x) => x.id === id);
    deleteDecision(id);
    toast.success("Decision deleted", { description: target?.title });
    setDrawer({ mode: "closed" });
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {approvedCount} approved · {pendingCount} pending
        </span>
        {rejectedCount > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
            {rejectedCount} rejected
          </span>
        )}
        {supersededCount > 0 && (
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {supersededCount} superseded
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setFilterMine((v) => !v)}
          title={filterMine ? "Showing decisions you made" : "Show decisions you made"}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
            filterMine
              ? "bg-primary/10 text-primary"
              : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Mine
        </button>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as DecisionRecordStatus | "All")}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>

        <button
          onClick={() => setDrawer({ mode: "new" })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Record decision
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <Scale className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            {projectDecisions.length === 0 ? "No decisions recorded yet" : "No decisions match the current filters"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {projectDecisions.length === 0
              ? "Record the first decision when a material choice gets made — vendor pick, methodology, scope."
              : "Try clearing the status filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => {
            const stat = statusStyles[d.status];
            const supersedes = d.supersedesId ? byId.get(d.supersedesId) : null;
            const supersededBy = projectDecisions.find((x) => x.supersedesId === d.id);
            return (
              <li
                key={d.id}
                onClick={() => setDrawer({ mode: "edit", decision: d })}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-sm cursor-pointer transition-colors hover:bg-muted/20",
                  d.status === "Superseded" && "opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">{d.id.toUpperCase()}</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", stat.pill)}>
                        {d.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Decided {formatDate(d.decidedDate)} · by {d.decidedBy}
                      </span>
                    </div>
                    <h3 className="mt-1 truncate text-sm font-medium text-foreground" title={d.title}>
                      {d.title}
                    </h3>
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted-foreground line-clamp-2" title={d.context}>
                  {d.context}
                </p>

                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chosen</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">{d.chosenOption}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Alternatives considered ({d.alternatives.length})
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.alternatives.length} option{d.alternatives.length === 1 ? "" : "s"} — click to see
                    </p>
                  </div>
                </div>

                {/* Supersession trail */}
                {(supersedes || supersededBy) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-[10px] text-slate-700">
                    {supersedes && (
                      <>
                        <span className="font-medium">Supersedes</span>
                        <span className="font-mono font-bold">{supersedes.id.toUpperCase()}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="truncate" title={supersedes.title}>{supersedes.title}</span>
                      </>
                    )}
                    {supersededBy && (
                      <>
                        <span className="font-medium">Superseded by</span>
                        <span className="font-mono font-bold">{supersededBy.id.toUpperCase()}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="truncate" title={supersededBy.title}>{supersededBy.title}</span>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <DecisionFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.decision : null}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />
    </div>
  );
}
