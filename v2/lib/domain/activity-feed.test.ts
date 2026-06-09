// Activity feed mapper tests — pure AuditAction → FeedItem transformation.

import { describe, it, expect } from "vitest";
import {
  toFeedItems, relativeTime, dayLabel, groupByDay, type FeedItem,
} from "./activity-feed";
import type { AuditAction } from "../stores/audit";

function action(over: Partial<AuditAction> = {}): AuditAction {
  return {
    id: "a1",
    type: "update",
    entityKind: "task",
    entityId: "T1",
    after: { name: "Configure submission types" },
    source: "user-edit",
    projectId: "p1",
    timestamp: "2026-05-13T10:00:00.000Z",
    ...over,
  };
}

describe("activity-feed.toFeedItems — verbs", () => {
  it("maps action types to plain-language verbs", () => {
    const verbs = (["add", "update", "delete", "import", "cascade-apply"] as const).map(
      (type) => toFeedItems([action({ type })])[0].verb,
    );
    expect(verbs).toEqual(["added", "updated", "removed", "imported", "rescheduled"]);
  });

  it("reads a completed task as 'completed' with ok tone, not 'updated'", () => {
    const [item] = toFeedItems([action({ type: "update", after: { name: "FRS sign-off", status: "Complete" } })]);
    expect(item.verb).toBe("completed");
    expect(item.tone).toBe("ok");
  });

  it("100% progress also counts as completion", () => {
    const [item] = toFeedItems([action({ after: { name: "X", progress: 100 } })]);
    expect(item.verb).toBe("completed");
  });

  it("a deletion is amber (attention), not an error", () => {
    expect(toFeedItems([action({ type: "delete" })])[0].tone).toBe("warn");
  });
});

describe("activity-feed.toFeedItems — actor attribution", () => {
  it("user edits are a human actor", () => {
    expect(toFeedItems([action({ source: "user-edit" })])[0].actor).toEqual({ name: "You", kind: "human" });
  });
  it("cascade is the schedule engine (system)", () => {
    expect(toFeedItems([action({ source: "cascade" })])[0].actor.kind).toBe("system");
  });
  it("test-sourced actions are excluded by default", () => {
    expect(toFeedItems([action({ source: "test" })])).toHaveLength(0);
  });
});

describe("activity-feed.toFeedItems — labels, links, names", () => {
  it("derives a human label from the snapshot name/title/description", () => {
    expect(toFeedItems([action({ entityKind: "risk", after: { title: "Data migration gap" } })])[0].entityName)
      .toBe("Data migration gap");
  });
  it("falls back to entityId when no label field exists (still traceable)", () => {
    expect(toFeedItems([action({ after: { foo: 1 }, entityId: "T9" })])[0].entityName).toBe("T9");
  });
  it("maps routable entities to their page, leaves non-routable undefined", () => {
    expect(toFeedItems([action({ entityKind: "task" })])[0].href).toBe("/tasks");
    expect(toFeedItems([action({ entityKind: "absence" })])[0].href).toBeUndefined();
  });
  it("uses a friendly noun (cost line, not costLine)", () => {
    expect(toFeedItems([action({ entityKind: "costLine", after: { description: "Vendor T&M" } })])[0].entityNoun)
      .toBe("cost line");
  });
});

describe("activity-feed.toFeedItems — options", () => {
  it("respects an explicit exclude list and a limit", () => {
    const log = [action({ id: "1" }), action({ id: "2", source: "cascade" }), action({ id: "3" })];
    expect(toFeedItems(log, { excludeSources: ["cascade"] }).map((i) => i.id)).toEqual(["1", "3"]);
    expect(toFeedItems(log, { limit: 1 })).toHaveLength(1);
  });
});

describe("activity-feed.relativeTime", () => {
  const now = new Date("2026-05-13T12:00:00.000Z").getTime();
  it("buckets recent times", () => {
    expect(relativeTime("2026-05-13T11:59:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-05-13T11:30:00.000Z", now)).toBe("30m ago");
    expect(relativeTime("2026-05-13T09:00:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-05-11T12:00:00.000Z", now)).toBe("2d ago");
  });
  it("future timestamps read as just now (clock skew safe)", () => {
    expect(relativeTime("2026-05-13T12:05:00.000Z", now)).toBe("just now");
  });
});

describe("activity-feed.dayLabel + groupByDay", () => {
  const now = new Date("2026-05-13T12:00:00.000Z").getTime();
  it("labels today and yesterday", () => {
    expect(dayLabel("2026-05-13", now)).toBe("Today");
    expect(dayLabel("2026-05-12", now)).toBe("Yesterday");
  });
  it("groups consecutive same-day items, preserving order", () => {
    const items: FeedItem[] = toFeedItems([
      action({ id: "1", timestamp: "2026-05-13T10:00:00.000Z" }),
      action({ id: "2", timestamp: "2026-05-13T09:00:00.000Z" }),
      action({ id: "3", timestamp: "2026-05-12T18:00:00.000Z" }),
    ]);
    const groups = groupByDay(items);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-05-13", "2026-05-12"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["1", "2"]);
  });
});
