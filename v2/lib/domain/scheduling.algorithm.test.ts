// M20.4 — Cascade algorithm formal test matrix.
//
// Each section maps to a section of v2/docs/CASCADE_ALGORITHM.md.
// Convention:
//   - `it(...)` = test asserts current behaviour matches the spec
//   - `it.skip(...)` with a PL-* tag = punch-list item, currently fails or
//      doesn't exist; left here as living documentation of the gap. M20.5
//      flips these to `it(...)` when fixed.
//
// **Adding a test here**:
//   1. If it passes today and codifies a current behavior, leave it as `it()`.
//   2. If it fails today because the engine doesn't yet do what the spec says,
//      mark it `.skip()` and add a `// PL-N` comment referencing the doc's
//      punch list. Do NOT leave failing tests in this file.

import { describe, it, expect } from "vitest";
import {
  cascade,
  previewCascade,
  topologicalSort,
  scheduleBackward,
  computeCriticalPath,
  previewTaskCascade,
  topoSortTasks,
  findConstraintViolations,
  previewMilestoneToTaskImpact,
  previewTaskToMilestonePush,
  type ScheduleMilestone,
  type TaskScheduleEntry,
} from "./scheduling";

// ─── Helpers ────────────────────────────────────────────────────────────────
const WD = [1, 2, 3, 4, 5]; // Mon–Fri
const NO_HOLS: string[] = [];

function ms(
  id: number,
  plannedStart: string,
  duration = 1,
  predecessor?: number,
  extras: Partial<ScheduleMilestone> = {}
): ScheduleMilestone {
  return {
    id,
    plannedStart,
    plannedEnd: plannedStart, // duration-1 working days later; tests use duration=1 unless extras override
    duration,
    predecessor,
    status: "Not Started",
    ...extras,
  };
}

// task(id, due, deps?, milestoneId?)
function task(id: string, dueDate: string, dependsOn: string[] = [], milestoneId?: string): TaskScheduleEntry {
  return { id, dueDate, dependsOn, milestoneId };
}

