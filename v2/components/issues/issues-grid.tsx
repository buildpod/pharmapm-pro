"use client";

// M24 — Issues grid. Mirrors the Risks pattern (cross-entity-parity skill)
// but with a flat severity model and a status lifecycle (Open → In Progress →
// Resolved / Won't Fix) instead of the probability × impact matrix.
//
// Tone discipline: rose Critical / amber High / slate Medium-Low / emerald
// Resolved / muted Won't Fix.

import { useState } from "react";
import { toast } from "sonner";
import { Plus, AlertOctagon, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntityStore } from "@/lib/stores/entity-store";
import { useProject } from "@/components/projects/project-provider";
import { type Issue, type IssueSeverity, type IssueStatus } from "@/lib/mockData";
import { IssueFormDrawer } from "./issue-form";

const severityStyles: Record<IssueSeverity, { pill: string; dot: string; rank: number }> = {
  Critical: { pill: "border-rose-200 bg-rose-50 text-rose-700",       dot: "bg-rose-500",   rank: 4 },
  High:     { pill: "border-amber-200 bg-amber-50 text-amber-700",    dot: "bg-amber-500",  rank: 3 },
  Medium:   { pill: "border-slate-200 bg-slate-50 text-slate-700",    dot: "bg-slate-400",  rank: 2 },
  Low:      { pill: "border-slate-200 bg-slate-50 text-slate-500",    dot: "bg-slate-300",  rank: 1 },
};

const statusStyles: Record<IssueStatus, { pill: string; rank: number }> = {
  "Open":        { pill: "border-rose-200 bg-rose-50 text-rose-700",       rank: 1 },
  "In Progress": { pill: "border-blue-200 bg-blue-50 text-blue-700",       rank: 2 },
  "Resolved":    { pill: "border-emerald-200 bg-emerald-50 text-emerald-700", rank: 3 },
  "Won't Fix":   { pill: "border-slate-200 bg-slate-100 text-slate-600",    rank: 4 },
};

const SEVERITIES: (IssueSeverity | "All")[] = ["All", "Critical", "High", "Medium", "Low"];
const STATUSES:   (IssueStatus | "All")[]   = ["All", "Open", "In Progress", "Resolved", "Won't Fix"];

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type DrawerState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; issue: Issue };

export function IssuesGrid() {
  const { activeProjectId } = useProject();
  const issues             = useEntityStore((s) => s.issues);
  const addIssue           = useEntityStore((s) => s.addIssue);
  const updateIssue        = useEntityStore((s) => s.updateIssue);
  const deleteIssueAction  = useEntityStore((s) => s.deleteIssue);

  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | "All">("All");
  const [filterStatus,   setFilterStatus]   = useState<IssueStatus   | "All">("All");
  const [filterMine,     setFilterMine]     = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });

  const projectIssues = issues.filter((i) => i.projectId === activeProjectId);

  const filtered = projectIssues
    .filter((i) => filterSeverity === "All" || i.severity === filterSeverity)
    .filter((i) => filterStatus   === "All" || i.status   === filterStatus)
    .filter((i) => !filterMine || i.owner === "VP")
    .slice()
    // Sort: open severity first, then resolved
    .sort((a, b) => {
      const statusDiff = statusStyles[a.status].rank - statusStyles[b.status].rank;
      if (statusDiff !== 0) return statusDiff;
      return severityStyles[b.severity].rank - severityStyles[a.severity].rank;
    });

  // Counts pill
  const openCount     = projectIssues.filter((i) => i.status === "Open").length;
  const inProgCount   = projectIssues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = projectIssues.filter((i) => i.status === "Resolved").length;
  const criticalOpen  = projectIssues.filter((i) => i.severity === "Critical" && (i.status === "Open" || i.status === "In Progress")).length;

  function handleSave(it: Issue) {
    const withProj: Issue = { ...it, projectId: it.projectId || activeProjectId };
    const exists = issues.some((x) => x.id === withProj.id);
    if (exists) {
      updateIssue(withProj);
      toast.success("Issue updated", { description: withProj.title });
    } else {
      addIssue(withProj);
      toast.success("Issue raised", { description: withProj.title });
    }
    setDrawer({ mode: "closed" });
  }

  function handleDelete(id: string) {
    const target = issues.find((x) => x.id === id);
    deleteIssueAction(id);
    toast.success("Issue deleted", { description: target?.title });
    setDrawer({ mode: "closed" });
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {openCount + inProgCount} open · {resolvedCount} resolved
        </span>
        {criticalOpen > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
            {criticalOpen} critical to clear
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setFilterMine((v) => !v)}
          title={filterMine ? "Showing only issues you own" : "Show only issues you own"}
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
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as IssueSeverity | "All")}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === "All" ? "All severities" : s}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as IssueStatus | "All")}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>

        <button
          onClick={() => setDrawer({ mode: "new" })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Raise Issue
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <AlertOctagon className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            {projectIssues.length === 0 ? "No issues raised yet" : "No issues match the current filters"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {projectIssues.length === 0
              ? "Raise the first issue when something starts blocking the project."
              : "Try clearing severity or status filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <div className="grid grid-cols-[1fr_90px_110px_60px_100px_100px] gap-0 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Issue</div>
            <div>Severity</div>
            <div>Status</div>
            <div>Owner</div>
            <div>Raised</div>
            <div>Resolved</div>
          </div>

          <ul className="divide-y divide-border">
            {filtered.map((it) => {
              const sev = severityStyles[it.severity];
              const stat = statusStyles[it.status];
              return (
                <li
                  key={it.id}
                  onClick={() => setDrawer({ mode: "edit", issue: it })}
                  className="grid grid-cols-[1fr_90px_110px_60px_100px_100px] gap-0 items-center px-5 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", sev.dot)} />
                      <p className="truncate text-sm font-medium text-foreground" title={it.title}>
                        {it.title}
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={it.description}>
                      {it.description}
                    </p>
                  </div>
                  <div>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", sev.pill)}>
                      {it.severity}
                    </span>
                  </div>
                  <div>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", stat.pill)}>
                      {it.status}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-foreground">{it.owner}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{formatDate(it.raisedDate)}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {it.resolvedDate ? formatDate(it.resolvedDate) : "—"}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-muted/20 px-5 py-3 text-[11px]">
            <span className="font-semibold text-muted-foreground">Severity:</span>
            {(["Critical", "High", "Medium", "Low"] as const).map((s) => (
              <span key={s} className={cn("rounded-full border px-2 py-0.5 font-semibold", severityStyles[s].pill)}>
                {s}
              </span>
            ))}
            <span className="mx-1 text-border">·</span>
            <span className="font-semibold text-muted-foreground">Status:</span>
            {(["Open", "In Progress", "Resolved", "Won't Fix"] as const).map((s) => (
              <span key={s} className={cn("rounded-full border px-2 py-0.5 font-semibold", statusStyles[s].pill)}>
                {s}
              </span>
            ))}
            <span className="mx-1 text-border">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Filter className="h-3 w-3" /> Click a row to edit
            </span>
          </div>
        </div>
      )}

      <IssueFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.issue : null}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />
    </div>
  );
}
