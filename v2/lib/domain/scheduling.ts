// Port of src/domain/scheduling.js — milestone dependency cascade + RAG status.
// RAG thresholds from src/config/rules.js: redDelayDays: 5, amberDelayDays: 0.

import {
  addWorkingDays,
  compare,
  daysBetween,
  workingDaysBetween,
  today as todayFn,
} from "./dates";

// Default RAG thresholds — match v1's src/config/rules.js. These are overridable
// per call via the optional `thresholds` arg on computeRAG().
export const DEFAULT_RAG_THRESHOLDS = {
  redDelayDays: 5,
  amberDelayDays: 0,
} as const;

export interface RagThresholds {
  redDelayDays?: number;
  amberDelayDays?: number;
}

export interface ScheduleMilestone {
  id: number;
  name?: string;
  phase?: string;
  predecessor?: number;
  lag?: number;
  duration?: number;
  plannedStart?: string;
  plannedEnd?: string;
  status?: string;
  lockDate?: boolean;
}

export interface TopoResult {
  sorted: number[] | null;
  hasCycle: boolean;
}

export interface CascadeResult {
  milestones: ScheduleMilestone[];
  error: string | null;
}

export interface DependencyStatus {
  status: "Clear" | "Waiting" | "Blocked";
}

export interface PreviewCascadeResult {
  affected: {
    id: number;
    name?: string;
    oldStart?: string;
    newStart?: string;
    oldEnd?: string;
    newEnd?: string;
    daysShifted: number;
  }[];
  error: string | null;
}

export type RAG = "Green" | "Amber" | "Red";

export function topologicalSort(milestones: ScheduleMilestone[]): TopoResult {
  const graph: Record<number, number[]> = {};
  const inDegree: Record<number, number> = {};
  milestones.forEach((m) => {
    graph[m.id] = [];
    inDegree[m.id] = 0;
  });
  milestones.forEach((m) => {
    if (m.predecessor !== undefined && graph[m.predecessor] !== undefined) {
      graph[m.predecessor].push(m.id);
      inDegree[m.id]++;
    }
  });
  const queue: number[] = [];
  const sorted: number[] = [];
  Object.keys(inDegree).forEach((id) => {
    if (inDegree[Number(id)] === 0) queue.push(Number(id));
  });
  while (queue.length) {
    const n = queue.shift()!;
    sorted.push(n);
    (graph[n] || []).forEach((succ) => {
      inDegree[succ]--;
      if (inDegree[succ] === 0) queue.push(succ);
    });
  }
  return {
    sorted: sorted.length === milestones.length ? sorted : null,
    hasCycle: sorted.length < milestones.length,
  };
}

export function cascade(
  milestones: ScheduleMilestone[],
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): CascadeResult {
  const topo = topologicalSort(milestones);
  if (!topo.sorted) {
    return { milestones: milestones.slice(), error: "Circular dependency" };
  }
  const result = milestones.map((m) => ({ ...m }));
  const byId: Record<number, ScheduleMilestone> = {};
  result.forEach((m) => { byId[m.id] = m; });

  topo.sorted.forEach((id) => {
    const ms = byId[id];
    if (ms.lockDate === true) return;
    if (ms.predecessor !== undefined) {
      const pred = byId[ms.predecessor];
      if (pred && pred.plannedEnd) {
        const lag = parseInt(String(ms.lag ?? 0)) || 0;
        const newStart = addWorkingDays(pred.plannedEnd, 1 + lag, workingDays, holidays);
        if (!newStart) return;
        if (
          compare(newStart, ms.plannedStart ?? "") > 0 ||
          ms.status === "Not Started"
        ) {
          ms.plannedStart = newStart;
          const dur = parseInt(String(ms.duration ?? 1)) || 1;
          ms.plannedEnd = addWorkingDays(ms.plannedStart!, dur - 1, workingDays, holidays) ?? undefined;
        }
      }
    }
  });

  return { milestones: result, error: null };
}

