"use client";

// Tasks grid — refactored to the AivelloStudio design system per
// design/tasks-reference.html. Visual chrome only: workstream summary
// strip, filter-chip toolbar, .tasks table with collapsible .ws groups
// and 9-column .task rows.
//
// All handlers, the cascade ImpactDrawer wiring, and the TaskFormDrawer
// wiring are preserved verbatim from the pre-refactor implementation.

import { useState } from "react";
import { toast } from "sonner";
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
  previewTaskToMilestonePush, findCycleEdges,
  type TaskScheduleEntry, type ScheduleMilestone,
} from "@/lib/domain/scheduling";
import { workingDaysBetween } from "@/lib/domain/dates";
import { ImpactDrawer, type ImpactSummary, type ImpactSection } from "@/components/ui/impact-drawer";
import "@/app/styles/tasks.css";

// Local helpers — match the conversion used in milestones-grid so a task linked
// to "m6" resolves to the milestone whose id is 6 in the engine.
function msStrToNum(id: string): number { return parseInt(id.replace("m", "")); }
function msNumToStr(id: number): string { return `m${id}`; }

// ─── Visual mappings (design-token classes) ───────────────────────────────────

const nextStatus: Record<TaskStatus, TaskStatus> = {
  "Not Started": "In Progress",
  "In Progress": "Complete",
  "Complete":    "Not Started",
  "Blocked":     "In Progress",
  "On Hold":     "In Progress",
};

const allPriorities: TaskPriority[] = ["Critical", "High", "Medium", "Low"];

const priorityClass: Record<TaskPriority, string> = {
  Critical: "priority priority--critical",
  High:     "priority priority--high",
  Medium:   "priority priority--medium",
  Low:      "priority priority--low",
};

// Status → design-token pill class. Matches design/tasks-reference.html.
const statusPill: Record<TaskStatus, string> = {
  "Complete":    "pill pill--ok",
  "In Progress": "pill pill--warn",
  "Not Started": "pill pill--neutral",
  "Blocked":     "pill pill--risk",
  "On Hold":     "pill pill--info",
};

const milestoneById = Object.fromEntries(milestones.map((m) => [m.id, m]));

