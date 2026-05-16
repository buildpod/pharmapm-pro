"use client";

import { useEffect } from "react";
import { X, ArrowRight, AlertTriangle, Info, Milestone as MilestoneIcon, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Universal cascade-impact drawer (M18).
// Used by milestones-grid and tasks-grid alike. The shape:
//   - originating change (entity ID, before/after, days)
//   - sectioned list of affected items (milestones / tasks / soft warnings)
//   - Apply / Cancel buttons
// Right-anchored slide-over consistent with EntityDrawer's positioning.

export type ImpactSection =
  | {
      kind: "milestones";
      title: string;
      rows: { id: string; name?: string; oldDate: string; newDate: string; daysShifted: number; isCritical?: boolean }[];
    }
  | {
      kind: "tasks";
      title: string;
      rows: { id: string; name?: string; oldDate: string; newDate: string; daysShifted: number }[];
    }
  | {
      kind: "warnings";
      title: string;
      rows: { id: string; name?: string; message: string }[];
    };

export interface ImpactSummary {
  originatorKind: "milestone" | "task";
  originatorId: string;
  originatorName: string;
  oldDate: string;
  newDate: string;
  daysShifted: number;
}

export function ImpactDrawer({
  open,
  summary,
  sections,
  onApply,
  onCancel,
}: {
  open: boolean;
  summary: ImpactSummary;
  sections: ImpactSection[];
  onApply: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (!open) return null;

  const totalAffected = sections.reduce(
    (n, s) => n + (s.kind === "warnings" ? 0 : s.rows.length),
    0
  );
  const totalWarnings = sections
    .filter((s): s is Extract<ImpactSection, { kind: "warnings" }> => s.kind === "warnings")
    .reduce((n, s) => n + s.rows.length, 0);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />

      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Cascade impact preview"
      >
        {/* Header */}
        <header className="border-b border-border bg-muted/30 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Cascade impact</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Preview the downstream effects of this change before committing.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Cancel (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Originating change summary */}
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {summary.originatorKind === "milestone" ? <MilestoneIcon className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                <span className="font-mono text-[10px] font-bold text-muted-foreground">{summary.originatorId.toUpperCase()}</span>
                {" · "}
                {summary.originatorName}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                <span className="line-through">{summary.oldDate}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-semibold text-foreground">{summary.newDate}</span>
                {summary.daysShifted !== 0 && (
                  <span
                    className={cn(
                      "ml-1 rounded-full px-1.5 py-0 text-[10px] font-bold",
                      summary.daysShifted > 0
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    )}
                  >
                    {summary.daysShifted > 0 ? `+${summary.daysShifted}d` : `${summary.daysShifted}d`}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Totals strip */}
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-semibold",
                totalAffected === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {totalAffected === 0 ? "No downstream shifts" : `${totalAffected} item${totalAffected === 1 ? "" : "s"} will shift`}
            </span>
            {totalWarnings > 0 && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                {totalWarnings} warning{totalWarnings === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {totalAffected === 0 && totalWarnings === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
              <Info className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No cascading impact</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This change can be applied without affecting any other entity.
              </p>
            </div>
          ) : (
            sections.map((section, sIdx) => {
              if (section.rows.length === 0) return null;
              return <Section key={sIdx} section={section} />;
            })
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-border bg-muted/30 px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {totalAffected === 0 ? "Apply change" : `Apply ${totalAffected + 1} change${totalAffected === 0 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

function Section({ section }: { section: ImpactSection }) {
  const sectionStyle =
    section.kind === "warnings"
      ? "border-rose-200 bg-rose-50/40"
      : section.kind === "milestones"
        ? "border-blue-200 bg-blue-50/40"
        : "border-amber-200 bg-amber-50/40";

  const Icon =
    section.kind === "warnings" ? AlertTriangle
    : section.kind === "milestones" ? MilestoneIcon
    : CheckSquare;

  return (
    <section className={cn("rounded-lg border", sectionStyle)}>
      <div className="flex items-center gap-2 border-b border-inherit px-4 py-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {section.title}
        </p>
        <span className="ml-auto rounded-full bg-card px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {section.rows.length}
        </span>
      </div>
      <ul className="divide-y divide-border bg-card">
        {section.kind === "warnings"
          ? section.rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{row.id.toUpperCase()}</span>
                    {row.name && <> · {row.name}</>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-rose-700">{row.message}</p>
                </div>
              </li>
            ))
          : section.rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{row.id.toUpperCase()}</span>
                    {row.name && <> · {row.name}</>}
                    {section.kind === "milestones" && "isCritical" in row && row.isCritical && (
                      <span className="ml-1.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 text-[9px] font-bold text-rose-700">
                        CP
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                    <span className="line-through">{row.oldDate}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-semibold text-foreground">{row.newDate}</span>
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
                    row.daysShifted > 0
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}
                >
                  {row.daysShifted > 0 ? `+${row.daysShifted}d` : `${row.daysShifted}d`}
                </span>
              </li>
            ))}
      </ul>
    </section>
  );
}
