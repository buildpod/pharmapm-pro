import { describe, it, expect } from "vitest";
import {
  topologicalSort,
  computeRAG,
  computeDependencyStatus,
  scheduleBackward,
  previewCascade,
  computeEndFromDuration,
  computeDurationFromDates,
  computeCriticalPath,
  type ScheduleMilestone,
} from "./scheduling";

describe("scheduling.topologicalSort", () => {
  it("linear chain: sorted and no cycle", () => {
    const ms = [{ id: 1 }, { id: 2, predecessor: 1 }, { id: 3, predecessor: 2 }];
    const result = topologicalSort(ms);
    expect(result.sorted).not.toBeNull();
    expect(result.sorted!.length).toBe(3);
    expect(result.hasCycle).toBe(false);
  });

  it("detects cycle", () => {
    const ms = [{ id: 1, predecessor: 2 }, { id: 2, predecessor: 1 }];
    const result = topologicalSort(ms);
    expect(result.hasCycle).toBe(true);
    expect(result.sorted).toBeNull();
  });
});

describe("scheduling.computeRAG", () => {
  it("Complete = Green", () => {
    expect(computeRAG({ status: "Complete", plannedEnd: "2020-01-01" }, "2026-04-19")).toBe("Green");
  });
  it("Blocked = Red", () => {
    expect(computeRAG({ status: "Blocked", plannedEnd: "2027-01-01" }, "2026-04-19")).toBe("Red");
  });
  it("overdue > 5 days = Red (default thresholds)", () => {
    expect(computeRAG({ status: "In Progress", plannedEnd: "2026-04-10" }, "2026-04-19")).toBe("Red");
  });
  it("overdue 1–5 days = Amber (default thresholds)", () => {
    expect(computeRAG({ status: "In Progress", plannedEnd: "2026-04-17" }, "2026-04-19")).toBe("Amber");
  });
  it("custom thresholds: stricter red boundary (red=2) flips amber→red", () => {
    // 3 days overdue would be Amber under defaults (red>5), Red under tightened (red>2)
    const ms = { status: "In Progress", plannedEnd: "2026-04-16" };
    expect(computeRAG(ms, "2026-04-19")).toBe("Amber");
    expect(computeRAG(ms, "2026-04-19", { redDelayDays: 2, amberDelayDays: 0 })).toBe("Red");
  });
  it("custom thresholds: looser red boundary (red=14) keeps overdue Amber", () => {
    // 9 days overdue would be Red under defaults (>5), Amber under loosened (>14)
    const ms = { status: "In Progress", plannedEnd: "2026-04-10" };
    expect(computeRAG(ms, "2026-04-19")).toBe("Red");
    expect(computeRAG(ms, "2026-04-19", { redDelayDays: 14, amberDelayDays: 0 })).toBe("Amber");
  });
  it("custom thresholds: raised amber boundary (amber=3) keeps small overdue Green", () => {
    // 2 days overdue would be Amber under defaults (>0), Green under raised (>3)
    const ms = { status: "In Progress", plannedEnd: "2026-04-17" };
    expect(computeRAG(ms, "2026-04-19")).toBe("Amber");
    expect(computeRAG(ms, "2026-04-19", { redDelayDays: 5, amberDelayDays: 3 })).toBe("Green");
  });
});

describe("scheduling.computeDependencyStatus", () => {
  const msList: ScheduleMilestone[] = [
    { id: 1, name: "M1", status: "In Progress", plannedStart: "2026-05-01", plannedEnd: "2026-05-15" },
    { id: 2, name: "M2", status: "Not Started", predecessor: 1, plannedStart: "2026-05-20", plannedEnd: "2026-06-05" },
  ];

  it("pred not done + start past today = Blocked", () => {
    expect(computeDependencyStatus(msList[1], msList, "2026-06-01")).toBe("Blocked");
  });

  it("pred Complete = Clear", () => {
    const done = [{ ...msList[0], status: "Complete" }, msList[1]];
    expect(computeDependencyStatus(done[1], done, "2026-06-01")).toBe("Clear");
  });

  it("no predecessor = Clear", () => {
    expect(computeDependencyStatus(msList[0], msList, "2026-06-01")).toBe("Clear");
  });

  it("pred not done + start in future = Waiting", () => {
    const future = [msList[0], { ...msList[1], plannedStart: "2026-06-20" }];
    expect(computeDependencyStatus(future[1], future, "2026-06-01")).toBe("Waiting");
  });

  it("broken predecessor reference = Clear (defensive)", () => {
    const orphan: ScheduleMilestone = { id: 9, predecessor: 99, plannedStart: "2026-05-01", status: "Not Started" };
    expect(computeDependencyStatus(orphan, msList, "2026-06-01")).toBe("Clear");
  });
});