export function computeRAG(
  milestone: Pick<ScheduleMilestone, "status" | "plannedEnd">,
  todayStr?: string,
  thresholds?: RagThresholds
): RAG {
  const t = todayStr ?? todayFn();
  const redDelay   = thresholds?.redDelayDays   ?? DEFAULT_RAG_THRESHOLDS.redDelayDays;
  const amberDelay = thresholds?.amberDelayDays ?? DEFAULT_RAG_THRESHOLDS.amberDelayDays;
  if (milestone.status === "Complete") return "Green";
  if (milestone.status === "Blocked") return "Red";
  if (!milestone.plannedEnd) return "Green";
  const delay = Math.max(0, daysBetween(milestone.plannedEnd, t));
  if (delay > redDelay)   return "Red";
  if (delay > amberDelay) return "Amber";
  return "Green";
}

export function computeDependencyStatus(
  milestone: ScheduleMilestone,
  allMilestones: ScheduleMilestone[],
  todayStr?: string
): "Clear" | "Waiting" | "Blocked" {
  if (!milestone || milestone.predecessor === undefined) return "Clear";
  const pred = allMilestones.find((m) => m.id === milestone.predecessor);
  if (!pred) return "Clear"; // broken reference: don't block
  if (pred.status === "Complete") return "Clear";
  const t = todayStr ?? todayFn();
  if (milestone.plannedStart && compare(milestone.plannedStart, t) <= 0) {
    return "Blocked";
  }
  return "Waiting";
}

export function scheduleBackward(
  milestones: ScheduleMilestone[],
  anchorDate: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): CascadeResult {
  const topo = topologicalSort(milestones);
  if (!topo.sorted) {
    return { milestones: milestones.slice(), error: "Circular dependency" };
  }
  if (!anchorDate) {
    return { milestones: milestones.slice(), error: "No anchor date" };
  }

  const result = milestones.map((m) => ({ ...m }));
  const byId: Record<number, ScheduleMilestone> = {};
  result.forEach((m) => { byId[m.id] = m; });

  const reversed = [...topo.sorted].reverse();
  reversed.forEach((id) => {
    const ms = byId[id];
    if (ms.lockDate === true) return;
    const successors = result.filter((m) => m.predecessor === id);
    const dur = parseInt(String(ms.duration ?? 1)) || 1;
    const lag = parseInt(String(ms.lag ?? 0)) || 0;

    let endDate: string | null;
    if (successors.length === 0) {
      endDate = anchorDate;
    } else {
      let earliestSuccStart: string | null = null;
      successors.forEach((succ) => {
        if (!succ.plannedStart) return;
        if (!earliestSuccStart || compare(succ.plannedStart, earliestSuccStart) < 0) {
          earliestSuccStart = succ.plannedStart;
        }
      });
      if (!earliestSuccStart) return;
      endDate = addWorkingDays(earliestSuccStart, -(1 + lag), workingDays, holidays);
    }

    if (!endDate) return;
    ms.plannedEnd = endDate;
    ms.plannedStart = addWorkingDays(endDate, -(dur - 1), workingDays, holidays) ?? undefined;
  });

  return { milestones: result, error: null };
}

export interface CascadeEdit {
  id: number;
  field: string;
  value: string | number;
}

// M20: optional per-row overrides for milestone selective cascade.
// Excluded milestones get lockDate=true so the cascade engine respects them.
// Overridden milestones get plannedEnd set + lockDate=true so cascade applies
// the manual value and doesn't move it.
export interface MilestoneCascadeOpts {
  excludeIds?: Set<number>;
  overrides?: Record<number, string>; // milestoneId → manual plannedEnd
  workingDays?: number[];
  holidays?: string[];
}

