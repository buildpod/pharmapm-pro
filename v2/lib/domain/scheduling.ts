// Port of src/domain/scheduling.js — milestone dependency cascade + RAG status.
// RAG thresholds from src/config/rules.js: redDelayDays: 5, amberDelayDays: 0.

import {
  addWorkingDays,
  compare,
  daysBetween,
  today as todayFn,
} from "./dates";

const RAG_CONFIG = {
  redDelayDays: 5,
  amberDelayDays: 0,
};

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
  todayStr?: string
): RAG {
  const t = todayStr ?? todayFn();
  if (milestone.status === "Complete") return "Green";
  if (milestone.status === "Blocked") return "Red";
  if (!milestone.plannedEnd) return "Green";
  const delay = Math.max(0, daysBetween(milestone.plannedEnd, t));
  if (delay > RAG_CONFIG.redDelayDays) return "Red";
  if (delay > RAG_CONFIG.amberDelayDays) return "Amber";
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
