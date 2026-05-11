import { Lock, CheckCircle2, Circle, AlertCircle, Clock } from "lucide-react";
import { milestones } from "@/lib/mockData";
import { computeRAG, computeDependencyStatus } from "@/lib/domain/scheduling";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Map mockData milestones to scheduling domain shape
function toScheduleMilestone(m: (typeof milestones)[number]) {
  return {
    id: parseInt(m.id.replace("m", "")),
    status: m.status === "complete"
      ? "Complete"
      : m.status === "in-progress"
      ? "In Progress"
      : m.status === "at-risk"
      ? "Blocked"
      : "Not Started",
    plannedEnd: m.plannedDate,
    plannedStart: m.plannedDate,
    lockDate: m.locked,
  };
}

const statusIcon = {
  complete: { icon: CheckCircle2, cls: "text-green-600" },
  "in-progress": { icon: Circle, cls: "text-primary" },
  "at-risk": { icon: AlertCircle, cls: "text-destructive" },
  pending: { icon: Clock, cls: "text-muted-foreground" },
} as const;

const ragBadge = {
  Green: "bg-green-100 text-green-700",
  Amber: "bg-amber-100 text-amber-700",
  Red: "bg-red-100 text-red-700",
};

const depBadge = {
  Clear: "bg-green-50 text-green-700",
  Waiting: "bg-amber-50 text-amber-700",
  Blocked: "bg-red-50 text-red-700",
};

export default function MilestonesPage() {
  const domainMilestones = milestones.map(toScheduleMilestone);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Milestones</h2>
        <p className="text-sm text-muted-foreground">
          Read-only schedule grid · RAG and dependency status computed by domain engine
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_32px] gap-0 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Milestone</div>
          <div>Phase</div>
          <div>Planned</div>
          <div>Forecast</div>
          <div className="text-center">RAG</div>
          <div className="text-center">Dep</div>
          <div />
        </div>

        {/* Rows */}
        <ul className="divide-y divide-border">
          {milestones.map((m) => {
            const dm = toScheduleMilestone(m);
            const rag = computeRAG(dm, "2026-05-11");
            const dep = computeDependencyStatus(dm, domainMilestones, "2026-05-11");
            const variance = Math.ceil(
              (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000
            );
            const { icon: Icon, cls } = statusIcon[m.status];

            return (
              <li
                key={m.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px_32px] gap-0 items-center px-4 py-3 text-xs hover:bg-muted/20 transition-colors"
              >
                {/* Name + owner */}
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cls)} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">Owner: {m.owner}</p>
                  </div>
                </div>

                {/* Phase */}
                <div className="text-muted-foreground truncate">{m.phase}</div>

                {/* Planned */}
                <div className="text-foreground">{formatDate(m.plannedDate)}</div>

                {/* Forecast + variance */}
                <div>
                  <span className="text-foreground">{formatDate(m.forecastDate)}</span>
                  {variance !== 0 && (
                    <span
                      className={cn(
                        "ml-1 text-[10px]",
                        variance > 0 ? "text-destructive" : "text-green-600"
                      )}
                    >
                      {variance > 0 ? `+${variance}d` : `${variance}d`}
                    </span>
                  )}
                </div>

                {/* RAG badge */}
                <div className="flex justify-center">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      ragBadge[rag]
                    )}
                  >
                    {rag}
                  </span>
                </div>

                {/* Dep badge */}
                <div className="flex justify-center">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      depBadge[dep]
                    )}
                  >
                    {dep}
                  </span>
                </div>

                {/* Lock indicator */}
                <div className="flex justify-center">
                  {m.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Legend */}
        <div className="border-t border-border bg-muted/20 px-4 py-2 flex gap-4 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-medium">RAG:</span>
          {(["Green", "Amber", "Red"] as const).map((r) => (
            <span key={r} className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", ragBadge[r])}>
              {r}
            </span>
          ))}
          <span className="mx-2 text-border">|</span>
          <span className="text-[10px] text-muted-foreground font-medium">Dep:</span>
          {(["Clear", "Waiting", "Blocked"] as const).map((d) => (
            <span key={d} className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", depBadge[d])}>
              {d}
            </span>
          ))}
          <span className="mx-2 text-border">|</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="h-2.5 w-2.5" /> Locked date
          </span>
        </div>
      </div>
    </div>
  );
}