export function previewCascade(
  milestones: ScheduleMilestone[],
  edit: CascadeEdit,
  workingDaysOrOpts: number[] | MilestoneCascadeOpts = [1, 2, 3, 4, 5],
  holidays: string[] = []
): PreviewCascadeResult {
  const opts: MilestoneCascadeOpts = Array.isArray(workingDaysOrOpts)
    ? { workingDays: workingDaysOrOpts, holidays }
    : workingDaysOrOpts;
  const wd       = opts.workingDays ?? [1, 2, 3, 4, 5];
  const hols     = opts.holidays    ?? [];
  const excludes = opts.excludeIds  ?? new Set<number>();
  const overrides = opts.overrides  ?? {};

  if (!edit || edit.field == null) return { affected: [], error: null };
  const scheduleFields = ["plannedStart", "plannedEnd", "duration", "predecessor", "lag"];
  if (!scheduleFields.includes(edit.field)) return { affected: [], error: null };

  const hypothetical: ScheduleMilestone[] = milestones.map((m) => {
    if (m.id === edit.id) {
      const copy: ScheduleMilestone = { ...m, [edit.field]: edit.value };
      if (edit.field === "duration" && copy.plannedStart) {
        const dur = parseInt(String(copy.duration)) || 1;
        copy.plannedEnd = addWorkingDays(copy.plannedStart, dur - 1, wd, hols) ?? undefined;
      }
      return copy;
    }
    // M20: apply exclusion / override
    if (overrides[m.id] !== undefined) {
      const dur = parseInt(String(m.duration ?? 1)) || 1;
      const newEnd = overrides[m.id];
      const newStart = addWorkingDays(newEnd, -(dur - 1), wd, hols) ?? m.plannedStart;
      return { ...m, plannedEnd: newEnd, plannedStart: newStart, lockDate: true };
    }
    if (excludes.has(m.id)) {
      return { ...m, lockDate: true };
    }
    return { ...m };
  });

  const cascadeResult = cascade(hypothetical, wd, hols);
  if (cascadeResult.error) return { affected: [], error: cascadeResult.error };

  const originalById: Record<number, ScheduleMilestone> = {};
  milestones.forEach((m) => { originalById[m.id] = m; });

  const affected: PreviewCascadeResult["affected"] = [];
  cascadeResult.milestones.forEach((after) => {
    if (after.id === edit.id) return;
    const before = originalById[after.id];
    if (!before) return;
    const startShifted = before.plannedStart !== after.plannedStart;
    const endShifted = before.plannedEnd !== after.plannedEnd;
    if (startShifted || endShifted) {
      let daysShifted = 0;
      // M20.5 PL-3 — working-day delta, not calendar-day delta
      if (before.plannedStart && after.plannedStart) {
        daysShifted = workingDaysBetween(before.plannedStart, after.plannedStart, wd, hols);
      }
      affected.push({
        id: after.id,
        name: after.name,
        oldStart: before.plannedStart,
        newStart: after.plannedStart,
        oldEnd: before.plannedEnd,
        newEnd: after.plannedEnd,
        daysShifted,
      });
    }
  });

  return { affected, error: null };
}

// ─── Critical path ───────────────────────────────────────────────────────────
//
// Forward pass: ES/EF taken directly from milestones.plannedStart / plannedEnd
//   (since cascade has already enforced predecessor relationships).
// Backward pass: starting from terminal milestones, compute LS/LF respecting
//   predecessor + lag chains. Slack = workingDaysBetween(ES, LS).
// A milestone is on the critical path iff slack === 0.