// Owner avatar class — the reference keys four owners; others fall back to navy.
function ownerClass(owner: string): string {
  const k = owner.trim().toLowerCase();
  if (k === "qa") return "owner owner--qa";
  if (k === "hr") return "owner owner--hr";
  if (k === "ar") return "owner owner--ar";
  if (k === "km") return "owner owner--km";
  return "owner";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Due-date delta vs. today, with tone-matched class.
function dueDelta(iso: string, status: TaskStatus): { label: string; cls: string } {
  if (status === "Complete") return { label: "Complete", cls: "due__delta--far" };
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return { label: `${Math.abs(days)} days overdue`, cls: "due__delta--over" };
  if (days <= 14) return { label: `in ${days} day${days === 1 ? "" : "s"}`, cls: "due__delta--soon" };
  return { label: `in ${days} days`, cls: "due__delta--far" };
}

function progressFillClass(value: number, status: TaskStatus): string {
  if (status === "Complete") return "progress__fill progress__fill--done";
  if (status === "Blocked")  return "progress__fill progress__fill--blocked";
  if (value === 0)           return "progress__fill progress__fill--zero";
  return "progress__fill";
}

function milestoneMeta(milestoneId?: string): string {
  if (!milestoneId) return "No milestone · cross-phase deliverable";
  const m = milestoneById[milestoneId];
  return m ? m.name : "No milestone · cross-phase deliverable";
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRowView({
  task, allTasks, onStatusToggle, onProgressChange, onEdit,
}: {
  task: Task;
  allTasks: Task[];
  onStatusToggle: (id: string) => void;
  onProgressChange: (id: string, value: number) => void;
  onEdit: (task: Task) => void;
}) {
  const [editingProgress, setEditingProgress] = useState(false);
  const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]));
  const delta = dueDelta(task.dueDate, task.status);
  const deps = task.dependsOn ?? [];
  const isComplete = task.status === "Complete";

  return (
    <div className="task">
      {/* Check */}
      <button
        type="button"
        className={isComplete ? "task__check task__check--done" : "task__check"}
        onClick={() => onStatusToggle(task.id)}
        title={`${task.status} — click to mark ${nextStatus[task.status]}`}
        aria-label="Advance status"
      />

      {/* ID */}
      <div className="task__id">{task.id.toUpperCase()}</div>

      {/* Name + milestone meta */}
      <div className="task__name-cell">
        <button className="task__name" onClick={() => onEdit(task)} title="Click to edit">
          {task.name}
        </button>
        <div className="task__meta">
          Milestone <strong>{milestoneMeta(task.milestoneId)}</strong>
        </div>
      </div>

      {/* Priority */}
      <div>
        <span className={priorityClass[task.priority]}>{task.priority}</span>
      </div>

      {/* Owner */}
      <div>
        <div className={ownerClass(task.owner)} title={task.owner}>{task.owner}</div>
      </div>

      {/* Due */}
      <div className="due">
        <div className="due__date">{formatDate(task.dueDate)}</div>
        <div className={`due__delta ${delta.cls}`}>{delta.label}</div>
      </div>

      {/* Progress */}
      <div className="progress">
        {editingProgress ? (
          <input
            type="range"
            min={0} max={100} step={5}
            defaultValue={task.progress}
            className="progress__range"
            autoFocus
            onBlur={(e) => { setEditingProgress(false); onProgressChange(task.id, Number(e.target.value)); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                setEditingProgress(false);
                onProgressChange(task.id, Number((e.target as HTMLInputElement).value));
              }
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="progress__bar"
              onClick={() => setEditingProgress(true)}
              title="Click to edit progress"
              aria-label="Edit progress"
            >
              <div
                className={progressFillClass(task.progress, task.status)}
                style={{ width: `${task.progress === 0 ? 2 : task.progress}%` }}
              />
            </button>
            <span className="progress__val">{task.progress}%</span>
          </>
        )}
      </div>

      {/* Status */}
      <div className="task__status">
        <button
          type="button"
          className={statusPill[task.status]}
          onClick={() => onStatusToggle(task.id)}
          title={`${task.status} — click to mark ${nextStatus[task.status]}`}
        >
          {task.status}
        </button>
      </div>

      {/* Dependencies */}
      <div className="task__deps-cell">
        {deps.length === 0 ? (
          <span className="deps--empty">No upstream</span>
        ) : (
          <div className="deps">
            {deps.slice(0, 3).map((depId) => {
              const dep = taskMap[depId];
              const cls =
                dep?.status === "Complete" ? "dep dep--done" :
                dep?.status === "Blocked"  ? "dep dep--blocked" :
                "dep";
              return (
                <span key={depId} className={cls} title={dep ? `Depends on: ${dep.name}` : depId}>
                  {depId.toUpperCase()}
                </span>
              );
            })}
            {deps.length > 3 && <span className="dep dep--more">+{deps.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workstream group (collapsible) ───────────────────────────────────────────

function WorkstreamGroupView({
  name, tasks, allTasks, onStatusToggle, onProgressChange, onEdit,
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
  const critical = tasks.some((t) => t.priority === "Critical" && t.status !== "Complete");

  const groupPill =
    blocked > 0  ? { cls: "pill pill--risk", label: "Blocked downstream" } :
    critical     ? { cls: "pill pill--warn", label: "In progress" } :
    done === total ? { cls: "pill pill--ok", label: "Complete" } :
    tasks.some((t) => t.status === "In Progress")
      ? { cls: "pill pill--info", label: "Ongoing" }
      : { cls: "pill pill--neutral", label: "Not started" };

  const metaParts = [
    `${total} task${total === 1 ? "" : "s"}`,
    blocked > 0 ? `${blocked} blocked` : critical ? "1 critical open" : "0 critical open",
    `${done} of ${total} complete`,
  ];

  return (
    <div className={open ? "ws" : "ws ws--collapsed"}>
      <button type="button" className="ws__header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <svg className="ws__caret" viewBox="0 0 16 16" fill="none">
          <path d="M5 4l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="ws__title">
          {name}
          <span className="ws__meta"><strong>{metaParts[0]}</strong> · {metaParts[1]} · {metaParts[2]}</span>
        </div>
        <div className="ws__actions">
          <span className={groupPill.cls}>{groupPill.label}</span>
        </div>
      </button>
      <div className="ws__rows">
        {tasks.map((t) => (
          <TaskRowView
            key={t.id}
            task={t}
            allTasks={allTasks}
            onStatusToggle={onStatusToggle}
            onProgressChange={onProgressChange}
            onEdit={onEdit}
          />
        ))}
      </div>
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
  const inProgress    = projectTasks.filter((t) => t.status === "In Progress").length;
  const notStarted    = projectTasks.filter((t) => t.status === "Not Started").length;
  const blockedTasks  = projectTasks.filter((t) => t.status === "Blocked").length;

  const priorityCounts: Record<TaskPriority, number> = {
    Critical: projectTasks.filter((t) => t.priority === "Critical").length,
    High:     projectTasks.filter((t) => t.priority === "High").length,
    Medium:   projectTasks.filter((t) => t.priority === "Medium").length,
    Low:      projectTasks.filter((t) => t.priority === "Low").length,
  };

  // Per-workstream summary cards
  const workstreamSummaries = workstreams.map((ws) => {
    const wsTasks = projectTasks.filter((t) => t.workstream === ws);
    const avg = wsTasks.length
      ? Math.round(wsTasks.reduce((s, t) => s + t.progress, 0) / wsTasks.length)
      : 0;
    const accent =
      wsTasks.some((t) => t.status === "Blocked")    ? "summary--risk" :
      wsTasks.some((t) => t.priority === "Critical" && t.status !== "Complete") ? "summary--warn" :
      wsTasks.some((t) => t.status === "In Progress") ? "summary--info" :
      "summary--ok";
    return { name: ws, count: wsTasks.length, avg, accent };
  });

  return (
    <>
      {/* Workstream summary strip */}
      {workstreamSummaries.length > 0 && (
        <div className="summary-strip">
          {workstreamSummaries.map((s) => (
            <div key={s.name} className={`summary ${s.accent}`}>
              <div className="summary__label">{s.name}</div>
              <div className="summary__row">
                <span className="summary__count">{s.count} <em>tasks</em></span>
                <span className="summary__pct">{s.avg}%</span>
              </div>
              <div className="summary__progress">
                <div className="summary__progress-fill" style={{ width: `${s.avg}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar — status chips + priority chips + workstream select + actions */}
      <div className="toolbar">
        <div className="toolbar__group">
          <button
            className={filterStatus === "All" ? "filter-chip filter-chip--active" : "filter-chip"}
            onClick={() => setFilterStatus("All")}
          >
            All <span className="filter-chip__count">{totalTasks}</span>
          </button>
          <button
            className={filterStatus === "In Progress" ? "filter-chip filter-chip--active" : "filter-chip"}
            onClick={() => setFilterStatus("In Progress")}
          >
            In Progress <span className="filter-chip__count">{inProgress}</span>
          </button>
          <button
            className={filterStatus === "Not Started" ? "filter-chip filter-chip--active" : "filter-chip"}
            onClick={() => setFilterStatus("Not Started")}
          >
            Not Started <span className="filter-chip__count">{notStarted}</span>
          </button>
          <button
            className={filterStatus === "Blocked" ? "filter-chip filter-chip--active" : "filter-chip"}
            onClick={() => setFilterStatus("Blocked")}
          >
            Blocked <span className="filter-chip__count">{blockedTasks}</span>
          </button>
        </div>

        <div className="toolbar__group">
          {allPriorities.slice(0, 3).map((p) => (
            <button
              key={p}
              className={filterPriority === p ? "filter-chip filter-chip--active" : "filter-chip"}
              onClick={() => setFilterPriority(filterPriority === p ? "All" : p)}
            >
              {p} <span className="filter-chip__count">{priorityCounts[p]}</span>
            </button>
          ))}
        </div>

        <div className="toolbar__select">
          Workstream:&nbsp;
          <select
            className="toolbar__select-native"
            value={filterWorkstream}
            onChange={(e) => setFilterWorkstream(e.target.value)}
          >
            <option value="All">All</option>
            {allWorkstreams.map((ws) => <option key={ws} value={ws}>{ws}</option>)}
          </select>
        </div>

        <button
          className={filterMine ? "filter-chip filter-chip--active" : "filter-chip"}
          onClick={() => setFilterMine((v) => !v)}
          title={filterMine ? "Showing only tasks you own" : "Show only tasks you own"}
          style={{ height: "32px", border: "1px solid var(--color-line-soft)", borderRadius: "var(--radius-sm)" }}
        >
          Mine
        </button>

        <div className="topbar-spacer" />

        <button className="btn btn--primary" onClick={() => setDrawer({ mode: "new" })}>
          New task
        </button>
      </div>

      {/* Tasks table */}
      {groups.length === 0 ? (
        <div className="tasks">
          <div className="tasks-empty">
            <p className="tasks-empty__title">No tasks match the current filters</p>
            <p className="tasks-empty__hint">Try clearing the workstream, priority, or status filter.</p>
          </div>
        </div>
      ) : (
        <div className="tasks">
          <div className="tasks__head">
            <div />
            <div>ID</div>
            <div>Task</div>
            <div>Priority</div>
            <div className="col-owner">Owner</div>
            <div>Due</div>
            <div>Progress</div>
            <div>Status</div>
            <div className="col-deps">Depends on</div>
          </div>

          {groups.map((g) => (
            <WorkstreamGroupView
              key={g.name}
              name={g.name}
              tasks={g.tasks}
              allTasks={projectTasks}
              onStatusToggle={handleStatusToggle}
              onProgressChange={handleProgressChange}
              onEdit={(t) => setDrawer({ mode: "edit", task: t })}
            />
          ))}

          <div className="tasks-footer">
            <span>
              {filtered.length} of {totalTasks} task{totalTasks === 1 ? "" : "s"} shown · grouped by workstream
            </span>
            <span>Click status to advance · click progress bar to edit</span>
          </div>
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

              // M23 — Dependency Resolution Workbench
              //
              // When the engine errors (today: pre-existing dependency loop),
              // we surface a workbench callout instead of just listing tasks.
              // PM sees the full chain in plain language and can resolve
              // per-edge: mark a link as parallel, remove a link, or attach a
              // note. After any action, the drawer re-runs the cascade — if
              // the loop is resolved, normal preview appears.
              if (r.error) {
                const cycleInfo = findCycleEdges(entries);
                const projTaskById = new Map(projTasks.map((t) => [t.id, t]));

                // Build workbench edges, enriched with workstream + existing note.
                const workbenchEdges = (cycleInfo?.edges ?? []).map((e) => ({
                  fromId: e.fromId,
                  fromName: e.fromName,
                  fromGroup: projTaskById.get(e.fromId)?.workstream,
                  toId: e.toId,
                  toName: e.toName,
                  toGroup: projTaskById.get(e.toId)?.workstream,
                  isSuggested: e.isBackEdge,
                  note: projTaskById.get(e.fromId)?.depNotes?.[e.toId],
                }));

                const handleMarkParallel = (fromId: string, toId: string) => {
                  const from = projTaskById.get(fromId);
                  if (!from) return;
                  const nextDependsOn = (from.dependsOn ?? []).filter((id) => id !== toId);
                  const nextParallel = Array.from(new Set([...(from.parallelDeps ?? []), toId]));
                  updateTask(
                    { ...from, dependsOn: nextDependsOn, parallelDeps: nextParallel },
                    { source: "user-edit", note: `loop resolution: marked ${fromId}->${toId} as parallel` }
                  );
                  toast.success(`Link changed to parallel`, {
                    description: `${from.name} no longer waits on ${projTaskById.get(toId)?.name ?? toId.toUpperCase()}.`,
                  });
                };

                const handleRemoveLink = (fromId: string, toId: string) => {
                  const from = projTaskById.get(fromId);
                  if (!from) return;
                  const nextDependsOn = (from.dependsOn ?? []).filter((id) => id !== toId);
                  const nextNotes = { ...(from.depNotes ?? {}) };
                  delete nextNotes[toId];
                  updateTask(
                    { ...from, dependsOn: nextDependsOn, depNotes: nextNotes },
                    { source: "user-edit", note: `loop resolution: removed ${fromId}->${toId} link` }
                  );
                  toast.success(`Link removed`, {
                    description: `${from.name} no longer references ${projTaskById.get(toId)?.name ?? toId.toUpperCase()}.`,
                  });
                };

                const handleSaveNote = (fromId: string, toId: string, note: string) => {
                  const from = projTaskById.get(fromId);
                  if (!from) return;
                  const nextNotes = { ...(from.depNotes ?? {}) };
                  if (note.trim()) nextNotes[toId] = note.trim();
                  else delete nextNotes[toId];
                  updateTask(
                    { ...from, depNotes: nextNotes },
                    { source: "user-edit", note: `loop resolution: note on ${fromId}->${toId}` }
                  );
                  toast.success("Note saved");
                };

                return {
                  sections: [{
                    kind: "callout",
                    tone: "amber",
                    title: "We couldn't preview the schedule impact",
                    body: `These tasks depend on each other in a way that loops back, so we can't compute what would shift.\n\nYour change to ${cascadePreview!.editedTask.name} will still save. Resolve a link below to unlock the full preview.`,
                    dependencyLoop: workbenchEdges.length > 0 ? {
                      edges: workbenchEdges,
                      onMarkParallel: handleMarkParallel,
                      onRemoveLink:   handleRemoveLink,
                      onSaveNote:     handleSaveNote,
                    } : undefined,
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
    </>
  );
}
