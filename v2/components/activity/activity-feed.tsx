"use client";

// Activity timeline UI — renders the audit trail as a day-grouped feed.
// Reactive: re-reads the per-project audit log whenever any tracked store
// collection changes (every mutation appends an audit action), so the feed
// updates live as the PM works. No fabricated activity — empty until real
// actions exist (MASTER_UI_UX empty-state standard + no-dark-pattern rule).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { User, Bot, Cog, Plus, Pencil, Trash2, CheckCircle2, CalendarClock, Activity } from "lucide-react";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";
import { readAuditLog } from "@/lib/stores/audit";
import {
  toFeedItems, groupByDay, relativeTime, dayLabel,
  type FeedItem, type FeedActorKind,
} from "@/lib/domain/activity-feed";
import "@/app/styles/activity.css";

const ACTOR_ICON: Record<FeedActorKind, typeof User> = {
  human: User,
  "ai-agent": Bot,
  system: Cog,
};

function verbIcon(verb: string): typeof Plus {
  switch (verb) {
    case "added": return Plus;
    case "removed": return Trash2;
    case "completed": return CheckCircle2;
    case "rescheduled": return CalendarClock;
    case "imported": return Plus;
    default: return Pencil;
  }
}

function FeedRow({ item, nowMs }: { item: FeedItem; nowMs: number }) {
  const KindIcon = ACTOR_ICON[item.actor.kind];
  const VerbIcon = verbIcon(item.verb);
  const name = item.href ? (
    <Link href={item.href}>{item.entityName}</Link>
  ) : (
    <span className="feed-item__actor">{item.entityName}</span>
  );

  return (
    <div className="feed-item">
      <div className="feed-item__rail">
        <span className={`feed-item__dot feed-item__dot--${item.tone}`}>
          <VerbIcon />
        </span>
      </div>
      <div className="feed-item__body">
        <p className="feed-item__text">
          <span className="feed-item__actor">{item.actor.name}</span>{" "}
          {item.verb} {item.entityNoun} {name}
        </p>
        <span className="feed-item__kind">
          <KindIcon /> {item.actor.kind === "ai-agent" ? "AI agent" : item.actor.kind === "system" ? "Automated" : "Manual"}
        </span>
        {item.note ? <p className="feed-item__note">{item.note}</p> : null}
      </div>
      <span className="feed-item__time">{relativeTime(item.timestamp, nowMs)}</span>
    </div>
  );
}

export function ActivityFeed() {
  const { activeProjectId } = useProject();
  // Subscribe to the collections that mutate — any change re-reads the log.
  const tasks = useEntityStore((s) => s.tasks);
  const milestones = useEntityStore((s) => s.milestones);
  const risks = useEntityStore((s) => s.risks);
  const documents = useEntityStore((s) => s.documents);
  const costLines = useEntityStore((s) => s.costLines);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    setItems(toFeedItems(readAuditLog(activeProjectId), { limit: 200 }));
    // Re-run when the project changes or any tracked collection mutates.
  }, [activeProjectId, tasks, milestones, risks, documents, costLines]);

  const groups = useMemo(() => groupByDay(items), [items]);

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card__body" style={{ textAlign: "center", padding: "48px 24px" }}>
          <Activity style={{ width: 28, height: 28, margin: "0 auto 12px", color: "var(--color-ink-500)" }} />
          <p style={{ fontWeight: 600, color: "var(--color-ink-900)" }}>No activity yet</p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-500)", marginTop: 4, maxWidth: 420, marginInline: "auto" }}>
            The timeline fills as the project moves — assignments, status changes,
            approvals, schedule shifts, and (soon) AI-agent runs. Every entry is
            traceable to its source for audit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="feed">
        {groups.map((group) => (
          <div className="feed-day" key={group.dayKey}>
            <div className="feed-day__label">{dayLabel(group.dayKey, nowMs)}</div>
            {group.items.map((item) => (
              <FeedRow key={item.id} item={item} nowMs={nowMs} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