export function computeCriticalPath(
  milestones: ScheduleMilestone[],
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): { criticalIds: Set<number>; slackById: Record<number, number> } {
  const result = { criticalIds: new Set<number>(), slackById: {} as Record<number, number> };
  if (milestones.length === 0) return result;

  const topo = topologicalSort(milestones);
  if (!topo.sorted) return result; // cycle → no meaningful CP

  const byId: Record<number, ScheduleMilestone> = {};
  milestones.forEach((m) => { byId[m.id] = m; });

  // Project end = latest plannedEnd across all milestones
  let projectEnd: string | null = null;
  milestones.forEach((m) => {
    if (m.plannedEnd && (!projectEnd || compare(m.plannedEnd, projectEnd) > 0)) {
      projectEnd = m.plannedEnd;
    }
  });
  if (!projectEnd) return result;

  // Backward pass: for each milestone in reverse topo order, compute LS/LF.
  // - Terminal milestones (no successors): LF = projectEnd
  // - Others: LF = min over successors of (LS[succ] - lag[succ] - 1 working day)
  const LF: Record<number, string> = {};
  const LS: Record<number, string> = {};
  const reversed = [...topo.sorted].reverse();

  reversed.forEach((id) => {
    const m = byId[id];
    const successors = milestones.filter((x) => x.predecessor === id);
    const dur = parseInt(String(m.duration ?? 1)) || 1;

    let lfDate: string | null;
    if (successors.length === 0) {
      lfDate = projectEnd;
    } else {
      let earliest: string | null = null;
      for (const s of successors) {
        const sLag = parseInt(String(s.lag ?? 0)) || 0;
        const sLS = LS[s.id];
        if (!sLS) continue;
        // Latest m can finish = succ.LS - lag - 1 working day
        const cap = addWorkingDays(sLS, -(1 + sLag), workingDays, holidays);
        if (!cap) continue;
        if (!earliest || compare(cap, earliest) < 0) earliest = cap;
      }
      lfDate = earliest;
    }
    if (!lfDate) return;
    LF[id] = lfDate;
    const ls = addWorkingDays(lfDate, -(dur - 1), workingDays, holidays);
    if (ls) LS[id] = ls;
  });

  // Slack = working days between ES (=plannedStart) and LS
  milestones.forEach((m) => {
    const ls = LS[m.id];
    if (!ls || !m.plannedStart) {
      result.slackById[m.id] = 0;
      result.criticalIds.add(m.id);
      return;
    }
    // Count working days between plannedStart and LS
    let slack = 0;
    if (compare(ls, m.plannedStart) > 0) {
      // ls is after plannedStart → positive slack
      let cursor = m.plannedStart;
      let guard = 0;
      while (compare(cursor, ls) < 0 && guard < 10000) {
        const next = addWorkingDays(cursor, 1, workingDays, holidays);
        if (!next || next === cursor) break;
        cursor = next;
        slack++;
        guard++;
      }
    }
    result.slackById[m.id] = slack;
    if (slack === 0) result.criticalIds.add(m.id);
  });

  return result;
}

// ─── Task cascade (M18) ─────────────────────────────────────────────────────
//
// Tasks have a single date (`dueDate`) and FS dependencies via `dependsOn[]`.
// Cascade rule: for each task, `dueDate >= max(dep.dueDate) + 1 working day`.
// Forward-walks the reverse-index (taskId → dependents) until no more shifts.
// Defensive against cycles via a visited set + iteration cap.

export interface TaskScheduleEntry {
  id: string;
  name?: string;
  dueDate: string;
  dependsOn?: string[];
  milestoneId?: string;
}

export interface TaskCascadeEdit {
  id: string;
  newDueDate: string;
}

// M20: optional per-row overrides for selective cascade.
// - excludeIds: tasks PM decided NOT to shift. They keep their original date
//   and do not propagate (their downstream sees no push from them).
// - overrides:  taskId → manual newDate the PM typed. Used in place of the
//   engine's computed earliest-allowed; propagation continues from that
//   override (may be earlier or later than the engine suggested).
export interface CascadeOpts {
  excludeIds?: Set<string>;
  overrides?: Record<string, string>;
  workingDays?: number[];
  holidays?: string[];
  // M20.5 PL-11 — when true (default), the cascade suppresses shifts that
  // exist only to fix pre-existing constraint violations (i.e. violations
  // present in the input data BEFORE the user's edit is applied). Set false
  // for the rare case where the caller wants the engine to "settle"
  // pre-existing inconsistencies (e.g. a one-off data-cleanup pass).
  respectPreExisting?: boolean;
}

export interface TaskCascadeResult {
  tasks: TaskScheduleEntry[]; // updated tasks (originals not mutated)
  affected: {
    id: string;
    name?: string;
    oldDue: string;
    newDue: string;
    daysShifted: number;
  }[];
  error: string | null;
}

