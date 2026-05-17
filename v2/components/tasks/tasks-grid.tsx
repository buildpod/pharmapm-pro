"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Milestone, ArrowRight, Plus } from "lucide-react";
import {
  milestones,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/mockData";
import { TaskFormDrawer } from "./task-form";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";
import { useSettings } from "@/lib/settingsStore";
import {
  previewTaskCascade, findConstraintViolations, groupViolationsByTask, diffViolations,
  previewTaskToMilestonePush,
  type TaskScheduleEntry, type ScheduleMilestone,
} from "@/lib/domain/scheduling";
import { workingDaysBetween } from "@/lib/domain/dates";

// Local helpers — match the conversion used in milestones-grid so a task linked
// to "m6" resolves to the milestone whose id is 6 in the engine.
function msStrToNum(id: string): number { return parseInt(id.replace("m", "")); }
function msNumToStr(id: number): string { return `m${id}`; }
import { ImpactDrawer, type ImpactSummary, type ImpactSection } from "@/components/ui/impact-drawer";
import { cn } from "@/lib/utils";

// ─── Styles ───────────────────────────────────────────────────────────────────

const priorityStyles: Record<TaskPriority, { pill: string; dot: string; label: string }> = {
  Critical: { pill: "bg-rose-50 text-rose-700 border-rose-200",       dot: "bg-rose-500",   label: "Critical" },
  High:     { pill: "bg-amber-50 text-amber-700 border-amber-200",    dot: "bg-amber-500",  label: "High"     },
  Medium:   { pill: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-400", label: "Medium"   },
  Low:      { pill: "bg-slate-100 text-slate-600 border-slate-200",   dot: "bg-slate-300",  label: "Low"      },
};

const statusStyles: Record<TaskStatus, string> = {
  "Complete":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  "Not Started": "bg-slate-100 text-slate-600 border-slate-200",
  "Blocked":     "bg-rose-50 text-rose-700 border-rose-200",
  "On Hold":     "bg-violet-50 text-violet-700 border-violet-200",
};

// Per-person avatar color hash
const AVATAR_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-teal-500",
  "bg-cyan-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500", "bg-pink-500",
];
function avatarColor(initials: string) {
  const hash = initials.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const nextStatus: Record<TaskStatus, TaskStatus> = {
  "Not Started": "In Progress",
  "In Progress": "Complete",
  "Complete":    "Not Started",
  "Blocked":     "In Progress",
  "On Hold":     "In Progress",
};

const allPriorities: TaskPriority[] = ["Critical", "High", "Medium", "Low"];
const allStatuses: TaskStatus[]     = ["Not Started", "In Progress", "Complete", "Blocked", "On Hold"];

// ─── Lookups ──────────────────────────────────────────────────────────────────

const milestoneById = Object.fromEntries(milestones.map((m) => [m.id, m]));
// taskById fallback removed in M20.2 — tasks now flow from the entity store
// at the call sites; DependencyTags receives the live list as allTasks.
const taskById: Record<string, Task> = {};

function MilestoneTag({ milestoneId }: { milestoneId?: string }) {
  if (!milestoneId) return null;
  const m = milestoneById[milestoneId];
  if (!m) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
      title={m.name}
    >
      <Milestone className="h-2.5 w-2.5 shrink-0" />
      {m.name.length > 22 ? m.name.slice(0, 22) + "…" : m.name}
    </span>
  );
}

function DependencyTags({ dependsOn, allTasks }: { dependsOn?: string[]; allTasks: Task[] }) {
  if (!dependsOn?.length) return null;
  const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]));
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {dependsOn.map((depId) => {
        const dep = taskMap[depId] ?? taskById[depId];
        if (!dep) return null;
        const done = dep.status === "Complete";
        const blocked = dep.status === "Blocked";
        return (
          <span
            key={depId}
            title={`Depends on: ${dep.name}`}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium",
              done    ? "bg-green-50 text-green-600" :
              blocked ? "bg-red-50 text-red-600" :
                        "bg-muted text-muted-foreground"
            )}
          >
            <ArrowRight className="h-2 w-2 shrink-0" />
            {depId.toUpperCase()}
            {done && " ✓"}
          </span>
        );
      })}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, status }: { value: number; status: TaskStatus }) {
  const color =
    status === "Complete"    ? "bg-emerald-500" :
    status === "Blocked"     ? "bg-rose-500" :
    status === "In Progress" ? "bg-blue-500" :
    "bg-slate-300";

  return (
    <div className="flex min-w-[100px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function TaskRow({
  task,
  allTasks,
  onStatusToggle,
  onProgressChange,
  onEdit,
}: {
  task: Task;
  allTasks: Task[];
  onStatusToggle: (id: string) => void;
  onProgressChange: (id: string, value: number) => void;
  onEdit: (task: Task) => void;
}) {
  const [editingProgress, setEditingProgress] = useState(false);
  const p = priorityStyles[task.priority];
  const isOverdue = new Date(task.dueDate) < new Date("2026-05-11") && task.status !== "Complete";

  return (
    <tr className="hover:bg-muted/20 transition-colors group">
      {/* Priority dot */}
      <td className="px-4 py-2.5 w-8">
        <span
          className={cn("block h-2 w-2 rounded-full", p.dot)}
          title={task.priority}
        />
      </td>

      {/* Name + milestone tag + dependencies — click name to edit */}
      <td className="px-2 py-3">
        <button
          onClick={() => onEdit(task)}
          className="block w-full text-left text-sm font-medium leading-tight text-foreground hover:text-primary hover:underline"
          title="Click to edit"
        >
          {task.name}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <MilestoneTag milestoneId={task.milestoneId} />
        </div>
        <DependencyTags dependsOn={task.dependsOn} allTasks={allTasks} />
      </td>

      {/* Priority badge */}
      <td className="hidden px-2 py-3 lg:table-cell">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", p.pill)}>
          {task.priority}
        </span>
      </td>

      {/* Owner avatar */}
      <td className="w-14 px-2 py-3 text-center">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white",
            avatarColor(task.owner),
          )}
          title={task.owner}
        >
          {task.owner}
        </span>
      </td>

      {/* Due date */}
      <td className={cn(
        "w-20 px-2 py-3 text-xs tabular-nums",
        isOverdue ? "font-semibold text-rose-600" : "text-muted-foreground",
      )}>
        {formatDate(task.dueDate)}
      </td>

      {/* Progress (click to edit inline) */}
      <td className="px-2 py-2.5 w-36">
        {editingProgress ? (
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            defaultValue={task.progress}
            className="w-full accent-primary"
            onBlur={(e) => {
              setEditingProgress(false);
              onProgressChange(task.id, Number(e.target.value));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                setEditingProgress(false);
                onProgressChange(task.id, Number((e.target as HTMLInputElement).value));
              }
            }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingProgress(true)}
            title="Click to edit progress"
            className="w-full text-left"
          >
            <ProgressBar value={task.progress} status={task.status} />
          </button>
        )}
      </td>

      {/* Status (click to cycle) */}
      <td className="w-28 px-4 py-3">
        <button
          onClick={() => onStatusToggle(task.id)}
          title={`${task.status} → click to mark ${nextStatus[task.status]}`}
          className={cn(
            "whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70",
            statusStyles[task.status],
          )}
        >
          {task.status}
        </button>
      </td>
    </tr>
  );
}