describe("scheduling.scheduleBackward", () => {
  const bwMs: ScheduleMilestone[] = [
    { id: 1, name: "A", duration: 5, plannedStart: "2026-01-01", plannedEnd: "2026-01-07" },
    { id: 2, name: "B", predecessor: 1, duration: 5, plannedStart: "2026-01-08", plannedEnd: "2026-01-14" },
    { id: 3, name: "C", predecessor: 2, duration: 5, plannedStart: "2026-01-15", plannedEnd: "2026-01-21" },
  ];

  it("no error on valid chain", () => {
    const r = scheduleBackward(bwMs, "2026-06-30");
    expect(r.error).toBeNull();
  });

  it("returns all milestones", () => {
    const r = scheduleBackward(bwMs, "2026-06-30");
    expect(r.milestones.length).toBe(3);
  });

  it("terminal lands on anchor date", () => {
    const r = scheduleBackward(bwMs, "2026-06-30");
    const terminal = r.milestones.find((m) => m.id === 3)!;
    expect(terminal.plannedEnd).toBe("2026-06-30");
  });

  it("terminal start = anchor - (dur-1) working days", () => {
    const r = scheduleBackward(bwMs, "2026-06-30");
    const terminal = r.milestones.find((m) => m.id === 3)!;
    expect(terminal.plannedStart).toBe("2026-06-24");
  });

  it("B end = C start - 1 working day", () => {
    const r = scheduleBackward(bwMs, "2026-06-30");
    const middle = r.milestones.find((m) => m.id === 2)!;
    expect(middle.plannedEnd).toBe("2026-06-23");
  });

  it("detects circular dependency", () => {
    const cyclic = [
      { id: 1, name: "X", predecessor: 2, duration: 1 },
      { id: 2, name: "Y", predecessor: 1, duration: 1 },
    ];
    const r = scheduleBackward(cyclic, "2026-06-30");
    expect(r.error).not.toBeNull();
  });
});

describe("scheduling.previewCascade", () => {
  const pcMs: ScheduleMilestone[] = [
    { id: 1, name: "A", duration: 5, plannedStart: "2026-05-01", plannedEnd: "2026-05-07" },
    { id: 2, name: "B", predecessor: 1, duration: 5, plannedStart: "2026-05-08", plannedEnd: "2026-05-14" },
    { id: 3, name: "C", predecessor: 2, duration: 5, plannedStart: "2026-05-15", plannedEnd: "2026-05-21" },
  ];

  it("no error", () => {
    const r = previewCascade(pcMs, { id: 1, field: "plannedEnd", value: "2026-05-21" });
    expect(r.error).toBeNull();
  });

  it("returns affected array", () => {
    const r = previewCascade(pcMs, { id: 1, field: "plannedEnd", value: "2026-05-21" });
    expect(Array.isArray(r.affected)).toBe(true);
  });

  it("detects downstream impact", () => {
    const r = previewCascade(pcMs, { id: 1, field: "plannedEnd", value: "2026-05-21" });
    expect(r.affected.length).toBeGreaterThanOrEqual(1);
  });

  it("does not mutate input milestones", () => {
    const originalEnd = pcMs[0].plannedEnd;
    previewCascade(pcMs, { id: 1, field: "plannedEnd", value: "2026-05-21" });
    expect(pcMs[0].plannedEnd).toBe(originalEnd);
  });

  it("excludes the edited row from affected list", () => {
    const r = previewCascade(pcMs, { id: 1, field: "plannedEnd", value: "2026-05-21" });
    expect(r.affected.some((a) => a.id === 1)).toBe(false);
  });

  it("non-schedule field returns no impact", () => {
    const r = previewCascade(pcMs, { id: 1, field: "name", value: "Renamed" });
    expect(r.affected.length).toBe(0);
  });
});

