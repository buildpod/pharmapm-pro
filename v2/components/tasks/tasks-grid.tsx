"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Milestone, ArrowRight } from "lucide-react";
import {
  tasks as initialTasks,
  milestones,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Styles ───────────────────────────────────────────────────────────────────

const priorityStyles: Record<TaskPriority, { pill: string; dot: string; label: string }> = {
  Critical: { pill: "bg-red-100 text-red-700",    dot: "bg-red-500",    label: "Critical" },
  High:     { pill: "bg-amber-100 text-amber-700", dot: "bg-amber-500",  label: "High"     },
  Medium:   { pill: "bg-yellow-50 text-yellow-700",dot: "bg-yellow-400", label: "Medium"   },
  Low:      { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40", label: "Low" },
};

const statusStyles: Record<TaskStatus, string> = {
  "Complete":    "bg-green-100 text-green-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Not Started": "bg-muted text-muted-foreground",
  "Blocked":     "bg-red-100 text-red-700",
  "On Hold":     "bg-purple-100 text-purple-700",
};

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
    status === "Complete"    ? "bg-green-500" :
    status === "Blocked"     ? "bg-destructive" :
    status === "In Progress" ? "bg-primary" :
    "bg-muted-foreground/30";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground shrink-0">
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
}: {
  task: Task;
  allTasks: Task[];
  onStatusToggle: (id: string) => void;
  onProgressChange: (id: string, value: number) => void;
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

      {/* Name + milestone tag + dependencies */}
      <td className="px-2 py-2.5">
        <p className="text-xs font-medium text-foreground leading-tight">{task.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <MilestoneTag milestoneId={task.milestoneId} />
        </div>
        <DependencyTags dependsOn={task.dependsOn} allTasks={allTasks} />
      </td>

      {/* Priority badge */}
      <td className="px-2 py-2.5 hidden lg:table-cell">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", p.pill)}>
          {task.priority}
        </span>
      </td>

      {/* Owner */}
      <td className="px-2 py-2.5 text-center text-xs text-muted-foreground w-12">
        {task.owner}
      </td>

      {/* Due date */}
      <td className={cn("px-2 py-2.5 text-xs w-16", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
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
      <td className="px-4 py-2.5 w-28">
        <button
          onClick={() => onStatusToggle(task.id)}
          title={`${task.status} → click to mark ${nextStatus[task.status]}`}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70 whitespace-nowrap",
            statusStyles[task.status]
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
}: {
  name: string;
  tasks: Task[];
  allTasks: Task[];
  onStatusToggle: (id: string) => void;
  onProgressChange: (id: string, value: number) => void;
}) {
  const [open, setOpen] = useState(true);

  const total    = tasks.length;
  const done     = tasks.filter((t) => t.status === "Complete").length;
  const blocked  = tasks.filter((t) => t.status === "Blocked").length;
  const avgPct   = Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total);
  const critical = tasks.some((t) => t.priority === "Critical" && t.status !== "Complete");

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

        <span className="text-sm font-semibold text-foreground">{name}</span>

        <span className="text-xs text-muted-foreground">
          {done}/{total} complete
        </span>

        {blocked > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            {blocked} blocked
          </span>
        )}

        {critical && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
            critical open
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Mini group progress bar */}
          <div className="hidden sm:flex items-center gap-1.5 w-24">
            <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${avgPct}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{avgPct}%</span>
          </div>
        </div>
      </button>

      {/* Task rows */}
      {open && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-1.5 w-8" />
              <th className="px-2 py-1.5 text-left">Task</th>
              <th className="px-2 py-1.5 text-left hidden lg:table-cell w-24">Priority</th>
              <th className="px-2 py-1.5 text-center w-12">Owner</th>
              <th className="px-2 py-1.5 text-left w-16">Due</th>
              <th className="px-2 py-1.5 text-left w-36">Progress</th>
              <th className="px-4 py-1.5 text-left w-28">Status</th>
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
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main grid ────────────────────────────────────────────────────────────────

export function TasksGrid() {
  const [tasks, setTasks]                       = useState<Task[]>(initialTasks);
  const [filterPriority, setFilterPriority]     = useState<TaskPriority | "All">("All");
  const [filterStatus, setFilterStatus]         = useState<TaskStatus | "All">("All");
  const [filterWorkstream, setFilterWorkstream] = useState<string>("All");

  const allWorkstreams = Array.from(new Set(tasks.map((t) => t.workstream)));

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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-xs text-muted-foreground">{completeTasks}/{totalTasks} complete</span>
        {inProgress > 0 && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
            {inProgress} in progress
          </span>
        )}
        {blockedTasks > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">
            {blockedTasks} blocked
          </span>
        )}

        <div className="flex-1" />

        {/* Workstream filter */}
        <select
          value={filterWorkstream}
          onChange={(e) => setFilterWorkstream(e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All workstreams</option>
          {allWorkstreams.map((ws) => <option key={ws} value={ws}>{ws}</option>)}
        </select>

        {/* Priority filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | "All")}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All priorities</option>
          {allPriorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "All")}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All statuses</option>
          {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-[10px] text-muted-foreground">
        {allPriorities.map((p) => (
          <span key={p} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", priorityStyles[p].dot)} />
            {p}
          </span>
        ))}
        <span className="mx-1 text-border">·</span>
        <span>Click status badge to advance · click progress bar to edit %</span>
      </div>

      {/* Workstream groups */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
          No tasks match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <WorkstreamGroup
              key={g.name}
              name={g.name}
              tasks={g.tasks}
              allTasks={tasks}
              onStatusToggle={handleStatusToggle}
              onProgressChange={handleProgressChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
