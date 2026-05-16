// Port of src/domain/scheduling.js — milestone dependency cascade + RAG status.
// RAG thresholds from src/config/rules.js: redDelayDays: 5, amberDelayDays: 0.

import {
  addWorkingDays,
  compare,
  daysBetween,
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

export function previewCascade(
  milestones: ScheduleMilestone[],
  edit: CascadeEdit,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): PreviewCascadeResult {
  if (!edit || edit.field == null) return { affected: [], error: null };
  const scheduleFields = ["plannedStart", "plannedEnd", "duration", "predecessor", "lag"];
  if (!scheduleFields.includes(edit.field)) return { affected: [], error: null };

  const hypothetical: ScheduleMilestone[] = milestones.map((m) => {
    if (m.id !== edit.id) return { ...m };
    const copy: ScheduleMilestone = { ...m, [edit.field]: edit.value };
    if (edit.field === "duration" && copy.plannedStart) {
      const dur = parseInt(String(copy.duration)) || 1;
      copy.plannedEnd = addWorkingDays(copy.plannedStart, dur - 1, workingDays, holidays) ?? undefined;
    }
    return copy;
  });

  const cascadeResult = cascade(hypothetical, workingDays, holidays);
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
      if (before.plannedStart && after.plannedStart) {
        daysShifted = daysBetween(before.plannedStart, after.plannedStart);
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

export function previewTaskCascade(
  tasks: TaskScheduleEntry[],
  edit: TaskCascadeEdit,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): TaskCascadeResult {
  // Reverse index: taskId → tasks that depend on it
  const dependents: Record<string, string[]> = {};
  tasks.forEach((t) => {
    (t.dependsOn ?? []).forEach((dep) => {
      (dependents[dep] ||= []).push(t.id);
    });
  });

  // Clone tasks so we don't mutate input
  const byId: Record<string, TaskScheduleEntry> = {};
  tasks.forEach((t) => { byId[t.id] = { ...t }; });

  if (!byId[edit.id]) {
    return { tasks, affected: [], error: "Edited task not found" };
  }

  // Apply the original edit
  const oldEditedDue = byId[edit.id].dueDate;
  byId[edit.id].dueDate = edit.newDueDate;

  const affected: TaskCascadeResult["affected"] = [];
  const visited = new Set<string>();
  const queue: string[] = [edit.id];
  let guard = 0;

  while (queue.length > 0) {
    if (guard++ > 10_000) {
      return { tasks: Object.values(byId), affected, error: "Cascade overflow (possible cycle)" };
    }
    const curId = queue.shift()!;
    if (visited.has(curId)) continue;
    visited.add(curId);

    const downstreams = dependents[curId] ?? [];
    for (const dId of downstreams) {
      const dep = byId[dId];
      if (!dep) continue;
      // Required earliest due = max(all of its deps' due) + 1 working day
      const allDeps = (dep.dependsOn ?? [])
        .map((id) => byId[id]?.dueDate)
        .filter((d): d is string => !!d);
      if (allDeps.length === 0) continue;
      const latestDep = allDeps.reduce((a, b) => (a > b ? a : b));
      const earliestAllowed = addWorkingDays(latestDep, 1, workingDays, holidays);
      if (!earliestAllowed) continue;
      if (compare(dep.dueDate, earliestAllowed) < 0) {
        const oldDue = dep.dueDate;
        const newDue = earliestAllowed;
        dep.dueDate = newDue;
        const days = daysBetween(oldDue, newDue);
        affected.push({ id: dep.id, name: dep.name, oldDue, newDue, daysShifted: days });
        queue.push(dId);
      }
    }
  }

  // Include the originating change in the result for the UI to display the
  // "edit summary" header. (Stored in affected only if it actually shifted;
  // the originator is always the user's edit, surfaced separately by the UI.)
  void oldEditedDue;
  return { tasks: Object.values(byId), affected, error: null };
}

// Cross-entity: when a milestone's plannedDate moves, find tasks that link to
// it and now end after it (logical contradiction). Soft flag only — does not
// auto-shift, because task→milestone is a logical/rollup link, not a strict
// precedence the engine should enforce.

export interface MilestoneToTaskWarning {
  taskId: string;
  taskName?: string;
  taskDue: string;
  milestoneNewDate: string;
}

export function previewMilestoneToTaskImpact(
  tasks: TaskScheduleEntry[],
  milestoneId: string,
  newPlannedDate: string
): MilestoneToTaskWarning[] {
  return tasks
    .filter((t) => t.milestoneId === milestoneId && compare(t.dueDate, newPlannedDate) > 0)
    .map((t) => ({
      taskId: t.id,
      taskName: t.name,
      taskDue: t.dueDate,
      milestoneNewDate: newPlannedDate,
    }));
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