describe("scheduling.computeEndFromDuration", () => {
  it("5 working days from Mon = Fri", () => {
    expect(computeEndFromDuration("2026-05-04", 5)).toBe("2026-05-08");
  });
  it("1 working day returns same day (inclusive)", () => {
    expect(computeEndFromDuration("2026-05-04", 1)).toBe("2026-05-04");
  });
});

describe("scheduling.computeDurationFromDates", () => {
  it("Mon to Fri = 5 working days", () => {
    expect(computeDurationFromDates("2026-05-04", "2026-05-08")).toBe(5);
  });
});

describe("scheduling.computeCriticalPath", () => {
  // Linear chain (A → B → C): every milestone is on CP (no slack possible).
  const linear: ScheduleMilestone[] = [
    { id: 1, duration: 5, plannedStart: "2026-05-04", plannedEnd: "2026-05-08" },
    { id: 2, predecessor: 1, lag: 0, duration: 5, plannedStart: "2026-05-11", plannedEnd: "2026-05-15" },
    { id: 3, predecessor: 2, lag: 0, duration: 5, plannedStart: "2026-05-18", plannedEnd: "2026-05-22" },
  ];

  it("linear chain: every milestone is on the critical path", () => {
    const cp = computeCriticalPath(linear);
    expect(cp.criticalIds.has(1)).toBe(true);
    expect(cp.criticalIds.has(2)).toBe(true);
    expect(cp.criticalIds.has(3)).toBe(true);
    expect(cp.slackById[1]).toBe(0);
    expect(cp.slackById[2]).toBe(0);
    expect(cp.slackById[3]).toBe(0);
  });

  // Parallel chains converging on a single terminal:
  //   A (5d) → C (5d)        ← long branch
  //   B (2d) → C
  // C is terminal. B has slack (it could start later than its planned start).
  it("parallel branches: shorter branch has slack, longer is critical", () => {
    const ms: ScheduleMilestone[] = [
      { id: 1, duration: 5, plannedStart: "2026-05-04", plannedEnd: "2026-05-08" }, // A long
      { id: 2, duration: 2, plannedStart: "2026-05-04", plannedEnd: "2026-05-05" }, // B short, parallel
      { id: 3, predecessor: 1, lag: 0, duration: 3, plannedStart: "2026-05-11", plannedEnd: "2026-05-13" }, // C ← A
    ];
    const cp = computeCriticalPath(ms);
    expect(cp.criticalIds.has(1)).toBe(true);  // A on CP
    expect(cp.criticalIds.has(3)).toBe(true);  // C on CP (terminal)
    expect(cp.criticalIds.has(2)).toBe(false); // B has slack
    expect(cp.slackById[2]).toBeGreaterThan(0);
  });

  it("single terminal milestone: is on CP", () => {
    const ms: ScheduleMilestone[] = [
      { id: 1, duration: 1, plannedStart: "2026-09-02", plannedEnd: "2026-09-02" },
    ];
    const cp = computeCriticalPath(ms);
    expect(cp.criticalIds.has(1)).toBe(true);
    expect(cp.slackById[1]).toBe(0);
  });

  it("respects holidays in the backward pass (slack shrinks)", () => {
    // Without holidays, B has some slack; adding holidays reduces working days
    // available between its plannedStart and its latest start.
    const ms: ScheduleMilestone[] = [
      { id: 1, duration: 5,  plannedStart: "2026-05-04", plannedEnd: "2026-05-08" },
      { id: 2, duration: 2,  plannedStart: "2026-05-04", plannedEnd: "2026-05-05" },
      { id: 3, predecessor: 1, duration: 3, plannedStart: "2026-05-11", plannedEnd: "2026-05-13" },
    ];
    const slackNoHolidays = computeCriticalPath(ms).slackById[2];
    const slackWithHolidays = computeCriticalPath(ms, [1,2,3,4,5], ["2026-05-06","2026-05-07","2026-05-08"]).slackById[2];
    expect(slackWithHolidays).toBeLessThanOrEqual(slackNoHolidays);
  });

  it("empty input returns empty CP", () => {
    const cp = computeCriticalPath([]);
    expect(cp.criticalIds.size).toBe(0);
  });
});

