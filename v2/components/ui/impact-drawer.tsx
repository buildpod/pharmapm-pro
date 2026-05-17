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
  // M20.6 — optional grouping bucket (workstream for tasks, phase for milestones).
  // If any row in a section has a `group`, the drawer renders collapsible
  // sub-sections per group. Sections where no row sets `group` render flat.
  group?: string;
  // M20.6 — ancestry trace for transitive proposals. E.g. a milestone shift
  // driven by a task push surfaces as "← driven by T1". Caller supplies a
  // short human-readable hint string. Renders as a small caption below the name.
  ancestry?: string;
}

export interface ViolationRow {
  id: string;
  name?: string;
  message: string;
}

// M20.3 — read-only info row (blue tone). Used for "slack created" entries
// where a milestone moving later leaves linked tasks with headroom — no shift
// required, just a positive informational nudge.
export interface InfoRow {
  id: string;
  name?: string;
  oldDate: string;       // e.g. task due
  newDate: string;       // e.g. milestone new planned
  slackDays: number;     // working-day slack gained
}

// M21-DrawerRewrite — single info card with title + body + optional
// collapsible item list + optional action button. Used for partial-success
// states (e.g. cycle-blocked preview where the user's edit still saved).
// Always tone-matched to outcome (amber for partial-success, blue for info,
// slate for neutral) — never rose.
export interface CalloutSection {
  kind: "callout";
  tone: "amber" | "blue" | "slate";
  title: string;
  body: string;
  collapsibleLabel?: string;          // e.g. "Show 10 tasks in the loop"
  collapsibleItems?: { id: string; name?: string; group?: string }[];
  actionLabel?: string;                // e.g. "Open Tasks page"
  onAction?: () => void;
}

export type ImpactSection =
  | { kind: "milestones"; title: string; rows: ImpactRow[] }
  | { kind: "tasks";      title: string; rows: ImpactRow[] }
  | { kind: "warnings";   title: string; rows: ViolationRow[] }
  | { kind: "info";       title: string; rows: InfoRow[] }
  | CalloutSection;

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

// ─── Mini-timeline (M20.6) ──────────────────────────────────────────────────
//
// A thin horizontal bar showing each row's old → new position on a shared
// axis scaled to the drawer's full date range. Two markers:
//   - old position: small grey tick
//   - new position: solid colored pill (rose if forward, emerald if backward)
// A colored segment connects them. Gives PMs the *shape* of the shift at a
// glance — far more legible than reading two ISO dates and computing the delta.

