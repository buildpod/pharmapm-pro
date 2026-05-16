"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";
import { validateProjectState, type IssueSeverity } from "@/lib/validation/project-validator";
import { cn } from "@/lib/utils";

// M20.2: user-visible payoff for the architectural refactor.
// Runs the cross-entity validator against the active project's state and
// surfaces a health score + top issues. Reactive — refreshes automatically
// when any entity changes.

const severityStyle: Record<IssueSeverity, string> = {
  high:   "border-rose-200    bg-rose-50    text-rose-700",
  medium: "border-amber-200   bg-amber-50   text-amber-700",
  low:    "border-slate-200   bg-slate-50   text-slate-700",
};

const entityKindHref: Record<string, string> = {
  milestone: "/milestones",
  task:      "/tasks",
  risk:      "/risks",
  document:  "/documents",
  costLine:  "/costs",
  project:   "/projects",
};

export function ProjectHealth() {
  const { activeProject, activeProjectId } = useProject();
  const milestones = useEntityStore((s) => s.milestones);
  const tasks      = useEntityStore((s) => s.tasks);
  const risks      = useEntityStore((s) => s.risks);
  const documents  = useEntityStore((s) => s.documents);
  const costLines  = useEntityStore((s) => s.costLines);

  const result = useMemo(() => {
    return validateProjectState({
      project:    activeProject,
      milestones: milestones.filter((m) => m.projectId === activeProjectId),
      tasks:      tasks.filter((t) => t.projectId === activeProjectId),
      risks:      risks.filter((r) => r.projectId === activeProjectId),
      documents:  documents.filter((d) => d.projectId === activeProjectId),
      costLines:  costLines.filter((c) => c.projectId === activeProjectId),
    });
  }, [activeProject, activeProjectId, milestones, tasks, risks, documents, costLines]);

  const { healthScore, issues, totalsBy } = result;
  const scoreTone =
    healthScore >= 90 ? "emerald" : healthScore >= 70 ? "amber" : "rose";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Project Health</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {totalsBy.high > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
              {totalsBy.high} high
            </span>
          )}
          {totalsBy.medium > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
              {totalsBy.medium} medium
            </span>
          )}
          {totalsBy.low > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
              {totalsBy.low} low
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className={cn(
            "text-3xl font-bold tabular-nums leading-none",
            scoreTone === "emerald" ? "text-emerald-600"
            : scoreTone === "amber" ? "text-amber-600"
            : "text-rose-600"
          )}>
            {healthScore}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              scoreTone === "emerald" ? "bg-emerald-500"
              : scoreTone === "amber" ? "bg-amber-500"
              : "bg-rose-500"
            )}
            style={{ width: `${healthScore}%` }}
          />
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>No cross-entity issues detected — project data is clean.</span>
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {issues.slice(0, 5).map((issue) => (
            <li key={issue.id}>
              <Link
                href={entityKindHref[issue.entityKind] ?? "/"}
                className={cn(
                  "group flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition-colors hover:shadow-sm",
                  severityStyle[issue.severity]
                )}
              >
                <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{issue.rule}</p>
                  <p className="mt-0.5 opacity-80">{issue.message}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
              </Link>
            </li>
          ))}
          {issues.length > 5 && (
            <li className="px-3 py-1 text-[11px] text-muted-foreground">
              + {issues.length - 5} more — fix the highlighted items to clear them
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