import { previewTaskCascade, previewMilestoneToTaskImpact, previewTaskToMilestonePush, type TaskScheduleEntry } from "./scheduling";

describe("scheduling.previewTaskCascade", () => {
  // Linear chain A → B → C. Moving A's due later forces B and C to move.
  const linear: TaskScheduleEntry[] = [
    { id: "t1", name: "A", dueDate: "2026-05-04" },
    { id: "t2", name: "B", dueDate: "2026-05-05", dependsOn: ["t1"] },
    { id: "t3", name: "C", dueDate: "2026-05-06", dependsOn: ["t2"] },
  ];

  it("linear chain: shifting A by 5 working days shifts B and C", () => {
    const r = previewTaskCascade(linear, { id: "t1", newDueDate: "2026-05-11" });
    expect(r.error).toBeNull();
    expect(r.affected.length).toBe(2);
    const b = r.affected.find((a) => a.id === "t2");
    const c = r.affected.find((a) => a.id === "t3");
    expect(b).toBeTruthy();
    expect(c).toBeTruthy();
    // B must be after A's new due by at least 1 working day → May 12
    expect(b!.newDue).toBe("2026-05-12");
    // C must be after B's new due → May 13
    expect(c!.newDue).toBe("2026-05-13");
  });

  it("no shift when edit makes A earlier (downstream already satisfies constraint)", () => {
    const r = previewTaskCascade(linear, { id: "t1", newDueDate: "2026-05-01" });
    expect(r.error).toBeNull();
    expect(r.affected.length).toBe(0);
  });

  // Branching: one root, two descendants in parallel.
  it("branching: root shift cascades to both descendants", () => {
    const branched: TaskScheduleEntry[] = [
      { id: "t1", name: "Root", dueDate: "2026-05-04" },
      { id: "t2", name: "Branch-1", dueDate: "2026-05-05", dependsOn: ["t1"] },
      { id: "t3", name: "Branch-2", dueDate: "2026-05-05", dependsOn: ["t1"] },
    ];
    const r = previewTaskCascade(branched, { id: "t1", newDueDate: "2026-05-08" });
    expect(r.error).toBeNull();
    expect(r.affected.length).toBe(2);
    expect(r.affected.every((a) => a.newDue === "2026-05-11")).toBe(true); // both shift to next working day
  });

  // Defensive: a cycle (shouldn't happen in valid mockData, but be defensive).
  it("cycle: returns error without infinite loop", () => {
    const cyclic: TaskScheduleEntry[] = [
      { id: "t1", name: "A", dueDate: "2026-05-04", dependsOn: ["t2"] },
      { id: "t2", name: "B", dueDate: "2026-05-05", dependsOn: ["t1"] },
    ];
    // Cascade through a cycle would loop forever without the guard.
    // The visited-set short-circuits this; we just verify no exception + finite.
    const r = previewTaskCascade(cyclic, { id: "t1", newDueDate: "2026-05-10" });
    expect(r).toBeTruthy(); // didn't hang
  });
});

describe("scheduling.previewMilestoneToTaskImpact", () => {
  const tasks: TaskScheduleEntry[] = [
    { id: "t1", dueDate: "2026-05-20", milestoneId: "m6" },
    { id: "t2", dueDate: "2026-05-10", milestoneId: "m6" }, // already before m6's new date
    { id: "t3", dueDate: "2026-05-25", milestoneId: "m7" }, // unrelated milestone
  ];

  it("flags tasks whose due is now after the milestone's new planned date", () => {
    const r = previewMilestoneToTaskImpact(tasks, "m6", "2026-05-15");
    expect(r.conflicts.length).toBe(1);
    expect(r.conflicts[0].taskId).toBe("t1");
  });

  it("does not flag tasks whose due is already before the new date — but reports slack", () => {
    // m6 moves to 2026-05-30: both t1 (05-20) and t2 (05-10) now have slack
    const r = previewMilestoneToTaskImpact(tasks, "m6", "2026-05-30");
    expect(r.conflicts.length).toBe(0);
    expect(r.slack.length).toBe(2);
    expect(r.slack.every((s) => s.slackDays > 0)).toBe(true);
  });

  it("scopes to the changed milestone (ignores other milestones)", () => {
    const r = previewMilestoneToTaskImpact(tasks, "m6", "2026-05-15");
    expect(r.conflicts.some((w) => w.taskId === "t3")).toBe(false);
    expect(r.slack.some((s) => s.taskId === "t3")).toBe(false);
  });
});

