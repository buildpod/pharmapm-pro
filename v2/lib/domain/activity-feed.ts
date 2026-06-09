// Activity timeline — the humanized read-surface of the M20.2 audit trail.
//
// Turns raw `AuditAction[]` (every add/edit/delete/cascade the store records)
// into scannable, plain-language feed items grouped by day. This is the
// "Instagram form, audit substance" surface: chronological, social-feeling,
// drill-able — but it NEVER ranks, hides, or fabricates events (MASTER_UI_UX
// principle 5 + the audit-immutability rule). One feed item per real action.
//
// Pure domain module: no React, no store, no app/components imports. Tests
// alongside (activity-feed.test.ts), same pattern as evm.ts.

import type { AuditAction, ActionType, EntityKind, Source } from "../stores/audit";

// Forward-compatible with the agent-as-resource spec: Source will gain
// "ai-agent" (PA-4). The actor model already distinguishes the three kinds so
// agent-authored events drop in without a UI rework.
export type FeedActorKind = "human" | "ai-agent" | "system";

export interface FeedActor {
  name: string;
  kind: FeedActorKind;
}

// Tone follows the §5.3 semantics (outcome, not action type): info = blue,
// ok = emerald, warn = amber, risk = rose, neutral = slate.
export type FeedTone = "neutral" | "info" | "ok" | "warn" | "risk";

export interface FeedItem {
  id: string;
  timestamp: string;     // ISO, from the audit action
  dayKey: string;        // YYYY-MM-DD — for day-divider grouping
  actor: FeedActor;
  verb: string;          // "updated", "completed", "rescheduled", "removed"
  entityKind: EntityKind;
  entityNoun: string;    // "task", "milestone", "cost line"
  entityName: string;    // best-effort human label from the snapshot
  href?: string;         // drill target (undefined = no dedicated page)
  tone: FeedTone;
  note?: string;         // optional human annotation carried from the action
}

export interface ToFeedOptions {
  excludeSources?: Source[];   // default: ["test"]
  limit?: number;              // cap rendered items (audit log itself caps at 500)
}

// ── Display vocabulary ───────────────────────────────────────────────────────

const ENTITY_NOUN: Record<EntityKind, string> = {
  project: "project", charter: "charter", milestone: "milestone", task: "task",
  risk: "risk", issue: "issue", decision: "decision", document: "document",
  costLine: "cost line", teamMember: "team member", meeting: "meeting", absence: "absence",
};

// Entities with a dedicated page get a drill link; the rest are non-routable.
const ENTITY_ROUTE: Partial<Record<EntityKind, string>> = {
  milestone: "/milestones", task: "/tasks", risk: "/risks", issue: "/issues",
  decision: "/decisions", document: "/documents", costLine: "/costs",
  teamMember: "/resources", meeting: "/resources", charter: "/charter",
};

function actorFor(source: Source): FeedActor {
  switch (source) {
    case "user-edit":
    case "user-inline":
      // Single-user mock today — no per-user attribution yet (honest placeholder).
      return { name: "You", kind: "human" };
    case "cascade":
      return { name: "Schedule engine", kind: "system" };
    case "system":
      return { name: "System", kind: "system" };
    case "import":
      return { name: "Import", kind: "system" };
    case "test":
      return { name: "Test harness", kind: "system" };
    default:
      // Forward-compat: an unrecognised source (e.g. future "ai-agent") renders
      // as a generic agent rather than crashing.
      return { name: "Agent", kind: "ai-agent" };
  }
}

// Best-effort human label from the action's before/after snapshot. Entities use
// different label fields (name / title / description); we probe in priority order.
function snapshotName(action: AuditAction): string {
  const snap = (action.after ?? action.before) as Record<string, unknown> | undefined;
  if (snap) {
    for (const key of ["name", "title", "description", "label"]) {
      const v = snap[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  // Fall back to the id so the row is still meaningful and traceable.
  return action.entityId;
}

function isComplete(action: AuditAction): boolean {
  const after = action.after as Record<string, unknown> | undefined;
  if (!after) return false;
  const status = typeof after.status === "string" ? after.status.toLowerCase() : "";
  const progress = typeof after.progress === "number" ? after.progress : null;
  return status === "complete" || status === "approved" || status === "closed" || progress === 100;
}

// Verb + tone for an action. Completion is detected from the after-snapshot so a
// status cycle that finishes work reads as "completed" (emerald), not "updated".
function verbAndTone(action: AuditAction): { verb: string; tone: FeedTone } {
  const type: ActionType = action.type;
  if ((type === "update" || type === "add") && isComplete(action)) {
    return { verb: "completed", tone: "ok" };
  }
  switch (type) {
    case "add":          return { verb: "added", tone: "neutral" };
    case "update":       return { verb: "updated", tone: "neutral" };
    case "delete":       return { verb: "removed", tone: "warn" };
    case "replaceAll":   return { verb: "bulk-updated", tone: "neutral" };
    case "import":       return { verb: "imported", tone: "info" };
    case "cascade-apply":return { verb: "rescheduled", tone: "info" };
    default:             return { verb: "changed", tone: "neutral" };
  }
}

// ── Core mapper ──────────────────────────────────────────────────────────────

// Maps audit actions (assumed newest-first, as the store stores them) into feed
// items. Pure: no Date.now, no storage. Caller passes already-read actions.
export function toFeedItems(actions: AuditAction[], opts: ToFeedOptions = {}): FeedItem[] {
  const exclude = new Set<Source>(opts.excludeSources ?? ["test"]);
  const items: FeedItem[] = [];

  for (const action of actions) {
    if (exclude.has(action.source)) continue;
    const { verb, tone } = verbAndTone(action);
    items.push({
      id: action.id,
      timestamp: action.timestamp,
      dayKey: action.timestamp.slice(0, 10),
      actor: actorFor(action.source),
      verb,
      entityKind: action.entityKind,
      entityNoun: ENTITY_NOUN[action.entityKind] ?? action.entityKind,
      entityName: snapshotName(action),
      href: ENTITY_ROUTE[action.entityKind],
      tone,
      note: action.note,
    });
    if (opts.limit && items.length >= opts.limit) break;
  }
  return items;
}

// ── Time formatting (pure, injectable clock for tests) ───────────────────────

// Compact relative time for a feed timestamp. nowMs injectable for determinism.
export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = nowMs - then;
  if (diff < 0) return "just now";
  const min = 60_000, hour = 3_600_000, day = 86_400_000;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day)  return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Friendly divider label for a day group ("Today" / "Yesterday" / "12 May").
export function dayLabel(dayKey: string, nowMs: number = Date.now()): string {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const yesterday = new Date(nowMs - 86_400_000).toISOString().slice(0, 10);
  if (dayKey === today) return "Today";
  if (dayKey === yesterday) return "Yesterday";
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

// Groups feed items into day buckets (preserving newest-first order) for the UI.
export function groupByDay(items: FeedItem[]): { dayKey: string; items: FeedItem[] }[] {
  const groups: { dayKey: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === item.dayKey) last.items.push(item);
    else groups.push({ dayKey: item.dayKey, items: [item] });
  }
  return groups;
}