// Topological sort for tasks with dependsOn[] adjacency.
// Returns sorted = null if there's a cycle. Used by previewTaskCascade to
// guarantee single-pass correctness and reject invalid data shapes.
export function topoSortTasks(
  tasks: TaskScheduleEntry[]
): { sorted: string[] | null; hasCycle: boolean; cyclePath?: string[] } {
  const inDegree: Record<string, number> = {};
  const outEdges: Record<string, string[]> = {};
  tasks.forEach((t) => { inDegree[t.id] = 0; outEdges[t.id] = []; });
  tasks.forEach((t) => {
    (t.dependsOn ?? []).forEach((dep) => {
      if (outEdges[dep] !== undefined && inDegree[t.id] !== undefined) {
        outEdges[dep].push(t.id);
        inDegree[t.id]++;
      }
    });
  });
  const queue: string[] = [];
  Object.keys(inDegree).forEach((id) => { if (inDegree[id] === 0) queue.push(id); });
  const sorted: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    sorted.push(n);
    outEdges[n].forEach((succ) => {
      inDegree[succ]--;
      if (inDegree[succ] === 0) queue.push(succ);
    });
  }
  if (sorted.length === tasks.length) return { sorted, hasCycle: false };

  // Surface the cycle's tasks (those still with in-degree > 0) for the UI
  const cyclePath = Object.keys(inDegree).filter((id) => inDegree[id] > 0);
  return { sorted: null, hasCycle: true, cyclePath };
}

export function previewTaskCascade(
  tasks: TaskScheduleEntry[],
  edit: TaskCascadeEdit,
  workingDaysOrOpts: number[] | CascadeOpts = [1, 2, 3, 4, 5],
  holidays: string[] = []
): TaskCascadeResult {
  // Back-compat: previewTaskCascade(tasks, edit, workingDays, holidays)
  // M20 form:   previewTaskCascade(tasks, edit, { excludeIds, overrides, workingDays, holidays })
  const opts: CascadeOpts = Array.isArray(workingDaysOrOpts)
    ? { workingDays: workingDaysOrOpts, holidays }
    : workingDaysOrOpts;
  const workingDays = opts.workingDays ?? [1, 2, 3, 4, 5];
  const hols        = opts.holidays    ?? [];
  const excludeIds  = opts.excludeIds  ?? new Set<string>();
  const overrides   = opts.overrides   ?? {};
  const respectPreExisting = opts.respectPreExisting ?? true; // M20.5 PL-11

  // M20.1: topo-sort first. Cycles are surfaced as errors rather than
  // producing wrong results via a runaway BFS.
  const topo = topoSortTasks(tasks);
  if (!topo.sorted) {
    return {
      tasks: tasks.slice(),
      affected: [],
      error: `Dependency cycle detected — cannot cascade. Tasks involved: ${(topo.cyclePath ?? []).map((id) => id.toUpperCase()).join(" → ")}`,
    };
  }

  // Clone tasks (no input mutation)
  const byId: Record<string, TaskScheduleEntry> = {};
  tasks.forEach((t) => { byId[t.id] = { ...t }; });

  if (!byId[edit.id]) {
    return { tasks: tasks.slice(), affected: [], error: "Edited task not found" };
  }

  // Snapshot originals for the diff at the end
  const originalDates: Record<string, string> = {};
  tasks.forEach((t) => { originalDates[t.id] = t.dueDate; });

  // M20.5 PL-11 — phantom-edit guard. If the user's edit is a no-op
  // (newDueDate === currentDueDate), short-circuit with no shifts. This
  // prevents a click-Save-without-change from silently re-dating downstream
  // tasks that had pre-existing constraint violations. Pre-existing
  // violations remain visible via findConstraintViolations() and the
  // M20.2 Project Health card — the engine reports, never silently fixes.
  if (respectPreExisting && originalDates[edit.id] === edit.newDueDate) {
    return { tasks: tasks.slice(), affected: [], error: null };
  }

  // Apply the user's edit
  byId[edit.id].dueDate = edit.newDueDate;

  // Single pass in topological order. Each task sees its upstreams' final
  // (possibly shifted) dates because they're processed first.
  for (const id of topo.sorted) {
    if (id === edit.id) continue;
    const t = byId[id];

    // Excluded → keep its original date and don't propagate effects from it
    if (excludeIds.has(id)) continue;

    // Override → use the manual value, regardless of what the engine would suggest
    const overrideDate = overrides[id];
    if (overrideDate !== undefined) {
      t.dueDate = overrideDate;
      continue;
    }

    // Otherwise compute earliest from upstreams and shift if needed
    const upstreamDates = (t.dependsOn ?? [])
      .map((depId) => byId[depId]?.dueDate)
      .filter((d): d is string => !!d);
    if (upstreamDates.length === 0) continue;

    const latest = upstreamDates.reduce((a, b) => (a > b ? a : b));
    const earliest = addWorkingDays(latest, 1, workingDays, hols);
    if (!earliest) continue;
    if (compare(t.dueDate, earliest) < 0) {
      t.dueDate = earliest;
    }
  }

  // Diff
  const affected: TaskCascadeResult["affected"] = [];
  for (const id of topo.sorted) {
    if (id === edit.id) continue;
    const t = byId[id];
    const original = originalDates[id];
    if (t.dueDate !== original) {
      affected.push({
        id: t.id, name: t.name,
        oldDue: original, newDue: t.dueDate,
        // M20.5 PL-3 — working-day delta (PMs read the schedule in working days)
        daysShifted: workingDaysBetween(original, t.dueDate, workingDays, hols),
      });
    }
  }

  return { tasks: Object.values(byId), affected, error: null };
}