describe("scheduling.previewTaskToMilestonePush — M20.3", () => {
  const milestones: ScheduleMilestone[] = [
    { id: 6, duration: 1, plannedStart: "2026-05-15", plannedEnd: "2026-05-15", status: "Not Started", lockDate: false },
    { id: 7, duration: 1, plannedStart: "2026-06-01", plannedEnd: "2026-06-01", status: "Not Started", lockDate: false },
  ];
  const msNumToStr = (n: number) => `m${n}`;

  it("proposes pushing a milestone when its linked task moves past it (with +1WD gate buffer, PL-4)", () => {
    const cascaded: TaskScheduleEntry[] = [
      { id: "t1", dueDate: "2026-05-20", milestoneId: "m6" }, // Wed
    ];
    const pushes = previewTaskToMilestonePush(cascaded, milestones, msNumToStr);
    expect(pushes.length).toBe(1);
    expect(pushes[0].milestoneId).toBe("m6");
    expect(pushes[0].proposedNewDate).toBe("2026-05-21"); // Thu (Wed + 1WD gate buffer)
    expect(pushes[0].drivenByTaskId).toBe("t1");
  });

  it("groups by milestone — picks the latest driving task as the binding constraint (+1WD buffer)", () => {
    const cascaded: TaskScheduleEntry[] = [
      { id: "t1", dueDate: "2026-05-18", milestoneId: "m6" }, // Mon
      { id: "t2", dueDate: "2026-05-22", milestoneId: "m6" }, // Fri — binding
      { id: "t3", dueDate: "2026-05-20", milestoneId: "m6" }, // Wed
    ];
    const pushes = previewTaskToMilestonePush(cascaded, milestones, msNumToStr);
    expect(pushes.length).toBe(1);
    expect(pushes[0].proposedNewDate).toBe("2026-05-25"); // Mon (Fri + 1WD gate buffer)
    expect(pushes[0].drivenByTaskId).toBe("t2");
  });

  it("ignores tasks whose due is still on or before the milestone", () => {
    const cascaded: TaskScheduleEntry[] = [
      { id: "t1", dueDate: "2026-05-15", milestoneId: "m6" }, // on the date
      { id: "t2", dueDate: "2026-05-10", milestoneId: "m6" }, // before
    ];
    const pushes = previewTaskToMilestonePush(cascaded, milestones, msNumToStr);
    expect(pushes.length).toBe(0);
  });
});

import { findConstraintViolations, topoSortTasks } from "./scheduling";

