"use client";

import { useMemo } from "react";
import { Lock } from "lucide-react";
import type { Milestone, MilestoneStatus } from "@/lib/mockData";
import {
  computeCriticalPath,
  type ScheduleMilestone,
} from "@/lib/domain/scheduling";
import { useSettings } from "@/lib/settingsStore";
import { cn } from "@/lib/utils";

const TODAY = "2026-05-11";
const PX_PER_DAY = 3;          // 3 px per calendar day → ~270 days fits in ~810 px
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toId(id: string) {
  return parseInt(id.replace("m", ""), 10);
}

function isoToDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function daysBetween(a: string, b: string): number {
  return Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 86_400_000);
}

function addCalendarDays(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthShort(d: Date): string {
  return d.toLocaleString("en", { month: "short" });
}

// Derive plannedStart from plannedDate + duration when not stored on the entity.
function deriveStart(m: Milestone): string {
  const dur = m.duration ?? 1;
  return addCalendarDays(m.plannedDate, -(dur - 1));
}

// ─── Bar status colours (match RAG / status semantics from the grid) ─────────

const barStyle: Record<MilestoneStatus, { fill: string; border: string }> = {
  complete:    { fill: "bg-emerald-500",        border: "border-emerald-600" },
  "in-progress": { fill: "bg-blue-500",         border: "border-blue-600"    },
  "at-risk":   { fill: "bg-amber-500",          border: "border-amber-600"   },
  pending:     { fill: "bg-slate-400",          border: "border-slate-500"   },
};

const criticalBarStyle = { fill: "bg-rose-500", border: "border-rose-600" };

// ─── Main component ─────────────────────────────────────────────────────────

export function GanttView({
  milestones,
  onEditMilestone,
}: {
  milestones: Milestone[];   // already filtered to active project + page filters
  onEditMilestone: (m: Milestone) => void;
}) {
  const { settings } = useSettings();

  // Project range + critical-path computation (memoised)
  const { rangeStart, totalDays, monthMarks, todayOffset, criticalIds, slackById, sorted } = useMemo(() => {
    if (milestones.length === 0) {
      return {
        rangeStart: TODAY, totalDays: 30,
        monthMarks: [] as { label: string; offsetDays: number }[],
        todayOffset: 0, criticalIds: new Set<number>(), slackById: {} as Record<number, number>,
        sorted: [] as Milestone[],
      };
    }

    // Date span: min(start) → max(end), padded by 7 days each side for breathing room
    const starts = milestones.map(deriveStart);
    const ends   = milestones.map((m) => m.plannedDate);
    const minStart = starts.reduce((a, b) => (a < b ? a : b));
    const maxEnd   = ends.reduce((a, b) => (a > b ? a : b));
    const padStart = addCalendarDays(minStart, -7);
    const padEnd   = addCalendarDays(maxEnd, 7);
    const total    = daysBetween(padStart, padEnd) + 1;

    // Month boundaries (first day of each month in range)
    const marks: { label: string; offsetDays: number }[] = [];
    const cursor = isoToDate(padStart);
    cursor.setUTCDate(1);
    while (cursor.toISOString().slice(0, 10) <= padEnd) {
      const iso = cursor.toISOString().slice(0, 10);
      const offset = daysBetween(padStart, iso);
      if (offset >= 0 && offset <= total) {
        marks.push({ label: `${monthShort(cursor)} ${String(cursor.getUTCFullYear()).slice(2)}`, offsetDays: offset });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    // Critical path using the cascade-engine input shape
    const scheduleMs: ScheduleMilestone[] = milestones.map((m) => ({
      id: toId(m.id),
      predecessor: m.predecessor ? toId(m.predecessor) : undefined,
      lag: m.lag ?? 0,
      duration: m.duration ?? 1,
      plannedStart: deriveStart(m),
      plannedEnd: m.plannedDate,
      status: m.status,
      lockDate: m.locked,
    }));
    const cp = computeCriticalPath(scheduleMs, settings.workingDays, settings.holidays);

    // Sort by plannedStart for stable top-down reading
    const sortedMs = milestones.slice().sort((a, b) => deriveStart(a).localeCompare(deriveStart(b)));

    return {
      rangeStart: padStart,
      totalDays: total,
      monthMarks: marks,
      todayOffset: daysBetween(padStart, TODAY),
      criticalIds: cp.criticalIds,
      slackById: cp.slackById,
      sorted: sortedMs,
    };
  }, [milestones, settings.workingDays, settings.holidays]);

  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No milestones to plot.</p>
        <p className="mt-1 text-xs text-muted-foreground">Add a milestone or clear filters to populate the Gantt.</p>
      </div>
    );
  }

  const timelineWidth = totalDays * PX_PER_DAY;
  const todayWithin   = todayOffset >= 0 && todayOffset <= totalDays;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-rose-500 inline-block" />
          Critical path
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-blue-500 inline-block" />
          In progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-amber-500 inline-block" />
          At risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-emerald-500 inline-block" />
          Complete
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-slate-400 inline-block" />
          Pending
        </span>
        <span className="ml-auto">
          <span className="font-semibold text-foreground">{criticalIds.size}</span> of {milestones.length} on critical path
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <div className="flex min-w-fit">
          {/* Left rail: milestone names */}
          <div className="shrink-0 border-r border-border bg-muted/20">
            <div className="border-b border-border bg-muted/40 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ height: HEADER_HEIGHT, lineHeight: `${HEADER_HEIGHT}px` }}>
              Milestone
            </div>
            {sorted.map((m) => {
              const isCritical = criticalIds.has(toId(m.id));
              const slack = slackById[toId(m.id)] ?? 0;
              return (
                <button
                  key={m.id}
                  onClick={() => onEditMilestone(m)}
                  title={`${m.name} — click to edit`}
                  className={cn(
                    "flex w-64 items-center gap-2 border-b border-border px-4 text-left transition-colors hover:bg-muted/40",
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  {m.locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {m.name}
                  </span>
                  {isCritical ? (
                    <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0 text-[9px] font-bold text-rose-700">
                      CP
                    </span>
                  ) : slack > 0 ? (
                    <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground" title={`${slack} working days slack`}>
                      +{slack}d
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth }}>
            {/* Month header */}
            <div
              className="relative border-b border-border bg-muted/40"
              style={{ height: HEADER_HEIGHT }}
            >
              {monthMarks.map((mark, i) => {
                const next = monthMarks[i + 1];
                const widthPx = next ? (next.offsetDays - mark.offsetDays) * PX_PER_DAY : (totalDays - mark.offsetDays) * PX_PER_DAY;
                return (
                  <div
                    key={mark.label + i}
                    className="absolute top-0 flex h-full items-center border-l border-border/50 pl-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ left: mark.offsetDays * PX_PER_DAY, width: widthPx }}
                  >
                    {mark.label}
                  </div>
                );
              })}
            </div>

            {/* Background grid + today line */}
            <div className="absolute inset-x-0 top-0" style={{ top: HEADER_HEIGHT, height: sorted.length * ROW_HEIGHT }}>
              {monthMarks.map((mark) => (
                <div
                  key={`grid-${mark.label}`}
                  className="absolute top-0 h-full border-l border-border/40"
                  style={{ left: mark.offsetDays * PX_PER_DAY }}
                />
              ))}
              {todayWithin && (
                <div
                  className="absolute top-0 h-full border-l-2 border-primary"
                  style={{ left: todayOffset * PX_PER_DAY }}
                  title="Today"
                >
                  <span className="absolute -top-0 -translate-x-1/2 rounded-b bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    TODAY
                  </span>
                </div>
              )}
            </div>

            {/* Bars */}
            {sorted.map((m) => {
              const start = deriveStart(m);
              const end   = m.plannedDate;
              const offsetDays = daysBetween(rangeStart, start);
              const widthDays  = Math.max(daysBetween(start, end) + 1, 1);
              const isCritical = criticalIds.has(toId(m.id));
              const style = isCritical ? criticalBarStyle : barStyle[m.status];

              const forecastSlip = m.forecastDate > end
                ? daysBetween(end, m.forecastDate)
                : 0;

              return (
                <div
                  key={m.id}
                  className="relative border-b border-border"
                  style={{ height: ROW_HEIGHT }}
                >
                  <button
                    onClick={() => onEditMilestone(m)}
                    title={`${m.name}\n${start} → ${end}${forecastSlip > 0 ? `\nForecast +${forecastSlip}d` : ""}`}
                    className={cn(
                      "group absolute flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] font-semibold text-white shadow-sm transition-transform hover:scale-y-110 hover:shadow",
                      style.fill,
                      style.border,
                    )}
                    style={{
                      left: offsetDays * PX_PER_DAY,
                      width: Math.max(widthDays * PX_PER_DAY, 14),
                      top: (ROW_HEIGHT - 20) / 2,
                    }}
                  >
                    <span className="truncate">{m.id.toUpperCase()}</span>
                  </button>
                  {/* Forecast slip indicator — striped extension beyond planned end */}
                  {forecastSlip > 0 && (
                    <div
                      className="absolute h-1.5 rounded-r bg-gradient-to-r from-rose-400/60 to-rose-400/20"
                      style={{
                        left: (offsetDays + widthDays) * PX_PER_DAY,
                        width: forecastSlip * PX_PER_DAY,
                        top: ROW_HEIGHT / 2 - 1,
                      }}
                      title={`Forecast slip: +${forecastSlip}d`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="px-1 text-[11px] text-muted-foreground">
        Click any milestone bar or its name to edit. Bars in rose are on the critical path (zero slack). Striped extensions indicate forecast slippage beyond planned.
      </p>
    </div>
  );
}
