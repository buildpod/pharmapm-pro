"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Calendar,
  RotateCcw,
  Plus,
} from "lucide-react";
import { milestones as initialMilestones, type Milestone, type MilestoneStatus } from "@/lib/mockData";
import {
  computeRAG,
  computeDependencyStatus,
  cascade,
  scheduleBackward,
  previewCascade,
  previewMilestoneToTaskImpact,
  computeCriticalPath,
  type ScheduleMilestone,
  type TaskScheduleEntry,
} from "@/lib/domain/scheduling";
import { addWorkingDays } from "@/lib/domain/dates";
import { tasks as initialTasks, type Task } from "@/lib/mockData";
import { ImpactDrawer, type ImpactSummary, type ImpactSection } from "@/components/ui/impact-drawer";
import { useSettings } from "@/lib/settingsStore";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import { useProject } from "@/components/projects/project-provider";
// (Dialog imports removed in M18 — CascadePreviewDialog replaced by ImpactDrawer)
import { MilestoneFormDrawer } from "./milestone-form";
import { GanttView } from "./gantt-view";
import { LayoutGrid, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const TODAY = "2026-05-11";

// ─── Domain conversion helpers ────────────────────────────────────────────────

function toId(id: string) {
  return parseInt(id.replace("m", ""));
}

function toScheduleMs(m: Milestone): ScheduleMilestone {
  const dur = m.duration ?? 1;
  // plannedDate is the completion date (= plannedEnd); derive start from it
  const plannedStart = addWorkingDays(m.plannedDate, -(dur - 1)) ?? m.plannedDate;
  return {
    id: toId(m.id),
    predecessor: m.predecessor ? toId(m.predecessor) : undefined,
    lag: m.lag ?? 0,
    duration: dur,
    plannedStart,
    plannedEnd: m.plannedDate,
    status:
      m.status === "complete"
        ? "Complete"
        : m.status === "in-progress"
        ? "In Progress"
        : m.status === "at-risk"
        ? "Blocked"
        : "Not Started",
    lockDate: m.locked,
  };
}

function applyDomainResult(
  originals: Milestone[],
  domainResults: ScheduleMilestone[]
): Milestone[] {
  const byId: Record<number, ScheduleMilestone> = {};
  domainResults.forEach((sm) => { byId[sm.id] = sm; });
  return originals.map((m) => {
    const sm = byId[toId(m.id)];
    if (!sm) return m;
    return { ...m, plannedDate: sm.plannedEnd ?? m.plannedDate };
  });
}

// ─── Badge styles ─────────────────────────────────────────────────────────────

const ragBadge = {
  Green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Amber: "bg-amber-50 text-amber-700 border-amber-200",
  Red:   "bg-rose-50 text-rose-700 border-rose-200",
};

const depBadge = {
  Clear:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Waiting: "bg-amber-50 text-amber-700 border-amber-200",
  Blocked: "bg-rose-50 text-rose-700 border-rose-200",
};

const statusIcon = {
  complete:    { icon: CheckCircle2, cls: "text-emerald-600" },
  "in-progress": { icon: Circle,    cls: "text-blue-600"   },
  "at-risk":   { icon: AlertCircle, cls: "text-rose-600" },
  pending:     { icon: Clock,       cls: "text-muted-foreground" },
} as const;

const statusOptions: MilestoneStatus[] = ["pending", "in-progress", "at-risk", "complete"];

const phaseOptions = ["All", "Initiation", "Design", "Config", "Testing", "Training", "Go-Live"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Cascade preview state (M18) ──────────────────────────────────────────────

interface CascadePreviewState {
  affected: { id: number; name?: string; oldEnd?: string; newEnd?: string; daysShifted: number }[];
  pendingMilestones: Milestone[];
  summary: ImpactSummary;
  taskWarnings: { taskId: string; taskName?: string; taskDue: string; milestoneNewDate: string }[];
  criticalIds: Set<number>;
}

// Read persisted tasks (M16.1) — same fallback pattern as the search index.
function readPersistedTasks(): Task[] {
  if (typeof window === "undefined") return initialTasks;
  try {
    const raw = localStorage.getItem("aivello_tasks_v1");
    if (!raw) return initialTasks;
    return JSON.parse(raw) as Task[];
  } catch {
    return initialTasks;
  }
}

// (CascadePreviewDialog removed in M18 — replaced by the universal
//  <ImpactDrawer> rendered at the bottom of the grid.)

// ─── Inline date cell ─────────────────────────────────────────────────────────

function DateCell({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (newVal: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editable) {
    return <span className="text-foreground text-xs">{formatDate(value)}</span>;
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 text-xs text-foreground hover:text-primary"
        title="Click to edit"
      >
        {formatDate(value)}
        <Calendar className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 shrink-0" />
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      defaultValue={value}
      className="w-28 rounded border border-primary px-1 py-0.5 text-xs text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
      onBlur={(e) => {
        setEditing(false);
        if (e.target.value && e.target.value !== value) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const val = (e.target as HTMLInputElement).value;
          setEditing(false);
          if (val && val !== value) onCommit(val);
        }
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

// ─── Status cell — click icon to cycle status ────────────────────────────────

const nextMilestoneStatus: Record<MilestoneStatus, MilestoneStatus> = {
  pending:      "in-progress",
  "in-progress": "at-risk",
  "at-risk":    "complete",
  complete:     "pending",
};

function StatusCell({
  value,
  editable,
  onChange,
}: {
  value: MilestoneStatus;
  editable: boolean;
  onChange: (s: MilestoneStatus) => void;
}) {
  const { icon: Icon, cls } = statusIcon[value];
  if (!editable) {
    return (
      <span title={value}>
        <Icon className={cn("h-3.5 w-3.5", cls)} />
      </span>
    );
  }
  return (
    <button
      onClick={() => onChange(nextMilestoneStatus[value])}
      title={`${value} — click to mark ${nextMilestoneStatus[value]}`}
      className="hover:opacity-70 transition-opacity"
    >
      <Icon className={cn("h-3.5 w-3.5", cls)} />
    </button>
  );
}

// ─── Main grid ───────────────────────────────────────────────────────────────

type DrawerState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; milestone: Milestone };

export function MilestonesGrid() {
  const { activeProjectId, activeProject } = useProject();
  const [milestones, setMilestones] = useLocalStorageState<Milestone[]>("aivello_milestones_v1", initialMilestones);
  const [filterPhase, setFilterPhase] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterMine, setFilterMine] = useState(false);
  const [cascadePreview, setCascadePreview] = useState<CascadePreviewState | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [viewMode, setViewMode] = useState<"grid" | "gantt">("grid");

  // Live settings from M8 — pass through to every domain call so working days,
  // holidays, and RAG thresholds actually drive the schedule.
  const { settings } = useSettings();
  const { workingDays, holidays, ragThresholds } = settings;

  // Scope to current project for cascade + dependency engine
  const projectMilestones = milestones.filter((m) => m.projectId === activeProjectId);
  const domainMilestones = projectMilestones.map(toScheduleMs);

  // Apply a planned-date change: run cascade preview + cross-entity task scan,
  // show <ImpactDrawer> with the full picture before committing.
  function handlePlannedDateChange(id: string, newDate: string) {
    const numId = toId(id);
    const original = milestones.find((m) => m.id === id);
    if (!original) return;

    const edit = { id: numId, field: "plannedEnd" as const, value: newDate };
    const preview = previewCascade(domainMilestones, edit, workingDays, holidays);

    // Build the "already-applied" milestone state for Apply
    const cascadeResult = cascade(
      domainMilestones.map((sm) => sm.id === numId ? { ...sm, plannedEnd: newDate } : sm),
      workingDays,
      holidays,
    );
    const pending = applyDomainResult(milestones, cascadeResult.milestones);

    // Cross-entity: which tasks (in this project) would now be after the milestone
    const projectTasksForCheck = readPersistedTasks()
      .filter((t) => t.projectId === activeProjectId)
      .map<TaskScheduleEntry>((t) => ({
        id: t.id, name: t.name, dueDate: t.dueDate,
        dependsOn: t.dependsOn, milestoneId: t.milestoneId,
      }));
    const taskWarnings = previewMilestoneToTaskImpact(projectTasksForCheck, id, newDate);

    // Critical-path ids (helps render CP flag in the drawer)
    const cp = computeCriticalPath(domainMilestones, workingDays, holidays);

    const daysShifted = Math.ceil(
      (new Date(newDate).getTime() - new Date(original.plannedDate).getTime()) / 86_400_000
    );

    const summary: ImpactSummary = {
      originatorKind: "milestone",
      originatorId: original.id,
      originatorName: original.name,
      oldDate: original.plannedDate,
      newDate,
      daysShifted,
    };

    // Open drawer if any cascade, task warning, or even if no impact — gives
    // PM visibility either way (Apply still works on zero-impact changes).
    if (preview.affected.length > 0 || taskWarnings.length > 0) {
      setCascadePreview({
        affected: preview.affected,
        pendingMilestones: pending,
        summary,
        taskWarnings,
        criticalIds: cp.criticalIds,
      });
    } else {
      // No downstream impact — apply directly (and toast for visibility)
      setMilestones(pending);
      toast.success("Date updated", { description: original.name });
    }
  }

  // Apply a forecast-date change directly (no cascade — forecast is a projection)
  function handleForecastDateChange(id: string, newDate: string) {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, forecastDate: newDate } : m));
  }

  // Toggle lock
  function handleLockToggle(id: string) {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, locked: !m.locked } : m));
  }

  // Status change
  function handleStatusChange(id: string, status: MilestoneStatus) {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  }

  // Schedule from Go-Live — uses the active project's go-live, respects working days + holidays
  function handleScheduleFromGoLive() {
    const result = scheduleBackward(domainMilestones, activeProject.goLiveDate, workingDays, holidays);
    if (result.error) return;
    // Apply result back into the full milestones list (cascade only touched this project's ms)
    const updatedById = new Map(result.milestones.map((sm) => [sm.id, sm]));
    setMilestones((prev) => prev.map((m) => {
      const sm = updatedById.get(toId(m.id));
      return sm ? { ...m, plannedDate: sm.plannedEnd ?? m.plannedDate } : m;
    }));
  }

  // Reset to original mock data
  function handleReset() {
    setMilestones(initialMilestones);
  }

  // Drawer save/delete handlers — always attach the active project's id
  function handleDrawerSave(m: Milestone) {
    const withProj: Milestone = { ...m, projectId: m.projectId || activeProjectId };
    setMilestones((prev) => {
      const idx = prev.findIndex((x) => x.id === withProj.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = withProj;
        toast.success("Milestone updated", { description: withProj.name });
        return next;
      }
      toast.success("Milestone added", { description: withProj.name });
      return [...prev, withProj];
    });
    setDrawer({ mode: "closed" });
  }

  function handleDrawerDelete(id: string) {
    const target = milestones.find((m) => m.id === id);
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    toast.success("Milestone deleted", { description: target?.name });
    setDrawer({ mode: "closed" });
  }

  const filtered = milestones
    .filter((m) => m.projectId === activeProjectId)
    .filter((m) => {
      if (filterPhase !== "All" && m.phase !== filterPhase) return false;
      if (filterStatus !== "All" && m.status !== filterStatus) return false;
      if (filterMine && m.owner !== "VP") return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        {/* View toggle */}
        <div className="flex rounded-md border border-border bg-background p-0.5">
          {([
            { id: "grid",  label: "Grid",  Icon: LayoutGrid },
            { id: "gantt", label: "Gantt", Icon: GanttChartSquare },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-pressed={viewMode === id}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <select
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {phaseOptions.map((p) => <option key={p} value={p}>{p === "All" ? "All phases" : p}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="All">All statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setFilterMine((v) => !v)}
          title={filterMine ? "Showing only items owned by you" : "Show only items owned by you"}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
            filterMine
              ? "bg-primary/10 text-primary"
              : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Mine
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        <button
          onClick={handleScheduleFromGoLive}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Calendar className="h-3.5 w-3.5" />
          Schedule from Go-Live
        </button>

        <button
          onClick={() => setDrawer({ mode: "new" })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Milestone
        </button>
      </div>

      {/* Gantt view (toggle) */}
      {viewMode === "gantt" && (
        <GanttView
          milestones={filtered}
          onEditMilestone={(m) => setDrawer({ mode: "edit", milestone: m })}
        />
      )}

      {/* Grid */}
      {viewMode === "grid" && (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <div className="grid grid-cols-[24px_2fr_1fr_1fr_1fr_64px_80px_80px_32px] gap-0 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div />
          <div>Milestone</div>
          <div>Phase</div>
          <div>Planned</div>
          <div>Forecast</div>
          <div className="text-center">Dur</div>
          <div className="text-center">RAG</div>
          <div className="text-center">Dep</div>
          <div />
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No milestones match the current filters.</p>
            <p className="mt-1 text-xs text-muted-foreground">Try clearing phase or status filters.</p>
          </div>
        )}

        <ul className="divide-y divide-border">
          {filtered.map((m) => {
            const dm = toScheduleMs(m);
            const rag = computeRAG(dm, TODAY, ragThresholds);
            const dep = computeDependencyStatus(dm, domainMilestones, TODAY);
            const variance = Math.ceil(
              (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000
            );
            const canEdit = m.status !== "complete";

            return (
              <li
                key={m.id}
                className={cn(
                  "grid grid-cols-[24px_2fr_1fr_1fr_1fr_64px_80px_80px_32px] gap-0 items-center px-5 py-3.5",
                  "hover:bg-muted/20 transition-colors"
                )}
              >
                {/* Status (editable dropdown for non-complete) */}
                <div>
                  <StatusCell
                    value={m.status}
                    editable={!m.locked}
                    onChange={(s) => handleStatusChange(m.id, s)}
                  />
                </div>

                {/* Name + owner — clicking name opens edit drawer */}
                <div className="min-w-0 pl-2">
                  <button
                    onClick={() => setDrawer({ mode: "edit", milestone: m })}
                    className="truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                    title="Click to edit"
                  >
                    {m.name}
                  </button>
                  <p className="text-xs text-muted-foreground">Owner: {m.owner}</p>
                </div>

                {/* Phase */}
                <div className="truncate text-xs text-muted-foreground">{m.phase}</div>

                {/* Planned date (editable) */}
                <div>
                  <DateCell
                    value={m.plannedDate}
                    editable={canEdit && !m.locked}
                    onCommit={(v) => handlePlannedDateChange(m.id, v)}
                  />
                  {variance !== 0 && (
                    <p className={cn(
                      "mt-0.5 text-[11px] font-semibold tabular-nums",
                      variance > 0 ? "text-rose-600" : "text-emerald-600",
                    )}>
                      {variance > 0 ? `+${variance}d` : `${variance}d`}
                    </p>
                  )}
                </div>

                {/* Forecast date (editable, no cascade) */}
                <div>
                  <DateCell
                    value={m.forecastDate}
                    editable={canEdit && !m.locked}
                    onCommit={(v) => handleForecastDateChange(m.id, v)}
                  />
                </div>

                {/* Duration */}
                <div className="text-center text-xs tabular-nums text-muted-foreground">
                  {m.duration ?? 1}d
                </div>

                {/* RAG */}
                <div className="flex justify-center">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", ragBadge[rag])}>
                    {rag}
                  </span>
                </div>

                {/* Dep */}
                <div className="flex justify-center">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", depBadge[dep])}>
                    {dep}
                  </span>
                </div>

                {/* Lock toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => handleLockToggle(m.id)}
                    title={m.locked ? "Unlock date" : "Lock date"}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {m.locked
                      ? <Lock className="h-3 w-3" />
                      : <Unlock className="h-3 w-3 opacity-30 hover:opacity-80" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-muted/20 px-5 py-3 text-[11px]">
          <span className="font-semibold text-muted-foreground">RAG:</span>
          {(["Green", "Amber", "Red"] as const).map((r) => (
            <span key={r} className={cn("rounded-full border px-2 py-0.5 font-semibold", ragBadge[r])}>{r}</span>
          ))}
          <span className="mx-1 text-border">·</span>
          <span className="font-semibold text-muted-foreground">Dep:</span>
          {(["Clear", "Waiting", "Blocked"] as const).map((d) => (
            <span key={d} className={cn("rounded-full border px-2 py-0.5 font-semibold", depBadge[d])}>{d}</span>
          ))}
          <span className="mx-1 text-border">·</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Click to toggle lock · click dates to edit
          </span>
        </div>
      </div>
      )}

      {/* M18 — Universal cascade impact drawer */}
      {cascadePreview && (() => {
        const sections: ImpactSection[] = [];

        // Milestone shifts (sorted by criticality, then date)
        if (cascadePreview.affected.length > 0) {
          sections.push({
            kind: "milestones",
            title: "Milestones that will shift",
            rows: cascadePreview.affected
              .map((a) => ({
                id: `m${a.id}`,
                name: a.name,
                oldDate: a.oldEnd ?? "—",
                newDate: a.newEnd ?? "—",
                daysShifted: a.daysShifted,
                isCritical: cascadePreview.criticalIds.has(a.id),
              }))
              .sort((a, b) => (b.isCritical ? 1 : 0) - (a.isCritical ? 1 : 0)),
          });
        }

        // Task warnings (cross-entity)
        if (cascadePreview.taskWarnings.length > 0) {
          sections.push({
            kind: "warnings",
            title: "Tasks linked to this milestone now end after its new date",
            rows: cascadePreview.taskWarnings.map((w) => ({
              id: w.taskId,
              name: w.taskName,
              message: `Task due ${w.taskDue} is after milestone's new ${w.milestoneNewDate}. Review the task's due date.`,
            })),
          });
        }

        return (
          <ImpactDrawer
            open
            summary={cascadePreview.summary}
            sections={sections}
            onApply={() => {
              setMilestones(cascadePreview.pendingMilestones);
              toast.success(
                `${cascadePreview.affected.length} milestone${cascadePreview.affected.length === 1 ? "" : "s"} shifted`,
                { description: cascadePreview.summary.originatorName }
              );
              setCascadePreview(null);
            }}
            onCancel={() => setCascadePreview(null)}
          />
        );
      })()}

      {/* Add / Edit drawer — predecessor picker scoped to current project */}
      <MilestoneFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.milestone : null}
        allMilestones={projectMilestones}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />
    </div>
  );
}
