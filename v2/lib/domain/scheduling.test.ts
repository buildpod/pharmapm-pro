import { describe, it, expect } from "vitest";
import {
  topologicalSort,
  computeRAG,
  computeDependencyStatus,
  scheduleBackward,
  previewCascade,
  computeEndFromDuration,
  computeDurationFromDates,
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
  it("overdue > 5 days = Red", () => {
    expect(computeRAG({ status: "In Progress", plannedEnd: "2026-04-10" }, "2026-04-19")).toBe("Red");
  });
  it("overdue 1–5 days = Amber", () => {
    expect(computeRAG({ status: "In Progress", plannedEnd: "2026-04-17" }, "2026-04-19")).toBe("Amber");
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