// ────────────────────────────────────────────────────────────────────────────
// §1 — Topology
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §1 Topology — milestone cascade", () => {
  it("linear chain — A → B → C, A shifts → B + C shift", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
      ms(3, "2026-05-06", 1, 2),
    ];
    const r = previewCascade(data, { id: 1, field: "plannedEnd", value: "2026-05-11" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    const ids = r.affected.map((a) => a.id).sort();
    expect(ids).toEqual([2, 3]);
  });

  it("fan-out — root A; B, C, D all depend on A; A shifts → all three shift", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
      ms(3, "2026-05-05", 1, 1),
      ms(4, "2026-05-05", 1, 1),
    ];
    const r = previewCascade(data, { id: 1, field: "plannedEnd", value: "2026-05-11" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    expect(r.affected.length).toBe(3);
  });

  it("fan-in (task layer) — multiple deps converge into one task; uses max", () => {
    const tasks = [
      task("a", "2026-05-04"),
      task("b", "2026-05-08"),  // later upstream
      task("c", "2026-05-05", ["a", "b"]), // currently violates b
    ];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    // c shifts to max(a.new=05-15, b=05-08) + 1WD = 05-18 (Mon)
    const c = r.affected.find((x) => x.id === "c");
    expect(c?.newDue).toBe("2026-05-18");
  });

  it("diamond — A→B, A→C, B→D, C→D (milestone layer can't model — task layer can)", () => {
    // Milestones have single-predecessor so true diamond is task-only.
    const tasks = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-05", ["a"]),
      task("d", "2026-05-06", ["b", "c"]),
    ];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-11" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    // b, c → 2026-05-12; d → 2026-05-13
    const d = r.affected.find((x) => x.id === "d");
    expect(d?.newDue).toBe("2026-05-13");
  });

  it("cycle — milestone cycle returns Circular dependency error and no affected", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04", 1, 2),
      ms(2, "2026-05-05", 1, 1),
    ];
    const r = previewCascade(data, { id: 1, field: "plannedEnd", value: "2026-05-11" }, WD, NO_HOLS);
    expect(r.error).toBe("Circular dependency");
    expect(r.affected).toEqual([]);
  });

  it("cycle — task cycle returns error with cycle members named", () => {
    const tasks = [
      task("t1", "2026-05-04", ["t3"]),
      task("t2", "2026-05-05", ["t1"]),
      task("t3", "2026-05-06", ["t2"]),
    ];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    expect(r.error).toMatch(/cycle detected/i);
    expect(r.error).toMatch(/T1|T2|T3/);
  });

  it("self-loop — task depending on itself: cycle detected", () => {
    const tasks = [task("t1", "2026-05-04", ["t1"])];
    const topo = topoSortTasks(tasks);
    expect(topo.hasCycle).toBe(true);
  });

  it("disconnected graph — two independent chains; edit on one leaves the other untouched", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
      ms(10, "2026-06-01"),
      ms(11, "2026-06-02", 1, 10),
    ];
    const r = previewCascade(data, { id: 1, field: "plannedEnd", value: "2026-05-15" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    expect(r.affected.find((a) => a.id === 11)).toBeUndefined();
    expect(r.affected.find((a) => a.id === 2)).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §2 — Operations
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §2 Operations — forward / backward / lock / override / exclude", () => {
  const chain: ScheduleMilestone[] = [
    ms(1, "2026-05-04"),
    ms(2, "2026-05-05", 1, 1),
    ms(3, "2026-05-06", 1, 2),
  ];

  it("forward shift — edit pushes whole chain later", () => {
    const r = previewCascade(chain, { id: 1, field: "plannedEnd", value: "2026-05-11" }, WD, NO_HOLS);
    expect(r.affected.length).toBe(2);
    const m3 = r.affected.find((a) => a.id === 3);
    expect(m3?.daysShifted).toBeGreaterThan(0);
  });

  it("backward shift — edit moves predecessor earlier; in-progress successor stays put (§4.1 quirk)", () => {
    const inProg: ScheduleMilestone[] = [
      ms(1, "2026-05-15"),
      ms(2, "2026-05-20", 1, 1, { status: "In Progress" }),
    ];
    const r = previewCascade(inProg, { id: 1, field: "plannedEnd", value: "2026-05-04" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    // In-progress m2 should NOT pull earlier
    expect(r.affected.find((a) => a.id === 2)).toBeUndefined();
  });

  it("backward shift — Not Started successor DOES pull earlier", () => {
    const r = previewCascade(chain, { id: 1, field: "plannedEnd", value: "2026-04-27" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    // Not-Started m2 shifts earlier (the engine recomputes its start from pred.end + 1WD)
    const m2 = r.affected.find((a) => a.id === 2);
    expect(m2).toBeDefined();
    expect(m2?.newStart).toBe("2026-04-28");
  });

  it("lock-mid-chain — middle milestone locked; cascade stops at it", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1, { lockDate: true }),
      ms(3, "2026-05-06", 1, 2),
    ];
    const r = previewCascade(data, { id: 1, field: "plannedEnd", value: "2026-05-18" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    expect(r.affected.find((a) => a.id === 2)).toBeUndefined();
    // m3 reads m2.plannedEnd which is still 2026-05-05, so m3 stays too
    expect(r.affected.find((a) => a.id === 3)).toBeUndefined();
  });

  it("override-mid-chain — middle milestone overridden to a manual date; downstream sees override", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
      ms(3, "2026-05-06", 1, 2),
    ];
    const r = previewCascade(
      data,
      { id: 1, field: "plannedEnd", value: "2026-05-18" },
      { workingDays: WD, holidays: NO_HOLS, overrides: { 2: "2026-05-20" } }
    );
    expect(r.error).toBeNull();
    const m3 = r.affected.find((a) => a.id === 3);
    expect(m3?.newStart).toBe("2026-05-21"); // 05-20 + 1WD
  });

  it("exclude-mid-chain — middle milestone excluded; downstream reads its original date", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
      ms(3, "2026-05-06", 1, 2),
    ];
    const r = previewCascade(
      data,
      { id: 1, field: "plannedEnd", value: "2026-05-18" },
      { workingDays: WD, holidays: NO_HOLS, excludeIds: new Set([2]) }
    );
    expect(r.error).toBeNull();
    expect(r.affected.find((a) => a.id === 2)).toBeUndefined();
    // m3 sees m2 still at 2026-05-05; m3 stays
    expect(r.affected.find((a) => a.id === 3)).toBeUndefined();
  });

  it("combined override + exclude — override wins on the same node", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
      ms(3, "2026-05-06", 1, 2),
    ];
    const r = previewCascade(
      data,
      { id: 1, field: "plannedEnd", value: "2026-05-18" },
      {
        workingDays: WD, holidays: NO_HOLS,
        excludeIds: new Set([2]),
        overrides: { 2: "2026-05-25" },
      }
    );
    expect(r.error).toBeNull();
    const m3 = r.affected.find((a) => a.id === 3);
    expect(m3?.newStart).toBe("2026-05-26"); // 05-25 + 1WD (Tue)
  });

  it("task exclude — excluded task keeps its date, downstream computes from that date", () => {
    const tasks = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-06", ["b"]),
    ];
    const r = previewTaskCascade(
      tasks,
      { id: "a", newDueDate: "2026-05-18" },
      { workingDays: WD, holidays: NO_HOLS, excludeIds: new Set(["b"]) }
    );
    expect(r.error).toBeNull();
    // b stays at 05-05; c stays at 05-06 (>= b+1WD = 05-06)
    expect(r.affected.find((x) => x.id === "b")).toBeUndefined();
    expect(r.affected.find((x) => x.id === "c")).toBeUndefined();
  });

  it("task override — overridden task uses manual date; downstream cascades from there", () => {
    const tasks = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-06", ["b"]),
    ];
    const r = previewTaskCascade(
      tasks,
      { id: "a", newDueDate: "2026-05-18" },
      { workingDays: WD, holidays: NO_HOLS, overrides: { b: "2026-05-25" } }
    );
    expect(r.error).toBeNull();
    const c = r.affected.find((x) => x.id === "c");
    expect(c?.newDue).toBe("2026-05-26"); // 05-25 + 1WD
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §3 — Calendar
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §3 Calendar — working days, holidays, lag", () => {
  it("Fri→Mon boundary — task on Fri + 1WD = Mon (not Sat)", () => {
    const tasks = [
      task("a", "2026-05-08"), // Friday
      task("b", "2026-05-08", ["a"]),
    ];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-08" }, WD, NO_HOLS);
    // b currently equals a, so it should shift to a + 1WD = 2026-05-11 (Mon)
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-11");
  });

  it("Holiday mid-chain — task + 1WD skips a holiday", () => {
    const tasks = [
      task("a", "2026-05-08"), // Friday
      task("b", "2026-05-08", ["a"]),
    ];
    const r = previewTaskCascade(
      tasks,
      { id: "a", newDueDate: "2026-05-08" },
      WD,
      ["2026-05-11"] // Monday is a holiday
    );
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-12"); // Tuesday
  });

  it("Milestone lag — A end Mon, B has lag=2, B start = Mon + 3WD = Thu", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),                            // A ends Mon 05-04
      ms(2, "2026-05-05", 1, 1, { lag: 2 }),          // B was Tue; should re-cascade to Thu
    ];
    const r = cascade(data, WD, NO_HOLS);
    expect(r.error).toBeNull();
    const m2 = r.milestones.find((m) => m.id === 2);
    expect(m2?.plannedStart).toBe("2026-05-07"); // Mon + (1+2) = Thu
  });

  it("Custom working week — Sun–Thu (Mid-East default) — Thu + 1WD = Sun", () => {
    const tasks = [
      task("a", "2026-05-07"), // Thursday
      task("b", "2026-05-07", ["a"]),
    ];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-07" }, [0, 1, 2, 3, 4], NO_HOLS);
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-10"); // Sunday
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §4 — Cross-entity
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §4 Cross-entity — milestone↔task", () => {
  it("milestone→task conflicts: linked task ending after new milestone date is flagged", () => {
    const tasks = [task("t1", "2026-05-20", [], "m6")];
    const r = previewMilestoneToTaskImpact(tasks, "m6", "2026-05-15");
    expect(r.conflicts.length).toBe(1);
    expect(r.conflicts[0].taskId).toBe("t1");
    expect(r.slack.length).toBe(0);
  });

  it("milestone→task slack: linked task ending before new milestone date reports working-day slack", () => {
    const tasks = [task("t1", "2026-05-15", [], "m6")];
    const r = previewMilestoneToTaskImpact(tasks, "m6", "2026-05-22", WD, NO_HOLS);
    expect(r.conflicts.length).toBe(0);
    expect(r.slack.length).toBe(1);
    expect(r.slack[0].slackDays).toBe(5); // 5 working days between 05-15 and 05-22
  });

  it("milestone→task no-op when task is on exact new date", () => {
    const tasks = [task("t1", "2026-05-15", [], "m6")];
    const r = previewMilestoneToTaskImpact(tasks, "m6", "2026-05-15");
    expect(r.conflicts.length).toBe(0);
    expect(r.slack.length).toBe(0);
  });

  it("task→milestone push: single linked task moving past milestone proposes a push", () => {
    const cascaded = [task("t1", "2026-05-20", [], "m6")];
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    expect(r.length).toBe(1);
    expect(r[0].milestoneId).toBe("m6");
    expect(r[0].proposedNewDate).toBe("2026-05-20");
  });

  it("task→milestone push: binding-constraint task is the latest among linked", () => {
    const cascaded = [
      task("t1", "2026-05-18", [], "m6"),
      task("t2", "2026-05-22", [], "m6"), // binding
      task("t3", "2026-05-20", [], "m6"),
    ];
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    expect(r.length).toBe(1);
    expect(r[0].drivenByTaskId).toBe("t2");
  });

  it.skip("PL-2: task→milestone push is transitive (m6 pushes m7) — CURRENTLY ONE-HOP, FIX IN M20.5", () => {
    // When task t1 pushes m6, m7 (which depends on m6) should ALSO be proposed
    // for a push. Today the engine returns only m6.
    const cascaded = [task("t1", "2026-05-20", [], "m6")];
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
      ms(7, "2026-05-16", 1, 6,        { plannedEnd: "2026-05-16" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    expect(r.find((p) => p.milestoneId === "m6")).toBeDefined();
    // EXPECTED but currently MISSING:
    expect(r.find((p) => p.milestoneId === "m7")).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §5 — Hygiene
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §5 Hygiene — engine reports, never silently fixes", () => {
  it("pre-existing violation is surfaced by findConstraintViolations", () => {
    // t2 due BEFORE t1 (violation), no edit
    const tasks = [task("t1", "2026-05-10"), task("t2", "2026-05-05", ["t1"])];
    const violations = findConstraintViolations(tasks, WD, NO_HOLS);
    expect(violations.length).toBe(1);
    expect(violations[0].taskId).toBe("t2");
  });

  it.skip("PL-11: cascade with no-op edit leaves pre-existing violations alone — currently 'auto-fixes' them, M20.5", () => {
    // The engine, when invoked with an edit that does NOT change the upstream date,
    // still runs the full topological cascade and "fixes" any pre-existing violations
    // downstream. From the PM's POV this means a phantom save can silently re-date
    // tasks that were always wrong, attributing the shift to "this edit".
    //
    // Today: t2 gets pushed to 05-11 (t1 + 1WD).
    // Spec: a no-op edit should produce no affected[] rows, and r.tasks should
    //       leave t2 at its original 05-05 (with the pre-existing violation still
    //       reportable via findConstraintViolations but not silently rewritten).
    const tasks = [task("t1", "2026-05-10"), task("t2", "2026-05-05", ["t1"])];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-10" }, WD, NO_HOLS);
    const t2After = r.tasks.find((x) => x.id === "t2");
    expect(t2After?.dueDate).toBe("2026-05-05"); // currently 2026-05-11
    expect(r.affected).toEqual([]);
  });

  it("empty cascade — edit on a task with no dependents has empty affected", () => {
    const tasks = [task("t1", "2026-05-04"), task("t2", "2026-06-01")];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    expect(r.affected).toEqual([]);
  });

  it("single-node 'cascade' — only the edited task is in the result, no shifts", () => {
    const tasks = [task("t1", "2026-05-04")];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    expect(r.affected).toEqual([]);
    expect(r.tasks.find((x) => x.id === "t1")?.dueDate).toBe("2026-05-15");
  });

  it("edit on unknown task id returns error, no mutation", () => {
    const tasks = [task("t1", "2026-05-04")];
    const r = previewTaskCascade(tasks, { id: "tDoesNotExist", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    expect(r.error).toMatch(/not found/i);
  });

  it("edit on non-schedule field is a no-op on the milestone cascade", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04"),
      ms(2, "2026-05-05", 1, 1),
    ];
    // "status" is not in the scheduleFields whitelist
    const r = previewCascade(data, { id: 1, field: "status", value: "Blocked" }, WD, NO_HOLS);
    expect(r.error).toBeNull();
    expect(r.affected).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §6 — Punch list reproductions (skipped — these document gaps)
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §6 Punch list reproductions — these document current gaps", () => {
  it.skip("PL-1: in-progress milestone refuses forward-pull (documented quirk)", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-15"),
      ms(2, "2026-05-20", 1, 1, { status: "In Progress" }),
    ];
    const r = previewCascade(data, { id: 1, field: "plannedEnd", value: "2026-05-04" }, WD, NO_HOLS);
    // Per spec §4.1 this is the documented behaviour — the in-progress milestone
    // intentionally doesn't pull earlier. Test serves as living documentation.
    expect(r.affected.find((a) => a.id === 2)).toBeUndefined();
  });

  it.skip("PL-3: daysShifted should be working days, not calendar days — M20.5", () => {
    const tasks = [task("a", "2026-05-08"), task("b", "2026-05-08", ["a"])];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    const b = r.affected.find((x) => x.id === "b");
    // Calendar: 05-08 Fri → 05-18 Mon = 10 days
    // Working: should be 6
    // Currently the engine returns 10 (calendar). M20.5 should switch to working.
    expect(b?.daysShifted).toBe(6);
  });

  it.skip("PL-4: task→milestone push should leave a 1-WD gate buffer — M20.5", () => {
    const cascaded = [task("t1", "2026-05-20", [], "m6")];
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    // Spec: milestone should land 1 working day AFTER the last task (gate review pattern)
    // Today: lands exactly on the task date
    expect(r[0].proposedNewDate).toBe("2026-05-21"); // 05-20 + 1WD
  });

  it.skip("PL-5: computeCriticalPath on cyclic graph should surface error — M20.5", () => {
    const data: ScheduleMilestone[] = [
      ms(1, "2026-05-04", 1, 2),
      ms(2, "2026-05-05", 1, 1),
    ];
    const cp = computeCriticalPath(data, WD, NO_HOLS);
    // Today: returns empty silently. Spec: should expose an error field.
    expect((cp as unknown as { error?: string }).error).toMatch(/cycle/i);
  });

  it.skip("PL-6: scheduleBackward from go-live should error when result lands before today — M20.5", () => {
    const data: ScheduleMilestone[] = [ms(1, "2027-01-01"), ms(2, "2027-01-02", 1, 1)];
    const r = scheduleBackward(data, "2026-01-01", WD, NO_HOLS);
    // Today: silently schedules into the past
    // Spec: surface "schedule infeasible" warning
    expect((r as unknown as { warning?: string }).warning).toMatch(/infeasible/i);
  });

  it.skip("PL-9: user-introduced cycle should be distinguished from pre-existing — M20.5", () => {
    // Today: same generic "Dependency cycle detected" message either way.
    // Spec: drawer-level baseline diff should tag user-caused cycles.
    expect(true).toBe(false); // placeholder
  });
});

// ────────────────────────────────────────────────────────────────────────────
// §7 — Sanity for the selective-cascade layer (M20)
// ────────────────────────────────────────────────────────────────────────────

describe("M20.4 §7 Selective cascade layer — sanity", () => {
  it("override propagates: downstream of an overridden node uses the override as its new upstream", () => {
    const tasks = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-06", ["b"]),
    ];
    const r = previewTaskCascade(
      tasks,
      { id: "a", newDueDate: "2026-05-18" },
      { workingDays: WD, holidays: NO_HOLS, overrides: { b: "2026-05-22" } }
    );
    const c = r.affected.find((x) => x.id === "c");
    expect(c?.newDue).toBe("2026-05-25"); // 05-22 Fri + 1WD = Mon 05-25
  });

  it("exclude is a 'wall' but downstream still reads excluded node's current date", () => {
    const tasks = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-06", ["b"]),
    ];
    const r = previewTaskCascade(
      tasks,
      { id: "a", newDueDate: "2026-05-18" },
      { workingDays: WD, holidays: NO_HOLS, excludeIds: new Set(["b"]) }
    );
    // b stays at 05-05. c needs b+1WD = 05-06 — c is already at 05-06, no shift.
    expect(r.affected.find((x) => x.id === "b")).toBeUndefined();
    expect(r.affected.find((x) => x.id === "c")).toBeUndefined();
  });

  it("topologicalSort over an empty array returns empty sorted, no cycle", () => {
    const r = topologicalSort([]);
    expect(r.sorted).toEqual([]);
    expect(r.hasCycle).toBe(false);
  });
});
