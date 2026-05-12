"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Milestone, ArrowRight, Plus } from "lucide-react";
import {
  tasks as initialTasks,
  milestones,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/mockData";
import { TaskFormDrawer } from "./task-form";
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
const taskById      = Object.fromEntries(initialTasks.map((t) => [t.id, t]));

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

export function TasksGrid() {
  const [tasks, setTasks]                       = useState<Task[]>(initialTasks);
  const [filterPriority, setFilterPriority]     = useState<TaskPriority | "All">("All");
  const [filterStatus, setFilterStatus]         = useState<TaskStatus | "All">("All");
  const [filterWorkstream, setFilterWorkstream] = useState<string>("All");
  const [drawer, setDrawer]                     = useState<TaskDrawerState>({ mode: "closed" });

  const allWorkstreams = Array.from(new Set(tasks.map((t) => t.workstream)));

  function handleDrawerSave(t: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = t;
        toast.success("Task updated", { description: t.name });
        return next;
      }
      toast.success("Task added", { description: t.name });
      return [...prev, t];
    });
    setDrawer({ mode: "closed" });
  }

  function handleDrawerDelete(id: string) {
    const target = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.success("Task deleted", { description: target?.name });
    setDrawer({ mode: "closed" });
  }

  function handleStatusToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => t.id !== id ? t : {
        ...t,
        status: nextStatus[t.status],
        progress: nextStatus[t.status] === "Complete" ? 100 : t.progress,
      })
    );
  }

  function handleProgressChange(id: string, value: number) {
    setTasks((prev) =>
      prev.map((t) => t.id !== id ? t : {
        ...t,
        progress: value,
        status: value === 100 ? "Complete" : value > 0 && t.status === "Not Started" ? "In Progress" : t.status,
      })
    );
  }

  // Apply filters then group by workstream
  const filtered = tasks.filter((t) => {
    if (filterPriority   !== "All" && t.priority   !== filterPriority)   return false;
    if (filterStatus     !== "All" && t.status     !== filterStatus)     return false;
    if (filterWorkstream !== "All" && t.workstream !== filterWorkstream) return false;
    return true;
  });

  const workstreams = Array.from(new Set(tasks.map((t) => t.workstream)));
  const groups = workstreams
    .map((ws) => ({ name: ws, tasks: filtered.filter((t) => t.workstream === ws) }))
    .filter((g) => g.tasks.length > 0);

  // Summary counts
  const totalTasks    = tasks.length;
  const completeTasks = tasks.filter((t) => t.status === "Complete").length;
  const blockedTasks  = tasks.filter((t) => t.status === "Blocked").length;
  const inProgress    = tasks.filter((t) => t.status === "In Progress").length;

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
              allTasks={tasks}
              onStatusToggle={handleStatusToggle}
              onProgressChange={handleProgressChange}
              onEdit={(t) => setDrawer({ mode: "edit", task: t })}
            />
          ))}
        </div>
      )}

      {/* Add / Edit drawer */}
      <TaskFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.task : null}
        allTasks={tasks}
        allMilestones={milestones}
        knownWorkstreams={allWorkstreams}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />
    </div>
  );
}
