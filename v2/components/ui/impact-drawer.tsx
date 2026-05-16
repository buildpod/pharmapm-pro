"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, ArrowRight, AlertTriangle, Info, Milestone as MilestoneIcon, CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// M20: Universal selective-cascade impact drawer.
// - Holds local state for per-row exclusions + date overrides
// - Calls parent-provided onRecompute() on every state change to fetch
//   fresh sections + constraint violations
// - Renders per-row checkbox + editable date input
// - Apply count reflects the *current* selection, not the original cascade

// ─── Section + row shapes ────────────────────────────────────────────────────

export interface ImpactRow {
  id: string;            // task id ("t12") or milestone id ("m6" or "1" — caller decides)
  name?: string;
  oldDate: string;
  newDate: string;
  daysShifted: number;
  isCritical?: boolean;
}

export interface ViolationRow {
  id: string;
  name?: string;
  message: string;
}

export type ImpactSection =
  | { kind: "milestones"; title: string; rows: ImpactRow[] }
  | { kind: "tasks";      title: string; rows: ImpactRow[] }
  | { kind: "warnings";   title: string; rows: ViolationRow[] };

export interface ImpactSummary {
  originatorKind: "milestone" | "task";
  originatorId: string;
  originatorName: string;
  oldDate: string;
  newDate: string;
  daysShifted: number;
}

// What the parent provides on every recompute(). The drawer calls this
// whenever the user toggles include / edits a newDate, so the parent re-runs
// the cascade engine with the new opts and returns fresh sections.
export interface RecomputeResult {
  sections: ImpactSection[];
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ImpactDrawer({
  open,
  summary,
  recompute,
  onApply,
  onCancel,
}: {
  open: boolean;
  summary: ImpactSummary;
  // Pure function; called on every state change.
  recompute: (excludeIds: Set<string>, overrides: Record<string, string>) => RecomputeResult;
  // Called with the user's final selection on Apply.
  onApply: (excludeIds: Set<string>, overrides: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set());
  const [overrides,  setOverrides]  = useState<Record<string, string>>({});

  // Reset state on open (in case the drawer is re-used across edits)
  useEffect(() => { if (open) { setExcludeIds(new Set()); setOverrides({}); } }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
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

  // Recompute on every state change. Memoised on (excludeIds, overrides).
  const { sections } = useMemo(
    () => recompute(excludeIds, overrides),
    // reason: recompute is captured from props; we intentionally re-run only on state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [excludeIds, overrides]
  );

  if (!open) return null;

  const includedShifts = sections
    .filter((s): s is Extract<ImpactSection, { kind: "milestones" | "tasks" }> => s.kind !== "warnings")
    .flatMap((s) => s.rows)
    .filter((r) => !excludeIds.has(r.id))
    .length;

  const totalShifts = sections
    .filter((s): s is Extract<ImpactSection, { kind: "milestones" | "tasks" }> => s.kind !== "warnings")
    .flatMap((s) => s.rows)
    .length;

  const totalWarnings = sections
    .filter((s): s is Extract<ImpactSection, { kind: "warnings" }> => s.kind === "warnings")
    .flatMap((s) => s.rows)
    .length;

  function toggleExclude(id: string) {
    setExcludeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Also drop the override for this row if it was set (consistency)
    setOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function setOverride(id: string, newDate: string) {
    setOverrides((prev) => ({ ...prev, [id]: newDate }));
  }

  function clearOverride(id: string) {
    setOverrides((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

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
                Preview the downstream effects. Uncheck rows to absorb in buffer, or override a new date to override the engine.
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

          {/* Originating change */}
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
                  <span className={cn(
                    "ml-1 rounded-full px-1.5 py-0 text-[10px] font-bold",
                    summary.daysShifted > 0
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  )}>
                    {summary.daysShifted > 0 ? `+${summary.daysShifted}d` : `${summary.daysShifted}d`}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Totals strip */}
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className={cn(
              "rounded-full border px-2 py-0.5 font-semibold",
              includedShifts === 0 && totalShifts === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}>
              {totalShifts === 0
                ? "No downstream shifts"
                : `${includedShifts} of ${totalShifts} shift${totalShifts === 1 ? "" : "s"} included`}
            </span>
            {totalWarnings > 0 && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                {totalWarnings} violation{totalWarnings === 1 ? "" : "s"}
              </span>
            )}
            {Object.keys(overrides).length > 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                {Object.keys(overrides).length} override{Object.keys(overrides).length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {totalShifts === 0 && totalWarnings === 0 ? (
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
              return (
                <Section
                  key={sIdx}
                  section={section}
                  excludeIds={excludeIds}
                  overrides={overrides}
                  onToggle={toggleExclude}
                  onOverride={setOverride}
                  onClearOverride={clearOverride}
                />
              );
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
              onClick={() => onApply(excludeIds, overrides)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {totalShifts === 0
                ? "Apply change"
                : `Apply ${includedShifts + 1} of ${totalShifts + 1} changes`}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Section sub-component ──────────────────────────────────────────────────

function Section({
  section,
  excludeIds,
  overrides,
  onToggle,
  onOverride,
  onClearOverride,
}: {
  section: ImpactSection;
  excludeIds: Set<string>;
  overrides: Record<string, string>;
  onToggle: (id: string) => void;
  onOverride: (id: string, newDate: string) => void;
  onClearOverride: (id: string) => void;
}) {
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
          : section.rows.map((row) => {
              const excluded = excludeIds.has(row.id);
              const hasOverride = row.id in overrides;
              return (
                <li key={row.id} className={cn("px-4 py-2.5 transition-opacity", excluded && "opacity-50")}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => onToggle(row.id)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
                      title={excluded ? "Include in cascade" : "Exclude — keep this row's date"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">{row.id.toUpperCase()}</span>
                        {row.name && <> · {row.name}</>}
                        {section.kind === "milestones" && row.isCritical && (
                          <span className="ml-1.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 text-[9px] font-bold text-rose-700">
                            CP
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] tabular-nums">
                        <span className="text-muted-foreground line-through">{row.oldDate}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {excluded ? (
                          <span className="font-semibold text-muted-foreground italic">unchanged</span>
                        ) : (
                          <>
                            <input
                              type="date"
                              value={row.newDate}
                              onChange={(e) => onOverride(row.id, e.target.value)}
                              className={cn(
                                "rounded border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                                hasOverride ? "border-blue-300" : "border-border"
                              )}
                              title={hasOverride ? "Override (engine would have suggested differently)" : "Suggested by engine — edit to override"}
                            />
                            {hasOverride && (
                              <button
                                onClick={() => onClearOverride(row.id)}
                                className="text-[10px] font-medium text-blue-700 hover:underline"
                                title="Revert to engine-suggested date"
                              >
                                ↺ revert
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {!excluded && (
                      <span className={cn(
                        "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums",
                        row.daysShifted > 0
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}>
                        {row.daysShifted > 0 ? `+${row.daysShifted}d` : `${row.daysShifted}d`}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
      </ul>
    </section>
  );
}