// ─── Constraint violation detection (M20) ────────────────────────────────────
//
// After the PM applies exclusions / overrides, some task dependencies may end
// up violated (a task is now due before its upstream). We don't block — but we
// surface these so the PM owns the decision.

export interface ConstraintViolation {
  taskId: string;
  taskName?: string;
  taskDue: string;
  depId: string;
  depName?: string;
  depDue: string;
  daysBehind: number; // positive = task is N working days short of dep+1
}

// M20.1: grouped representation — one entry per violating task with its
// full list of broken upstreams. Cleaner for the UI than the per-pair shape.
export interface GroupedViolation {
  taskId: string;
  taskName?: string;
  taskDue: string;
  brokenDeps: {
    depId: string;
    depName?: string;
    depDue: string;
    daysBehind: number;
  }[];
}

export function groupViolationsByTask(raw: ConstraintViolation[]): GroupedViolation[] {
  const byTask: Record<string, GroupedViolation> = {};
  raw.forEach((v) => {
    const g = byTask[v.taskId] ||= {
      taskId: v.taskId,
      taskName: v.taskName,
      taskDue: v.taskDue,
      brokenDeps: [],
    };
    g.brokenDeps.push({
      depId: v.depId, depName: v.depName,
      depDue: v.depDue, daysBehind: v.daysBehind,
    });
  });
  return Object.values(byTask);
}

// M20.1: returns the violations that are NEW relative to a baseline.
// Same (taskId, depId) pair = same violation, even if dates changed.
// Used by the drawer to surface only violations caused by THIS edit/choices.
export function diffViolations(
  before: ConstraintViolation[],
  after: ConstraintViolation[]
): { newOnes: ConstraintViolation[]; resolved: ConstraintViolation[] } {
  const beforeKeys = new Set(before.map((b) => `${b.taskId}|${b.depId}`));
  const afterKeys  = new Set(after.map((a) => `${a.taskId}|${a.depId}`));
  return {
    newOnes:  after.filter((a) => !beforeKeys.has(`${a.taskId}|${a.depId}`)),
    resolved: before.filter((b) => !afterKeys.has(`${b.taskId}|${b.depId}`)),
  };
}