function MiniTimeline({
  tMin, tMax, oldDate, newDate, daysShifted, excluded,
}: {
  tMin: string; tMax: string;
  oldDate: string; newDate: string;
  daysShifted: number;
  excluded?: boolean;
}) {
  if (!tMin || !tMax || tMin === tMax) return null;
  const minMs = new Date(tMin).getTime();
  const maxMs = new Date(tMax).getTime();
  const span  = maxMs - minMs;
  if (span <= 0) return null;
  const pct = (d: string) => {
    const ms = new Date(d).getTime();
    return Math.max(0, Math.min(100, ((ms - minMs) / span) * 100));
  };
  const oldPct = pct(oldDate);
  const newPct = pct(newDate);
  const segStart = Math.min(oldPct, newPct);
  const segWidth = Math.max(0.5, Math.abs(newPct - oldPct));
  const forwardShift = daysShifted > 0;

  return (
    <div
      className={cn(
        "relative mt-2 h-1.5 w-full rounded-full bg-muted",
        excluded && "opacity-40"
      )}
      aria-hidden
    >
      {/* connecting segment */}
      <div
        className={cn(
          "absolute top-0 h-1.5 rounded-full",
          forwardShift ? "bg-rose-300" : "bg-emerald-300"
        )}
        style={{ left: `${segStart}%`, width: `${segWidth}%` }}
      />
      {/* old marker — grey tick */}
      <div
        className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-muted-foreground/60"
        style={{ left: `${oldPct}%` }}
        title={`Before: ${oldDate}`}
      />
      {/* new marker — colored solid pill */}
      <div
        className={cn(
          "absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm shadow-sm",
          forwardShift ? "bg-rose-600" : "bg-emerald-600"
        )}
        style={{ left: `${newPct}%` }}
        title={`After: ${newDate}`}
      />
    </div>
  );
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

  // M20.6 — info-kind rows aren't shifts; they're read-only nudges.
  // Strictly count only milestones + tasks for shift totals.
  const shiftRows = sections
    .filter((s): s is Extract<ImpactSection, { kind: "milestones" | "tasks" }> =>
      s.kind === "milestones" || s.kind === "tasks")
    .flatMap((s) => s.rows);
  const includedShifts = shiftRows.filter((r) => !excludeIds.has(r.id)).length;
  const totalShifts = shiftRows.length;

  // M20.6 — compute timeline range across the originator + every shift row so
  // each row's mini-timeline bar is scaled to the same axis. Falls back to a
  // single-point window if all dates collide (rare in practice).
  const allDates: string[] = [summary.oldDate, summary.newDate];
  sections.forEach((s) => {
    if (s.kind === "milestones" || s.kind === "tasks") {
      s.rows.forEach((r) => { allDates.push(r.oldDate, r.newDate); });
    } else if (s.kind === "info") {
      s.rows.forEach((r) => { allDates.push(r.oldDate, r.newDate); });
    }
  });
  const validDates = allDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const tMin = validDates.length ? validDates.reduce((a, b) => a < b ? a : b) : "";
  const tMax = validDates.length ? validDates.reduce((a, b) => a > b ? a : b) : "";

  const totalWarnings = sections
    .filter((s): s is Extract<ImpactSection, { kind: "warnings" }> => s.kind === "warnings")
    .flatMap((s) => s.rows)
    .length;

  const totalInfo = sections
    .filter((s): s is Extract<ImpactSection, { kind: "info" }> => s.kind === "info")
    .flatMap((s) => s.rows)
    .length;

  // M21-DrawerRewrite — detect a callout section. Used to know we're in a
  // partial-success state (e.g. cycle blocked preview) so the Save button can
  // label itself honestly. Replaces the prior engine-error detection.
  const hasCallout = sections.some((s) => s.kind === "callout");

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
              <h2 className="text-base font-semibold text-foreground">Schedule change preview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Review what will change. Uncheck a row to keep its date, or pick a different date inline.
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

          {/* Totals strip — M21-DrawerRewrite cleanup. When callout state
              (partial success / preview unavailable), don't pretend totalShifts
              means anything; show a single quiet "preview unavailable" chip. */}
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            {hasCallout ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                preview unavailable
              </span>
            ) : (
              <span className={cn(
                "rounded-full border px-2 py-0.5 font-semibold",
                totalShifts === 0
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}>
                {totalShifts === 0
                  ? "Nothing else changes"
                  : `${includedShifts} of ${totalShifts} included`}
              </span>
            )}
            {totalWarnings > 0 && (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                {totalWarnings} to review
              </span>
            )}
            {Object.keys(overrides).length > 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                {Object.keys(overrides).length} edited
              </span>
            )}
            {totalInfo > 0 && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                {totalInfo} gained slack
              </span>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {totalShifts === 0 && totalWarnings === 0 && totalInfo === 0 && !hasCallout ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
              <Info className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Nothing else will change</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Save to apply this change. No other tasks or milestones are affected.
              </p>
            </div>
          ) : (
            sections.map((section, sIdx) => {
              // Callouts render even with no items; other kinds skip when empty
              if (section.kind !== "callout" && section.rows.length === 0) return null;
              return (
                <Section
                  key={sIdx}
                  section={section}
                  excludeIds={excludeIds}
                  overrides={overrides}
                  onToggle={toggleExclude}
                  onOverride={setOverride}
                  onClearOverride={clearOverride}
                  tMin={tMin}
                  tMax={tMax}
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
              {/* M21-DrawerRewrite — Save semantics. Drops "Apply edit"
                  jargon (per ui-string-audit skill). Drops "shifts" in favor
                  of "changes". Callout state (preview unavailable) reads as
                  partial success — Save with quiet status indicator. */}
              {hasCallout
                ? "Save change"
                : totalShifts === 0
                  ? "Save"
                  : includedShifts === 0
                    ? "Save · this change only"
                    : `Save · ${includedShifts + 1} change${(includedShifts + 1) === 1 ? "" : "s"}`}
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
  tMin,
  tMax,
}: {
  section: ImpactSection;
  excludeIds: Set<string>;
  overrides: Record<string, string>;
  onToggle: (id: string) => void;
  onOverride: (id: string, newDate: string) => void;
  onClearOverride: (id: string) => void;
  tMin: string;
  tMax: string;
}) {
  // M21-DrawerRewrite — callouts get their own rendering path (no row list).
  if (section.kind === "callout") {
    return <Callout section={section} />;
  }

  const sectionStyle =
    section.kind === "warnings"
      ? "border-rose-200 bg-rose-50/40"
      : section.kind === "milestones"
        ? "border-blue-200 bg-blue-50/40"
        : section.kind === "info"
          ? "border-blue-200 bg-blue-50/30"
          : "border-amber-200 bg-amber-50/40";

  const Icon =
    section.kind === "warnings" ? AlertTriangle
    : section.kind === "milestones" ? MilestoneIcon
    : section.kind === "info" ? Info
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
        {section.kind === "info"
          ? section.rows.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <Info className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{row.id.toUpperCase()}</span>
                    {row.name && <> · {row.name}</>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] tabular-nums text-blue-700">
                    <span>{row.oldDate}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{row.newDate}</span>
                    <span className="ml-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] font-bold text-blue-700">
                      +{row.slackDays}d slack
                    </span>
                  </p>
                </div>
              </li>
            ))
          : section.kind === "warnings"
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
          : renderShiftRows(section.rows, section.kind, {
              excludeIds, overrides, onToggle, onOverride, onClearOverride, tMin, tMax,
            })}
      </ul>
    </section>
  );
}

// ─── Shift rows renderer — handles grouping (M20.6) ─────────────────────────

