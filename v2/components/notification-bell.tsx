"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Bell, AlertTriangle, AlertCircle, FileText, CheckSquare, Milestone as MilestoneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/components/projects/project-provider";
import {
  milestones as allMilestones,
  tasks as allTasks,
  risks as allRisks,
  documents as allDocuments,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

// Current "logged-in" user (mock).
const ME = "VP";
const TODAY = "2026-05-13";

type Alert = {
  id: string;
  kind: "overdue-task" | "decision-pending" | "escalated-risk" | "at-risk-milestone";
  title: string;
  detail: string;
  href: string;
};

export function NotificationBell() {
  const { activeProjectId } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // NOTE: reads from raw mockData (not the localStorage-persisted state — the
  // entity arrays live inside grid components). Acceptable for an MVP alerts
  // surface; future improvement would lift entity state to a shared store.
  const alerts: Alert[] = useMemo(() => {
    const out: Alert[] = [];

    // Overdue tasks owned by me, in active project
    allTasks
      .filter((t) =>
        t.projectId === activeProjectId &&
        t.owner === ME &&
        t.status !== "Complete" &&
        t.dueDate < TODAY
      )
      .forEach((t) => {
        const overdue = Math.ceil(
          (new Date(TODAY).getTime() - new Date(t.dueDate).getTime()) / 86_400_000
        );
        out.push({
          id: `task-${t.id}`,
          kind: "overdue-task",
          title: t.name,
          detail: `${overdue}d overdue · ${t.workstream}`,
          href: "/tasks",
        });
      });

    // Decisions pending where I'm a reviewer/approver
    allDocuments
      .filter((d) => d.projectId === activeProjectId)
      .forEach((d) => {
        const meReviewing = d.reviewers.some((r) => r.initials === ME && r.status === "pending");
        const meApproving = d.approvers.some((a) => a.initials === ME && a.status === "pending");
        if (meReviewing || meApproving) {
          out.push({
            id: `doc-${d.id}`,
            kind: "decision-pending",
            title: d.name,
            detail: `${meApproving ? "Approval" : "Review"} pending · due ${d.dueDate}`,
            href: "/documents",
          });
        }
      });

    // Escalated risks (score >= 12) in active project
    allRisks
      .filter((r) => r.projectId === activeProjectId && r.status === "open" && r.score >= 12)
      .forEach((r) => {
        out.push({
          id: `risk-${r.id}`,
          kind: "escalated-risk",
          title: r.title,
          detail: `Score ${r.score} · owner ${r.owner}`,
          href: "/risks",
        });
      });

    // At-risk milestones in active project
    allMilestones
      .filter((m) => m.projectId === activeProjectId && m.status === "at-risk")
      .forEach((m) => {
        out.push({
          id: `ms-${m.id}`,
          kind: "at-risk-milestone",
          title: m.name,
          detail: `Forecast ${m.forecastDate} · planned ${m.plannedDate}`,
          href: "/milestones",
        });
      });

    return out;
  }, [activeProjectId]);

  const kindMeta = {
    "overdue-task":      { Icon: CheckSquare,    tint: "text-rose-600  bg-rose-50  border-rose-200"  },
    "decision-pending":  { Icon: FileText,       tint: "text-amber-600 bg-amber-50 border-amber-200" },
    "escalated-risk":    { Icon: AlertTriangle,  tint: "text-rose-600  bg-rose-50  border-rose-200"  },
    "at-risk-milestone": { Icon: MilestoneIcon,  tint: "text-amber-600 bg-amber-50 border-amber-200" },
  } as const;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setOpen((v) => !v)}
        title="Alerts"
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
            aria-label={`${alerts.length} alerts`}
          >
            {alerts.length}
          </span>
        )}
        <span className="sr-only">Alerts</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-foreground">Alerts</p>
            <p className="text-[11px] text-muted-foreground">
              Items needing your attention in the active project
            </p>
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
              <p className="text-xs font-medium text-foreground">All clear</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Nothing overdue, no pending decisions.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {alerts.map((a) => {
                const meta = kindMeta[a.kind];
                const Icon = meta.Icon;
                return (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", meta.tint)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground">{a.detail}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