// ─── Workstream group ─────────────────────────────────────────────────────────

function WorkstreamGroup({
  name,
  tasks,
  allTasks,
  onStatusToggle,
  onProgressChange,
  onEdit,
}: {
  name: string;
  tasks: Task[];
  allTasks: Task[];
  onStatusToggle: (id: string) => void;
  onProgressChange: (id: string, value: number) => void;
  onEdit: (task: Task) => void;
}) {
  const [open, setOpen] = useState(true);

  const total    = tasks.length;
  const done     = tasks.filter((t) => t.status === "Complete").length;
  const blocked  = tasks.filter((t) => t.status === "Blocked").length;
  const avgPct   = Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total);
  const critical = tasks.some((t) => t.priority === "Critical" && t.status !== "Complete");

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border bg-muted/30 px-5 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        {open
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}

        <span className="text-sm font-semibold text-foreground">{name}</span>

        <span className="text-xs text-muted-foreground tabular-nums">
          {done} of {total} complete
        </span>

        {blocked > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
            {blocked} blocked
          </span>
        )}

        {critical && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
            ⚠ critical open
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden w-32 items-center gap-2 sm:flex">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-primary" style={{ width: `${avgPct}%` }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{avgPct}%</span>
          </div>
        </div>
      </button>

      {/* Task rows */}
      {open && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-4 py-2" />
              <th className="px-2 py-2 text-left">Task</th>
              <th className="hidden w-24 px-2 py-2 text-left lg:table-cell">Priority</th>
              <th className="w-14 px-2 py-2 text-center">Owner</th>
              <th className="w-20 px-2 py-2 text-left">Due</th>
              <th className="w-36 px-2 py-2 text-left">Progress</th>
              <th className="w-28 px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                allTasks={allTasks}
                onStatusToggle={onStatusToggle}
                onProgressChange={onProgressChange}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main grid ────────────────────────────────────────────────────────────────

type TaskDrawerState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; task: Task };

// M20: drawer now drives selective cascade. We capture the edit + summary;
// recompute happens inside the drawer's callback on every toggle/override.
interface TaskCascadePreviewState {
  edit: { id: string; newDueDate: string };
  summary: ImpactSummary;
  editedTask: Task;          // the task with the new dueDate (to commit at end)
}

export function TasksGrid() {
  const { activeProjectId } = useProject();
  const { settings } = useSettings();
  const tasks             = useEntityStore((s) => s.tasks);
  const addTask           = useEntityStore((s) => s.addTask);
  const updateTask        = useEntityStore((s) => s.updateTask);
  const deleteTaskAction  = useEntityStore((s) => s.deleteTask);
  const replaceAllTasks   = useEntityStore((s) => s.replaceAllTasks);
  // M20.3 — bidirectional cascade needs live milestones to propose pushes
  const liveMilestones    = useEntityStore((s) => s.milestones);
  const replaceAllMilestones = useEntityStore((s) => s.replaceAllMilestones);
  const [cascadePreview, setCascadePreview]     = useState<TaskCascadePreviewState | null>(null);
  const [filterPriority, setFilterPriority]     = useState<TaskPriority | "All">("All");
  const [filterStatus, setFilterStatus]         = useState<TaskStatus | "All">("All");
  const [filterWorkstream, setFilterWorkstream] = useState<string>("All");
  const [filterMine, setFilterMine]             = useState(false);
  const [drawer, setDrawer]                     = useState<TaskDrawerState>({ mode: "closed" });

  const projectTasks   = tasks.filter((t) => t.projectId === activeProjectId);
  const allWorkstreams = Array.from(new Set(projectTasks.map((t) => t.workstream)));

  function handleDrawerSave(t: Task) {
    const withProj: Task = { ...t, projectId: t.projectId || activeProjectId };
    const existing = tasks.find((x) => x.id === withProj.id);

    // M18: if dueDate moved later on an existing task, run cascade preview.
    // (New tasks and earlier-due edits don't push anything downstream.)
    const dueMovedLater =
      !!existing && existing.dueDate !== withProj.dueDate && withProj.dueDate > existing.dueDate;

    if (dueMovedLater) {
      // Quick check: does this edit have any downstream impact at all?
      const projTasks = tasks.filter((x) => x.projectId === activeProjectId);
      const entries: TaskScheduleEntry[] = projTasks.map((x) => ({
        id: x.id, name: x.name, dueDate: x.dueDate,
        dependsOn: x.dependsOn, milestoneId: x.milestoneId,
      }));
      const initial = previewTaskCascade(
        entries,
        { id: withProj.id, newDueDate: withProj.dueDate },
        { workingDays: settings.workingDays, holidays: settings.holidays }
      );

      // M20.3 — also probe task→milestone push so the drawer opens when the
      // shift impacts a linked milestone, even with no downstream task shifts.
      const projMs = liveMilestones.filter((m) => m.projectId === activeProjectId);
      const probeMs: ScheduleMilestone[] = projMs.map((m) => ({
        id: msStrToNum(m.id),
        predecessor: m.predecessor ? msStrToNum(m.predecessor) : undefined,
        lag: m.lag ?? 0, duration: m.duration ?? 1,
        plannedStart: m.plannedDate, plannedEnd: m.plannedDate,
        status: "Not Started", lockDate: m.locked,
      }));
      const msPushProbe = previewTaskToMilestonePush(
        initial.tasks, probeMs, msNumToStr,
        { workingDays: settings.workingDays, holidays: settings.holidays }
      );

      if (initial.affected.length > 0 || msPushProbe.length > 0) {
        // M20.5 PL-3 — working days, not calendar days
        const daysShifted = workingDaysBetween(
          existing.dueDate, withProj.dueDate, settings.workingDays, settings.holidays
        );
        // Open the M20 selective-cascade drawer. The drawer will call
        // recompute() on every toggle/override; we keep the edit + originals
        // here and re-run the engine fresh on each call.
        setCascadePreview({
          edit: { id: withProj.id, newDueDate: withProj.dueDate },
          editedTask: withProj,
          summary: {
            originatorKind: "task",
            originatorId: withProj.id,
            originatorName: withProj.name,
            oldDate: existing.dueDate,
            newDate: withProj.dueDate,
            daysShifted,
          },
        });
        setDrawer({ mode: "closed" });
        return;
      }
    }

    // No cascade impact (or no due-date change) — apply directly
    const exists = tasks.some((x) => x.id === withProj.id);
    if (exists) {
      updateTask(withProj);
      toast.success("Task updated", { description: withProj.name });
    } else {
      addTask(withProj);
      toast.success("Task added", { description: withProj.name });
    }
    setDrawer({ mode: "closed" });
  }

  function handleDrawerDelete(id: string) {
    const target = tasks.find((t) => t.id === id);
    deleteTaskAction(id);
    toast.success("Task deleted", { description: target?.name });
    setDrawer({ mode: "closed" });
  }

  function handleStatusToggle(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const newStatus = nextStatus[target.status];
    updateTask({
      ...target,
      status: newStatus,
      progress: newStatus === "Complete" ? 100 : target.progress,
    }, { source: "user-inline", note: "status cycle" });
  }

  function handleProgressChange(id: string, value: number) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    updateTask({
      ...target,
      progress: value,
      status: value === 100 ? "Complete" : value > 0 && target.status === "Not Started" ? "In Progress" : target.status,
    }, { source: "user-inline", note: "progress slider" });
  }

  // Apply filters then group by workstream — scoped to active project
  const filtered = projectTasks.filter((t) => {
    if (filterPriority   !== "All" && t.priority   !== filterPriority)   return false;
    if (filterStatus     !== "All" && t.status     !== filterStatus)     return false;
    if (filterWorkstream !== "All" && t.workstream !== filterWorkstream) return false;
    if (filterMine && t.owner !== "VP")                                  return false;
    return true;
  });

  const workstreams = Array.from(new Set(projectTasks.map((t) => t.workstream)));
  const groups = workstreams
    .map((ws) => ({
      name: ws,
      tasks: filtered
        .filter((t) => t.workstream === ws)
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    }))
    .filter((g) => g.tasks.length > 0);

  // Summary counts — for the active project only
  const totalTasks    = projectTasks.length;
  const completeTasks = projectTasks.filter((t) => t.status === "Complete").length;
  const blockedTasks  = projectTasks.filter((t) => t.status === "Blocked").length;
  const inProgress    = projectTasks.filter((t) => t.status === "In Progress").length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {completeTasks} of {totalTasks} complete
        </span>
        {inProgress > 0 && (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
            {inProgress} in progress
          </span>
        )}
        {blockedTasks > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold text-rose-700">
            {blockedTasks} blocked
          </span>
        )}

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

        <select
          value={filterWorkstream}
          onChange={(e) => setFilterWorkstream(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="All">All workstreams</option>
          {allWorkstreams.map((ws) => <option key={ws} value={ws}>{ws}</option>)}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "All")}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="All">All priorities</option>
          {allPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "All")}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="All">All statuses</option>
          {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          onClick={() => setDrawer({ mode: "new" })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Task
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-[11px] text-muted-foreground">
        {allPriorities.map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", priorityStyles[p].dot)} />
            {p}
          </span>
        ))}
        <span className="mx-1 text-border">·</span>
        <span>Click status badge to advance · click progress bar to edit %</span>
      </div>

      {/* Workstream groups */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No tasks match the current filters.</p>
          <p className="mt-1 text-xs text-muted-foreground">Try clearing the workstream, priority, or status filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <WorkstreamGroup
              key={g.name}
              name={g.name}
              tasks={g.tasks}
              allTasks={projectTasks}
              onStatusToggle={handleStatusToggle}
              onProgressChange={handleProgressChange}
              onEdit={(t) => setDrawer({ mode: "edit", task: t })}
            />
          ))}
        </div>
      )}

      {/* M20.1 — Selective cascade impact drawer (topo cascade + grouped violations + new-vs-existing)
          M20.3 — also surfaces linked-milestone pushes (task→milestone cascade) */}
      {cascadePreview && (() => {
        // Snapshot tasks at drawer open so recompute is deterministic
        const projTasks = tasks.filter((x) => x.projectId === activeProjectId);
        const entries: TaskScheduleEntry[] = projTasks.map((x) => ({
          id: x.id, name: x.name, dueDate: x.dueDate,
          dependsOn: x.dependsOn, milestoneId: x.milestoneId,
        }));

        // M20.3 — snapshot live milestones for task→milestone push detection
        const projMilestones = liveMilestones.filter((m) => m.projectId === activeProjectId);
        const scheduleMilestones: ScheduleMilestone[] = projMilestones.map((m) => ({
          id: msStrToNum(m.id),
          predecessor: m.predecessor ? msStrToNum(m.predecessor) : undefined,
          lag: m.lag ?? 0,
          duration: m.duration ?? 1,
          plannedStart: m.plannedDate,
          plannedEnd: m.plannedDate,
          status:
            m.status === "complete"      ? "Complete"
            : m.status === "in-progress" ? "In Progress"
            : m.status === "at-risk"     ? "Blocked"
            : "Not Started",
          lockDate: m.locked,
        }));

        // Baseline violations exist BEFORE any edit — computed once, used to
        // diff against post-cascade state so we surface only NEW violations.
        const baselineViolations = findConstraintViolations(
          entries, settings.workingDays, settings.holidays
        );

        function runCascade(excludeIds: Set<string>, overrides: Record<string, string>) {
          return previewTaskCascade(entries, cascadePreview!.edit, {
            excludeIds, overrides,
            workingDays: settings.workingDays,
            holidays: settings.holidays,
          });
        }

        return (
          <ImpactDrawer
            open
            summary={cascadePreview.summary}
            recompute={(excludeIds, overrides) => {
              const r = runCascade(excludeIds, overrides);

              // M21-DrawerRewrite — engine returns an error (only realistic
              // case today: pre-existing cycle in dependency data). Render
              // ONE callout, amber tone, with the cycle-task list collapsed by
              // default + an action button that takes the PM to the Tasks page
              // to resolve. Plain language, no jargon, what/why/next structure.
              if (r.error) {
                const cycleMatch = r.error.match(/Tasks involved:\s*(.+)/i);
                const cycleIds = cycleMatch
                  ? cycleMatch[1].split(/[→,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
                  : [];
                const cycleTaskById = new Map(entries.map((t) => [t.id, t]));
                const projTaskById = new Map(projTasks.map((t) => [t.id, t]));
                const cycleItems = cycleIds
                  .map((id) => cycleTaskById.get(id))
                  .filter((t): t is TaskScheduleEntry => !!t)
                  .map((t) => ({
                    id: t.id,
                    name: t.name,
                    group: projTaskById.get(t.id)?.workstream,
                  }));

                return {
                  sections: [{
                    kind: "callout",
                    tone: "amber",
                    title: "Downstream preview unavailable",
                    body: `Some tasks reference each other in a loop, so we can't compute what would shift.\n\nYour change to ${cascadePreview!.editedTask.name} will still save.`,
                    collapsibleLabel: `Show ${cycleItems.length} task${cycleItems.length === 1 ? "" : "s"} in the loop`,
                    collapsibleItems: cycleItems,
                    actionLabel: "Open Tasks page",
                    onAction: () => {
                      // Soft navigate; tasks-grid is the current page so this just
                      // closes the drawer. A future enhancement could deep-link to
                      // a filtered tasks view of just the cycle members.
                      setCascadePreview(null);
                    },
                  }],
                };
              }

              // M20.6 — pass workstream as `group` for collapsible sub-sections in the drawer
              const taskById = new Map(projTasks.map((t) => [t.id, t]));
              const tasksSection: ImpactSection = {
                kind: "tasks",
                title: "Downstream tasks that will shift",
                rows: r.affected.map((a) => ({
                  id: a.id, name: a.name,
                  oldDate: a.oldDue, newDate: a.newDue,
                  daysShifted: a.daysShifted,
                  group: taskById.get(a.id)?.workstream,
                })),
              };

              // M20.3 — task → milestone push. Compute against the cascaded
              // task state (r.tasks). Default-checked (PM must opt out per
              // Vineet's confirmed preference for schedule integrity).
              // M20.5 — now transitive (PL-2) and with +1WD gate buffer (PL-4).
              const msPushes = previewTaskToMilestonePush(
                r.tasks, scheduleMilestones, msNumToStr,
                { workingDays: settings.workingDays, holidays: settings.holidays }
              );
              // M20.6 — surface PL-2 transitive ancestry as a caption on each row
              const milestonesSection: ImpactSection = {
                kind: "milestones",
                title: "Linked milestones that will shift",
                rows: msPushes.map((p) => ({
                  id: p.milestoneId, name: p.milestoneName,
                  oldDate: p.oldPlannedDate, newDate: p.proposedNewDate,
                  daysShifted: p.daysShifted,
                  ancestry: p.transitive
                    ? `${p.drivenByTaskId.toUpperCase()} (via predecessor chain)`
                    : p.drivenByTaskId.toUpperCase(),
                })),
              };

              // After-state violations, diffed against baseline to show only NEW ones
              const after = findConstraintViolations(
                r.tasks, settings.workingDays, settings.holidays
              );
              const { newOnes, resolved } = diffViolations(baselineViolations, after);
              const groupedNew = groupViolationsByTask(newOnes);

              const newSection: ImpactSection = {
                kind: "warnings",
                title: `New constraint violations caused by your choices`,
                rows: groupedNew.map((g) => ({
                  id: g.taskId,
                  name: g.taskName,
                  message: `Due ${g.taskDue} but upstream${g.brokenDeps.length > 1 ? "s" : ""}: ${g.brokenDeps.map((d) => `${d.depId.toUpperCase()} ${d.depDue}`).join(", ")} (needs +${Math.max(...g.brokenDeps.map((d) => d.daysBehind))} working days)`,
                })),
              };

              // Pre-existing violations: informational, collapsed-style. Only show
              // a small "data health" note if any exist (helps PM understand context
              // without confusing them about what this edit caused).
              const groupedExisting = groupViolationsByTask(
                baselineViolations.filter((b) =>
                  !resolved.some((r) => r.taskId === b.taskId && r.depId === b.depId)
                )
              );
              const existingSection: ImpactSection | null = groupedExisting.length > 0 ? {
                kind: "warnings",
                title: `Pre-existing data inconsistencies (not caused by this edit)`,
                rows: groupedExisting.map((g) => ({
                  id: `pre-${g.taskId}`,
                  name: g.taskName,
                  message: `${g.taskId.toUpperCase()} due ${g.taskDue} but ${g.brokenDeps.length} upstream${g.brokenDeps.length === 1 ? "" : "s"} scheduled later — review the task's dependencies`,
                })),
              } : null;

              return {
                sections: [
                  tasksSection,
                  ...(milestonesSection.rows.length > 0 ? [milestonesSection] : []),
                  newSection,
                  ...(existingSection ? [existingSection] : []),
                ],
              };
            }}
            onApply={(excludeIds, overrides) => {
              const r = runCascade(excludeIds, overrides);
              // M20.7 — pre-existing cycle in data must not block the user's edit.
              // Save the originator; skip cascade propagation; surface the cycle as
              // a non-blocking warning. PL-12 in CASCADE_ALGORITHM.md.
              if (r.error) {
                const pendingTasks = tasks.map((x) =>
                  x.id === cascadePreview!.editedTask.id ? cascadePreview!.editedTask : x
                );
                replaceAllTasks(pendingTasks, {
                  source: "cascade",
                  note: "originator saved; cascade skipped due to cycle in data",
                });
                // M21-DrawerRewrite — what/why/next structure, plain language,
                // tone is warning (partial success — primary action saved).
                toast.warning("Saved · downstream preview unavailable", {
                  description: `${cascadePreview!.editedTask.name} updated. Review task dependencies to enable previews next time.`,
                });
                setCascadePreview(null);
                return;
              }
              const shiftedById: Record<string, string> = {};
              r.affected.forEach((a) => { shiftedById[a.id] = a.newDue; });
              const pendingTasks = tasks.map((x) => {
                if (x.id === cascadePreview!.editedTask.id) return cascadePreview!.editedTask;
                if (shiftedById[x.id]) return { ...x, dueDate: shiftedById[x.id] };
                return x;
              });
              replaceAllTasks(pendingTasks, { source: "cascade", note: "task cascade apply" });

              // M20.3 — apply task → milestone pushes (default-checked, unless
              // the PM unchecked them in the drawer). M20.5: transitive + buffered.
              const msPushes = previewTaskToMilestonePush(
                r.tasks, scheduleMilestones, msNumToStr,
                { workingDays: settings.workingDays, holidays: settings.holidays }
              );
              const includedPushes = msPushes.filter((p) => !excludeIds.has(p.milestoneId));
              if (includedPushes.length > 0) {
                const pushById: Record<string, string> = {};
                includedPushes.forEach((p) => {
                  // overrides on milestone rows let PM dial in an even-later date
                  pushById[p.milestoneId] = overrides[p.milestoneId] ?? p.proposedNewDate;
                });
                const pendingMilestones = liveMilestones.map((m) =>
                  pushById[m.id] ? { ...m, plannedDate: pushById[m.id] } : m
                );
                replaceAllMilestones(pendingMilestones, { source: "cascade", note: "task→milestone push" });
              }

              const applied = r.affected.length;
              const msApplied = includedPushes.length;
              toast.success(
                `${applied + 1} task${applied === 0 ? "" : "s"} updated`,
                {
                  description: msApplied > 0
                    ? `${cascadePreview!.summary.originatorName} · ${msApplied} milestone${msApplied === 1 ? "" : "s"} also shifted`
                    : cascadePreview!.summary.originatorName,
                }
              );
              setCascadePreview(null);
            }}
            onCancel={() => setCascadePreview(null)}
          />
        );
      })()}

      {/* Add / Edit drawer — pickers scoped to current project */}
      <TaskFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.task : null}
        allTasks={projectTasks}
        allMilestones={milestones.filter((m) => m.projectId === activeProjectId)}
        knownWorkstreams={allWorkstreams}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />
    </div>
  );
}