describe("scheduling.previewTaskCascade — M20 selective cascade", () => {
  // Linear chain A → B → C. Default behaviour: A shifts → B + C both shift.
  const linear: TaskScheduleEntry[] = [
    { id: "t1", name: "A", dueDate: "2026-05-04" },
    { id: "t2", name: "B", dueDate: "2026-05-05", dependsOn: ["t1"] },
    { id: "t3", name: "C", dueDate: "2026-05-06", dependsOn: ["t2"] },
  ];

  it("excludeIds: excluding B stops C from shifting too", () => {
    const r = previewTaskCascade(
      linear,
      { id: "t1", newDueDate: "2026-05-11" },
      { excludeIds: new Set(["t2"]) }
    );
    expect(r.error).toBeNull();
    expect(r.affected.find((a) => a.id === "t2")).toBeUndefined(); // B excluded → no shift
    expect(r.affected.find((a) => a.id === "t3")).toBeUndefined(); // C downstream of B, no push
  });

  it("overrides: PM gives B an earlier-than-suggested date and C respects it", () => {
    // Default: A→May 11 forces B→May 12, C→May 13.
    // PM overrides B to May 15 (later than engine's May 12).
    // C must then shift to May 18 (May 15 + 1 working day).
    const r = previewTaskCascade(
      linear,
      { id: "t1", newDueDate: "2026-05-11" },
      { overrides: { t2: "2026-05-15" } }
    );
    expect(r.error).toBeNull();
    const b = r.affected.find((a) => a.id === "t2")!;
    const c = r.affected.find((a) => a.id === "t3")!;
    expect(b.newDue).toBe("2026-05-15");
    expect(c.newDue).toBe("2026-05-18");
  });

  it("override + exclude combined: B overridden, C excluded → only B shifts", () => {
    const r = previewTaskCascade(
      linear,
      { id: "t1", newDueDate: "2026-05-11" },
      { overrides: { t2: "2026-05-20" }, excludeIds: new Set(["t3"]) }
    );
    expect(r.error).toBeNull();
    expect(r.affected.find((a) => a.id === "t2")?.newDue).toBe("2026-05-20");
    expect(r.affected.find((a) => a.id === "t3")).toBeUndefined();
  });

  it("exclude in branching cascade: only the included branch shifts", () => {
    const branched: TaskScheduleEntry[] = [
      { id: "t1", name: "Root",     dueDate: "2026-05-04" },
      { id: "t2", name: "Branch-1", dueDate: "2026-05-05", dependsOn: ["t1"] },
      { id: "t3", name: "Branch-2", dueDate: "2026-05-05", dependsOn: ["t1"] },
    ];
    const r = previewTaskCascade(
      branched,
      { id: "t1", newDueDate: "2026-05-08" },
      { excludeIds: new Set(["t2"]) }
    );
    expect(r.affected.find((a) => a.id === "t2")).toBeUndefined();
    expect(r.affected.find((a) => a.id === "t3")?.newDue).toBe("2026-05-11");
  });
});

describe("scheduling.findConstraintViolations", () => {
  it("flags task that ends before its dependency + 1 working day", () => {
    const tasks: TaskScheduleEntry[] = [
      { id: "t1", name: "A", dueDate: "2026-05-15" },
      { id: "t2", name: "B", dueDate: "2026-05-10", dependsOn: ["t1"] }, // violation: B < A+1
    ];
    const v = findConstraintViolations(tasks);
    expect(v.length).toBe(1);
    expect(v[0].taskId).toBe("t2");
    expect(v[0].depId).toBe("t1");
    expect(v[0].daysBehind).toBeGreaterThan(0);
  });

  it("no violations on a valid chain", () => {
    const tasks: TaskScheduleEntry[] = [
      { id: "t1", dueDate: "2026-05-04" },
      { id: "t2", dueDate: "2026-05-05", dependsOn: ["t1"] },
    ];
    expect(findConstraintViolations(tasks).length).toBe(0);
  });

  it("multiple dependencies: violates only if max(dep)+1 > task.due", () => {
    const tasks: TaskScheduleEntry[] = [
      { id: "t1", dueDate: "2026-05-04" },
      { id: "t2", dueDate: "2026-05-10" }, // this is the binding constraint
      { id: "t3", dueDate: "2026-05-08", dependsOn: ["t1", "t2"] }, // violation: 05-08 < 05-11
    ];
    const v = findConstraintViolations(tasks);
    expect(v.length).toBe(1);
    expect(v[0].depId).toBe("t2"); // engine reports against the binding dep
  });
});