export function findConstraintViolations(
  tasks: TaskScheduleEntry[],
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): ConstraintViolation[] {
  const byId: Record<string, TaskScheduleEntry> = {};
  tasks.forEach((t) => { byId[t.id] = t; });

  const violations: ConstraintViolation[] = [];
  tasks.forEach((t) => {
    (t.dependsOn ?? []).forEach((depId) => {
      const dep = byId[depId];
      if (!dep) return;
      const earliest = addWorkingDays(dep.dueDate, 1, workingDays, holidays);
      if (!earliest) return;
      if (compare(t.dueDate, earliest) < 0) {
        violations.push({
          taskId: t.id,
          taskName: t.name,
          taskDue: t.dueDate,
          depId: dep.id,
          depName: dep.name,
          depDue: dep.dueDate,
          // M20.5 PL-3 — working-day delta
          daysBehind: workingDaysBetween(t.dueDate, earliest, workingDays, holidays),
        });
      }
    });
  });
  return violations;
}

// Cross-entity (M20.3): bidirectional task↔milestone cascade.
//
// When a milestone's plannedDate moves earlier than a linked task, that task
// becomes a conflict (its dueDate is now after its supporting milestone) and
// needs to shift back. When the milestone moves later, linked tasks gain slack
// (informational only, no shift required).
//
// previewMilestoneToTaskImpact returns:
//   - conflicts:  tasks whose dueDate > new milestone planned date (rose)
//   - slack:      tasks whose dueDate < new milestone planned date (blue, info)

export interface MilestoneToTaskWarning {
  taskId: string;
  taskName?: string;
  taskDue: string;
  milestoneNewDate: string;
}

export interface MilestoneToTaskSlackInfo {
  taskId: string;
  taskName?: string;
  taskDue: string;
  milestoneNewDate: string;
  slackDays: number;          // working days of headroom now available
}

export function previewMilestoneToTaskImpact(
  tasks: TaskScheduleEntry[],
  milestoneId: string,
  newPlannedDate: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): {
  conflicts: MilestoneToTaskWarning[];
  slack: MilestoneToTaskSlackInfo[];
} {
  const conflicts: MilestoneToTaskWarning[] = [];
  const slack: MilestoneToTaskSlackInfo[] = [];

  tasks
    .filter((t) => t.milestoneId === milestoneId)
    .forEach((t) => {
      if (compare(t.dueDate, newPlannedDate) > 0) {
        // Task due AFTER new milestone planned — conflict
        conflicts.push({
          taskId: t.id, taskName: t.name,
          taskDue: t.dueDate, milestoneNewDate: newPlannedDate,
        });
      } else if (compare(t.dueDate, newPlannedDate) < 0) {
        // Task due BEFORE new milestone planned — slack created
        // Compute working-day slack between taskDue and milestoneNewDate
        let cursor = t.dueDate;
        let days = 0;
        let guard = 0;
        while (compare(cursor, newPlannedDate) < 0 && guard < 10_000) {
          const next = addWorkingDays(cursor, 1, workingDays, holidays);
          if (!next || next === cursor) break;
          cursor = next;
          days++;
          guard++;
        }
        slack.push({
          taskId: t.id, taskName: t.name,
          taskDue: t.dueDate, milestoneNewDate: newPlannedDate,
          slackDays: days,
        });
      }
    });

  return { conflicts, slack };
}

// M20.3: task → milestone propagation. When a task shifts past its linked
// milestone, the milestone needs to shift too (or the user must explicitly
// opt-out via M20 exclusion). Computed AFTER the task cascade has been run
// so it sees the cascaded task dueDates.
export interface TaskToMilestonePush {
  milestoneId: string;
  milestoneName?: string;
  oldPlannedDate: string;
  proposedNewDate: string;
  drivenByTaskId: string;
  drivenByTaskName?: string;
  daysShifted: number;
}

// M20.5 PL-2 — when a milestone push propagates via predecessor chains
// to other milestones, those are appended as `transitive: true`. The
// originating tasks-driven shifts are `transitive: false`.
export interface TaskToMilestonePushOpts {
  gateBufferWorkingDays?: number; // M20.5 PL-4 — default 1
  workingDays?: number[];
  holidays?: string[];
}

