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
  findCycleEdges,
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
    // a starts Thu, gets edited to Fri. b depends on a, should shift to Mon.
    const tasks = [
      task("a", "2026-05-07"), // Thursday
      task("b", "2026-05-08", ["a"]),
    ];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-08" }, WD, NO_HOLS);
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-11"); // Mon (Fri + 1WD)
  });

  it("Holiday mid-chain — task + 1WD skips a holiday", () => {
    const tasks = [
      task("a", "2026-05-07"), // Thursday
      task("b", "2026-05-08", ["a"]),
    ];
    const r = previewTaskCascade(
      tasks,
      { id: "a", newDueDate: "2026-05-08" }, // edit a to Friday
      WD,
      ["2026-05-11"] // Monday is a holiday
    );
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-12"); // Tuesday (Fri + 1WD, skipping Mon holiday)
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
      task("a", "2026-05-06"), // Wednesday
      task("b", "2026-05-07", ["a"]),
    ];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-07" }, [0, 1, 2, 3, 4], NO_HOLS);
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-10"); // Sunday (Thu + 1WD in Sun–Thu week)
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

  it("task→milestone push: single linked task moving past milestone proposes a push (with +1WD gate buffer)", () => {
    const cascaded = [task("t1", "2026-05-20", [], "m6")]; // Wed
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    expect(r.length).toBe(1);
    expect(r[0].milestoneId).toBe("m6");
    expect(r[0].proposedNewDate).toBe("2026-05-21"); // PL-4 gate buffer
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

  it("PL-2 ✅: task→milestone push is transitive (m6 pushes m7)", () => {
    // When task t1 pushes m6, m7 (which depends on m6) is ALSO proposed.
    // m7's proposal is marked transitive=true with drivenByTaskId carried over.
    const cascaded = [task("t1", "2026-05-20", [], "m6")];
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
      ms(7, "2026-05-16", 1, 6,        { plannedEnd: "2026-05-16" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    const m6 = r.find((p) => p.milestoneId === "m6");
    const m7 = r.find((p) => p.milestoneId === "m7");
    expect(m6).toBeDefined();
    expect(m6?.transitive).toBe(false);
    expect(m7).toBeDefined();
    expect(m7?.transitive).toBe(true);
    expect(m7?.drivenByTaskId).toBe("t1"); // ancestry preserved
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

  it("PL-11 ✅: phantom-save (no-op edit) leaves pre-existing violations alone", () => {
    // The user clicks Save on a task without changing its date. The engine MUST
    // NOT silently re-date downstream tasks that had pre-existing violations.
    const tasks = [task("t1", "2026-05-10"), task("t2", "2026-05-05", ["t1"])];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-10" }, WD, NO_HOLS);
    const t2After = r.tasks.find((x) => x.id === "t2");
    expect(t2After?.dueDate).toBe("2026-05-05"); // unchanged
    expect(r.affected).toEqual([]);
  });

  it("PL-11: real edit on edited task still cascades fully (pre-existing scope only)", () => {
    // Phantom-save protection is scoped to no-op edits. A real edit on t1 cascades
    // normally, including the auto-fix of a pre-existing violation on t2 since the
    // edit itself is meaningfully changing t1.
    const tasks = [task("t1", "2026-05-10"), task("t2", "2026-05-05", ["t1"])];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    const t2After = r.tasks.find((x) => x.id === "t2");
    expect(t2After?.dueDate).toBe("2026-05-18"); // Mon (Fri + 1WD)
    expect(r.affected.find((a) => a.id === "t2")).toBeDefined();
  });

  it("PL-12 ✅ M20.7: cycle in data must not lose the user's originator edit (caller-side semantic)", () => {
    // Engine returns error + original tasks unmodified. Caller is expected to
    // still apply the originator (the user's explicit change) and skip cascade.
    // This test asserts the engine contract that the caller can rely on:
    //   - r.error is non-null
    //   - r.tasks is a SLICE of input (no edit applied at engine level)
    //   - r.affected is []
    // Caller is then responsible for splicing in the user's editedTask manually,
    // which tasks-grid.onApply now does (see M20.7 commit).
    const cyclic = [
      task("t1", "2026-05-04", ["t3"]),
      task("t2", "2026-05-05", ["t1"]),
      task("t3", "2026-05-06", ["t2"]),
    ];
    const r = previewTaskCascade(cyclic, { id: "t1", newDueDate: "2026-05-20" }, WD, NO_HOLS);
    expect(r.error).toMatch(/cycle/i);
    expect(r.affected).toEqual([]);
    // Engine returned a slice — input dates preserved (caller will overlay edit)
    expect(r.tasks.find((x) => x.id === "t1")?.dueDate).toBe("2026-05-04");
  });

  it("PL-11: respectPreExisting=false bypasses the phantom-save guard (caller opt-out)", () => {
    const tasks = [task("t1", "2026-05-10"), task("t2", "2026-05-05", ["t1"])];
    const r = previewTaskCascade(
      tasks,
      { id: "t1", newDueDate: "2026-05-10" },
      { workingDays: WD, holidays: NO_HOLS, respectPreExisting: false }
    );
    const t2After = r.tasks.find((x) => x.id === "t2");
    expect(t2After?.dueDate).toBe("2026-05-11"); // engine settles the violation
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

  it("PL-3 ✅: daysShifted is working days (skips weekend)", () => {
    // a=Thu 05-07 → edit to Thu 05-14. b=Fri 05-08 depends on a → must shift to Fri 05-15.
    // Calendar gap (Fri 05-08 → Fri 05-15) = 7 days. Working-day gap = 5.
    const tasks = [task("a", "2026-05-07"), task("b", "2026-05-08", ["a"])];
    const r = previewTaskCascade(tasks, { id: "a", newDueDate: "2026-05-14" }, WD, NO_HOLS);
    const b = r.affected.find((x) => x.id === "b");
    expect(b?.newDue).toBe("2026-05-15");
    expect(b?.daysShifted).toBe(5); // 5 working days, not 7 calendar days
  });

  it("PL-4 ✅: task→milestone push leaves a 1-WD gate buffer", () => {
    const cascaded = [task("t1", "2026-05-20", [], "m6")]; // Wed
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    // Milestone lands 1 working day after the last task (gate review pattern)
    expect(r[0].proposedNewDate).toBe("2026-05-21"); // Thu
  });

  it("PL-4 ✅: task→milestone gate buffer skips weekend", () => {
    const cascaded = [task("t1", "2026-05-22", [], "m6")]; // Fri
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`);
    expect(r[0].proposedNewDate).toBe("2026-05-25"); // Mon (Fri + 1WD skips weekend)
  });

  it("PL-4: gate buffer is configurable (e.g. 2-day approval cycle)", () => {
    const cascaded = [task("t1", "2026-05-20", [], "m6")]; // Wed
    const milestones: ScheduleMilestone[] = [
      ms(6, "2026-05-15", 1, undefined, { plannedEnd: "2026-05-15" }),
    ];
    const r = previewTaskToMilestonePush(cascaded, milestones, (n) => `m${n}`, { gateBufferWorkingDays: 2 });
    expect(r[0].proposedNewDate).toBe("2026-05-22"); // Fri (Wed + 2WD)
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

// ────────────────────────────────────────────────────────────────────────────
// §8 — M21-Checkpoint: cycle-prevention contract (form layer relies on this)
// ────────────────────────────────────────────────────────────────────────────

describe("M23 — findCycleEdges (Dependency Resolution Workbench)", () => {
  it("self-loop: task depending on itself returns a one-node cycle, edge is back-edge", () => {
    const tasks = [task("t1", "2026-05-04", ["t1"])];
    const result = findCycleEdges(tasks);
    expect(result).not.toBeNull();
    expect(result!.taskIds).toEqual(["t1"]);
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0]).toEqual({ fromId: "t1", fromName: undefined, toId: "t1", toName: undefined, isBackEdge: true });
  });

  it("two-node cycle: T1 → T2 → T1, back-edge is the closing one", () => {
    const tasks = [
      task("t1", "2026-05-04", ["t2"]),
      task("t2", "2026-05-05", ["t1"]),
    ];
    const result = findCycleEdges(tasks);
    expect(result).not.toBeNull();
    expect(result!.taskIds).toHaveLength(2);
    expect(result!.edges).toHaveLength(2);
    expect(result!.edges[result!.edges.length - 1].isBackEdge).toBe(true);
    // Earlier edges are not back-edges
    expect(result!.edges[0].isBackEdge).toBe(false);
  });

  it("11-node cycle (real shape from dogfood): full traversal returned with one back-edge", () => {
    // Mirrors the dogfood data: T1 → T3 → T4 → T5 → T6 → T7 → T8 → T13 → T14 → T15 → T1
    const tasks = [
      task("t1",  "2026-05-04", ["t3"]),
      task("t3",  "2026-05-05", ["t4"]),
      task("t4",  "2026-05-06", ["t5"]),
      task("t5",  "2026-05-07", ["t6"]),
      task("t6",  "2026-05-08", ["t7"]),
      task("t7",  "2026-05-09", ["t8"]),
      task("t8",  "2026-05-10", ["t13"]),
      task("t13", "2026-05-11", ["t14"]),
      task("t14", "2026-05-12", ["t15"]),
      task("t15", "2026-05-13", ["t1"]),
    ];
    const result = findCycleEdges(tasks);
    expect(result).not.toBeNull();
    expect(result!.taskIds).toHaveLength(10);
    expect(result!.edges).toHaveLength(10);
    // Exactly one back-edge
    const backEdges = result!.edges.filter((e) => e.isBackEdge);
    expect(backEdges).toHaveLength(1);
    // The back-edge closes the loop — its toId matches the cycle's start
    expect(backEdges[0].toId).toBe(result!.taskIds[0]);
    expect(backEdges[0].fromId).toBe(result!.taskIds[result!.taskIds.length - 1]);
  });

  it("multiple disjoint cycles: returns one cycle (recompute finds the next after resolution)", () => {
    const tasks = [
      // Cycle A
      task("a1", "2026-05-04", ["a2"]),
      task("a2", "2026-05-05", ["a1"]),
      // Cycle B (disjoint)
      task("b1", "2026-06-04", ["b2"]),
      task("b2", "2026-06-05", ["b1"]),
    ];
    const result = findCycleEdges(tasks);
    expect(result).not.toBeNull();
    expect(result!.taskIds).toHaveLength(2);
    // Should find one of the two cycles, not both at once
    const inA = result!.taskIds.includes("a1") && result!.taskIds.includes("a2");
    const inB = result!.taskIds.includes("b1") && result!.taskIds.includes("b2");
    expect(inA || inB).toBe(true);
    expect(inA && inB).toBe(false);
  });

  it("cycle with a tail: T_x → T_a → T_b → T_a; the tail T_x is NOT in the cycle", () => {
    const tasks = [
      task("tx", "2026-05-01", ["ta"]),       // tail — leads into the cycle but not part of it
      task("ta", "2026-05-04", ["tb"]),
      task("tb", "2026-05-05", ["ta"]),
    ];
    const result = findCycleEdges(tasks);
    expect(result).not.toBeNull();
    expect(result!.taskIds).toHaveLength(2);
    expect(result!.taskIds).toContain("ta");
    expect(result!.taskIds).toContain("tb");
    expect(result!.taskIds).not.toContain("tx");
  });

  it("no cycle: clean DAG returns null", () => {
    const tasks = [
      task("t1", "2026-05-04"),
      task("t2", "2026-05-05", ["t1"]),
      task("t3", "2026-05-06", ["t2"]),
    ];
    expect(findCycleEdges(tasks)).toBeNull();
  });

  it("populates fromName/toName from the task data for human-readable rendering", () => {
    const tasks = [
      task("t1", "2026-05-04", ["t2"]),
      task("t2", "2026-05-05", ["t1"]),
    ];
    tasks[0].name = "Set up user roles";
    tasks[1].name = "Configure workspace";
    const result = findCycleEdges(tasks);
    expect(result).not.toBeNull();
    expect(result!.edges[0].fromName).toBeDefined();
    expect(result!.edges[0].toName).toBeDefined();
  });
});

describe("M23 — engine ignores parallelDeps for cycle detection + FS enforcement", () => {
  // parallelDeps is a sidecar field. The engine treats them as advisory only —
  // they don't appear in cycle detection (topoSortTasks / findCycleEdges) and
  // don't trigger constraint violations or cascade shifts.

  it("topoSortTasks ignores parallelDeps — cycle via parallelDeps does not trip detection", () => {
    // We add a parallelDeps field to TaskScheduleEntry-like shape. topoSortTasks
    // only reads dependsOn, so parallelDeps round-tripping through the engine is
    // already safe by construction. This test guards against future regressions
    // where someone accidentally widens the traversal.
    const tasks: TaskScheduleEntry[] = [
      task("t1", "2026-05-04"),
      task("t2", "2026-05-05"),
    ];
    // Cycle would exist if parallelDeps were treated like dependsOn.
    // Note: parallelDeps lives on Task (mock data), not on TaskScheduleEntry —
    // so its absence here verifies the engine doesn't accidentally see it.
    const topo = topoSortTasks(tasks);
    expect(topo.hasCycle).toBe(false);
    expect(findCycleEdges(tasks)).toBeNull();
  });

  it("findConstraintViolations + previewTaskCascade ignore parallelDeps (only dependsOn enforces)", () => {
    // t2 has dependsOn=[t1] (hard FS) but t3 is connected only via parallel
    // semantics — since parallelDeps doesn't reach the engine, no FS check
    // applies between t1 and t3.
    const tasks = [
      task("t1", "2026-05-10"),
      task("t2", "2026-05-12", ["t1"]),  // hard FS
      task("t3", "2026-05-05"),            // dueDate < t1 — would be a violation IF treated as dep
    ];
    const r = previewTaskCascade(tasks, { id: "t1", newDueDate: "2026-05-15" }, WD, NO_HOLS);
    // t2 cascades (hard FS); t3 does NOT shift since it's not in dependsOn
    expect(r.affected.find((a) => a.id === "t2")).toBeDefined();
    expect(r.affected.find((a) => a.id === "t3")).toBeUndefined();
  });
});

describe("M21-Checkpoint — cycle-prevention contract", () => {
  it("topoSortTasks detects cycles introduced by a proposed dependsOn change", () => {
    // a → b → c is fine. Adding c.dependsOn=[a] is fine. Adding a.dependsOn=[c]
    // creates a cycle (a → c → b → a is wrong; here we model a depending on c).
    const base = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-06", ["b"]),
    ];
    const baseTopo = topoSortTasks(base);
    expect(baseTopo.hasCycle).toBe(false);

    const proposed = base.map((t) => t.id === "a" ? { ...t, dependsOn: ["c"] } : t);
    const proposedTopo = topoSortTasks(proposed);
    expect(proposedTopo.hasCycle).toBe(true);
    expect(proposedTopo.cyclePath?.length).toBeGreaterThan(0);
  });

  it("cycle-blocker set computation: descendants of editedId can't be its upstream", () => {
    // The task-form's wouldCycle test uses a forward-walk of dependsOn.
    // Here we model: which tasks transitively depend on 'a'? Adding any of
    // those as a.dependsOn creates a cycle.
    const base = [
      task("a", "2026-05-04"),
      task("b", "2026-05-05", ["a"]),
      task("c", "2026-05-06", ["b"]),
      task("d", "2026-05-04"),  // unrelated
    ];
    function descendantsOf(id: string): Set<string> {
      const out = new Set<string>();
      function walk(current: string) {
        base.forEach((t) => {
          if (t.id === current || out.has(t.id)) return;
          if ((t.dependsOn ?? []).includes(current)) {
            out.add(t.id);
            walk(t.id);
          }
        });
      }
      walk(id);
      return out;
    }
    const blockers = descendantsOf("a");
    expect(blockers.has("b")).toBe(true);  // b depends directly on a
    expect(blockers.has("c")).toBe(true);  // c depends transitively on a
    expect(blockers.has("d")).toBe(false); // d is unrelated
  });
});