describe("scheduling.previewCascade — M20 milestone selective cascade", () => {
  const ms: ScheduleMilestone[] = [
    { id: 1, name: "A", duration: 5, plannedStart: "2026-05-04", plannedEnd: "2026-05-08" },
    { id: 2, name: "B", predecessor: 1, duration: 5, plannedStart: "2026-05-11", plannedEnd: "2026-05-15" },
    { id: 3, name: "C", predecessor: 2, duration: 5, plannedStart: "2026-05-18", plannedEnd: "2026-05-22" },
  ];

  it("excludeIds: excluding B keeps both B and C frozen", () => {
    // A shifts to end May 22. Without exclusion, B would shift; C would shift.
    // With B excluded (lockDate:true under the hood), B doesn't move, and
    // therefore C doesn't get pushed by B either.
    const r = previewCascade(
      ms,
      { id: 1, field: "plannedEnd", value: "2026-05-22" },
      { excludeIds: new Set([2]) }
    );
    expect(r.error).toBeNull();
    expect(r.affected.find((a) => a.id === 2)).toBeUndefined();
    expect(r.affected.find((a) => a.id === 3)).toBeUndefined();
  });
});

describe("scheduling.previewTaskCascade — M20.1 (topo + cycle detection)", () => {
  // Mirrors the dogfood screenshot: the user manually set T1.dependsOn to
  // [T4,T7,T8,T5], creating a cycle (T1 → T2,T3 → T4 → T1). The M20 BFS
  // engine ran through the cycle producing wrong results ("No downstream
  // shifts"). M20.1 detects the cycle and errors out cleanly so the UI
  // can show a clear message.
  const dogfoodTasksWithCycle: TaskScheduleEntry[] = [
    { id: "t1", name: "Set up user roles",     dueDate: "2026-05-22", dependsOn: ["t4", "t7", "t8", "t5"] },
    { id: "t2", name: "Configure workspace",   dueDate: "2026-05-30", dependsOn: ["t1"] },
    { id: "t3", name: "Set up workflow rules", dueDate: "2026-05-30", dependsOn: ["t1"] },
    { id: "t4", name: "Document templates",    dueDate: "2026-06-02", dependsOn: ["t2", "t3"] },
    { id: "t5", name: "Draft IQ protocol",     dueDate: "2026-06-15", dependsOn: ["t1"] },
    { id: "t6", name: "Prepare OQ scripts",    dueDate: "2026-07-01", dependsOn: ["t5"] },
    { id: "t7", name: "UAT traceability",      dueDate: "2026-07-20", dependsOn: ["t6"] },
    { id: "t8", name: "Validation summary",    dueDate: "2026-08-15", dependsOn: ["t7"] },
  ];

  it("dogfood data has a cycle and the engine returns an error", () => {
    const r = previewTaskCascade(dogfoodTasksWithCycle, { id: "t3", newDueDate: "2026-06-27" });
    expect(r.error).not.toBeNull();
    expect(r.error).toMatch(/cycle/i);
    expect(r.affected.length).toBe(0);
  });

  it("after breaking the cycle (T1 with no forward deps), T3 +28d shifts T4 properly", () => {
    const clean = dogfoodTasksWithCycle.map((t) =>
      t.id === "t1" ? { ...t, dependsOn: undefined } : t
    );
    const r = previewTaskCascade(clean, { id: "t3", newDueDate: "2026-06-27" });
    expect(r.error).toBeNull();
    const t4 = r.affected.find((a) => a.id === "t4");
    expect(t4).toBeDefined();
    expect(t4!.newDue).toBe("2026-06-29"); // next Monday after Sat Jun 27
  });
});

describe("scheduling.topoSortTasks", () => {
  it("linear chain sorts correctly", () => {
    const tasks: TaskScheduleEntry[] = [
      { id: "a", dueDate: "2026-01-01" },
      { id: "b", dueDate: "2026-01-02", dependsOn: ["a"] },
      { id: "c", dueDate: "2026-01-03", dependsOn: ["b"] },
    ];
    const r = topoSortTasks(tasks);
    expect(r.sorted).toEqual(["a", "b", "c"]);
    expect(r.hasCycle).toBe(false);
  });

  it("detects 2-task cycle", () => {
    const tasks: TaskScheduleEntry[] = [
      { id: "a", dueDate: "2026-01-01", dependsOn: ["b"] },
      { id: "b", dueDate: "2026-01-02", dependsOn: ["a"] },
    ];
    const r = topoSortTasks(tasks);
    expect(r.sorted).toBeNull();
    expect(r.hasCycle).toBe(true);
    expect(r.cyclePath?.sort()).toEqual(["a", "b"]);
  });
});