export function previewTaskToMilestonePush(
  cascadedTasks: TaskScheduleEntry[],
  milestones: ScheduleMilestone[],
  msIdToString: (n: number) => string,
  opts: TaskToMilestonePushOpts = {},
): (TaskToMilestonePush & { transitive?: boolean })[] {
  // For each task with milestoneId, find the linked milestone. If task.dueDate
  // is now AFTER the milestone's plannedEnd, propose pushing the milestone.
  // Group by milestone — the binding constraint is the latest task driving the push.
  const gateBuffer = opts.gateBufferWorkingDays ?? 1; // M20.5 PL-4
  const wd  = opts.workingDays ?? [1, 2, 3, 4, 5];
  const hols = opts.holidays   ?? [];

  const proposalsByMs: Record<string, TaskToMilestonePush & { transitive?: boolean }> = {};

  cascadedTasks.forEach((t) => {
    if (!t.milestoneId) return;
    // Find milestone — IDs are stringified in tasks, numeric in ScheduleMilestone
    const ms = milestones.find((m) => msIdToString(m.id) === t.milestoneId);
    if (!ms || !ms.plannedEnd) return;
    if (compare(t.dueDate, ms.plannedEnd) <= 0) return;

    // M20.5 PL-4 — milestone lands gateBuffer working days AFTER the last task
    // (industry convention: milestone = gate review, happens after deliverable)
    const proposedDate = addWorkingDays(t.dueDate, gateBuffer, wd, hols) ?? t.dueDate;

    const existing = proposalsByMs[t.milestoneId];
    if (existing && compare(proposedDate, existing.proposedNewDate) <= 0) return;

    proposalsByMs[t.milestoneId] = {
      milestoneId: t.milestoneId,
      milestoneName: ms.name,
      oldPlannedDate: ms.plannedEnd,
      proposedNewDate: proposedDate,
      drivenByTaskId: t.id,
      drivenByTaskName: t.name,
      // M20.5 PL-3 — working-day delta
      daysShifted: workingDaysBetween(ms.plannedEnd, proposedDate, wd, hols),
      transitive: false,
    };
  });

  // M20.5 PL-2 — transitive milestone-to-milestone propagation. For each task-
  // driven proposal, run previewCascade with that proposal as the edit; any
  // additional milestones that shift are appended as transitive proposals.
  // Originator is the originating task-driven proposal (drivenByTaskId carries
  // over for traceability — "this milestone shifts because m6 shifts because t1 pushed").
  const taskDriven = Object.values(proposalsByMs);
  taskDriven.forEach((tdp) => {
    const msNum = parseInt(tdp.milestoneId.replace(/[^0-9]/g, ""), 10);
    if (Number.isNaN(msNum)) return;
    const r = previewCascade(
      milestones,
      { id: msNum, field: "plannedEnd", value: tdp.proposedNewDate },
      { workingDays: wd, holidays: hols }
    );
    if (r.error) return;
    r.affected.forEach((a) => {
      const transitiveId = msIdToString(a.id);
      if (proposalsByMs[transitiveId]) return; // already proposed via task
      proposalsByMs[transitiveId] = {
        milestoneId: transitiveId,
        milestoneName: a.name,
        oldPlannedDate: a.oldEnd ?? "",
        proposedNewDate: a.newEnd ?? "",
        drivenByTaskId: tdp.drivenByTaskId,
        drivenByTaskName: tdp.drivenByTaskName,
        // Already working days from previewCascade post-M20.5
        daysShifted: a.daysShifted,
        transitive: true,
      };
    });
  });

  return Object.values(proposalsByMs);
}

export function computeEndFromDuration(
  startDate: string,
  duration: number,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): string | null {
  if (!startDate) return null;
  const dur = parseInt(String(duration)) || 1;
  return addWorkingDays(startDate, dur - 1, workingDays, holidays);
}

export function computeDurationFromDates(
  startDate: string,
  endDate: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): number | null {
  if (!startDate || !endDate) return null;
  if (compare(startDate, endDate) > 0) return null;
  let count = 0;
  let cursor = startDate;
  let guard = 0;
  while (compare(cursor, endDate) <= 0) {
    count++;
    const next = addWorkingDays(cursor, 1, workingDays, holidays);
    if (!next || next === cursor) break;
    cursor = next;
    guard++;
    if (guard > 10000) break;
  }
  return count;
}