interface ShiftRowDeps {
  excludeIds: Set<string>;
  overrides: Record<string, string>;
  onToggle: (id: string) => void;
  onOverride: (id: string, newDate: string) => void;
  onClearOverride: (id: string) => void;
  tMin: string;
  tMax: string;
}

function renderShiftRows(rows: ImpactRow[], kind: "milestones" | "tasks", deps: ShiftRowDeps) {
  // M20.6 — group rows by `row.group` when at least one row has it. Single-
  // group cascades stay flat (no header noise). Groups render as collapsible
  // sub-sections.
  const hasGroups = rows.some((r) => !!r.group);
  if (!hasGroups) {
    return rows.map((row) => renderShiftRow(row, kind, deps));
  }
  const groups: Record<string, ImpactRow[]> = {};
  rows.forEach((r) => {
    const g = r.group ?? "Other";
    (groups[g] ||= []).push(r);
  });
  const orderedNames = Object.keys(groups);
  return orderedNames.map((g) => (
    <GroupBlock key={g} name={g} rows={groups[g]} kind={kind} deps={deps} />
  ));
}

function GroupBlock({
  name, rows, kind, deps,
}: {
  name: string;
  rows: ImpactRow[];
  kind: "milestones" | "tasks";
  deps: ShiftRowDeps;
}) {
  const [open, setOpen] = useState(true);
  const includedHere = rows.filter((r) => !deps.excludeIds.has(r.id)).length;
  return (
    <li className="bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5 text-left transition-colors hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className={cn("inline-block h-2 w-2 shrink-0 rounded-sm transition-transform", open ? "rotate-90" : "")}>
          ▸
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {name}
        </span>
        <span className="ml-auto rounded-full bg-card px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {includedHere}/{rows.length}
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-border">
          {rows.map((row) => renderShiftRow(row, kind, deps))}
        </ul>
      )}
    </li>
  );
}

function renderShiftRow(row: ImpactRow, kind: "milestones" | "tasks", deps: ShiftRowDeps) {
  const { excludeIds, overrides, onToggle, onOverride, onClearOverride, tMin, tMax } = deps;
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
            {kind === "milestones" && row.isCritical && (
              <span className="ml-1.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 text-[9px] font-bold text-rose-700">
                CP
              </span>
            )}
          </p>
          {/* M20.6 — ancestry caption (e.g. transitive milestone push driven by task) */}
          {row.ancestry && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground italic">
              ← driven by {row.ancestry}
            </p>
          )}
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
          {/* M20.6 — mini-timeline (skips invalid date inputs gracefully) */}
          <MiniTimeline
            tMin={tMin} tMax={tMax}
            oldDate={row.oldDate}
            newDate={excluded ? row.oldDate : (overrides[row.id] ?? row.newDate)}
            daysShifted={row.daysShifted}
            excluded={excluded}
          />
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
}

// ─── Callout sub-component (M21-DrawerRewrite) ──────────────────────────────
//
// One info card with title + body + optional collapsible item list + optional
// action button. Used for partial-success states like cycle-blocked preview.
// Tone-matched via section.tone (amber / blue / slate) — never rose.

function Callout({ section }: { section: CalloutSection }) {
  const [expanded, setExpanded] = useState(false);

  const toneStyle =
    section.tone === "amber"
      ? "border-amber-200 bg-amber-50/60"
      : section.tone === "blue"
        ? "border-blue-200 bg-blue-50/60"
        : "border-slate-200 bg-slate-50/60";
  const iconBg =
    section.tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : section.tone === "blue"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-600";
  const titleColor =
    section.tone === "amber"
      ? "text-amber-900"
      : section.tone === "blue"
        ? "text-blue-900"
        : "text-foreground";

  const hasItems = !!section.collapsibleItems && section.collapsibleItems.length > 0;
  const hasAction = !!section.actionLabel && !!section.onAction;

  return (
    <section className={cn("rounded-lg border", toneStyle)}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", iconBg)}>
          <Info className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", titleColor)}>
            {section.title}
          </p>
          <p className="mt-1 whitespace-pre-line text-xs text-foreground/80">
            {section.body}
          </p>
          {(hasItems || hasAction) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {hasItems && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[11px] font-medium text-foreground/80 hover:text-foreground hover:underline"
                  aria-expanded={expanded}
                >
                  {expanded ? "Hide" : section.collapsibleLabel ?? `Show ${section.collapsibleItems!.length} items`}
                </button>
              )}
              {hasAction && (
                <button
                  type="button"
                  onClick={section.onAction}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {section.actionLabel} →
                </button>
              )}
            </div>
          )}
          {hasItems && expanded && (
            <ul className="mt-2.5 space-y-1 rounded-md border border-border bg-card px-3 py-2">
              {section.collapsibleItems!.map((it) => (
                <li key={it.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    {it.id.toUpperCase()}
                  </span>
                  {it.name && <span className="truncate text-foreground">{it.name}</span>}
                  {it.group && <span className="ml-auto text-[10px] text-muted-foreground">{it.group}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
