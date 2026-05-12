import { CheckCircle2 } from "lucide-react";
import { phases } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export function PhaseProgress() {
  const overall = Math.round(phases.reduce((s, p) => s + p.pct, 0) / phases.length);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Project Phase Progress</p>
          <p className="mt-0.5 text-xs text-muted-foreground">6-phase GAMP 5 lifecycle</p>
        </div>
        <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">
          {overall}% overall
        </span>
      </div>

      {/* Bar */}
      <div className="flex h-2 gap-1 rounded-full overflow-hidden bg-muted">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className="relative flex-1 overflow-hidden bg-slate-100 dark:bg-slate-800"
            title={`${phase.name}: ${phase.pct}%`}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 transition-all rounded-full",
                phase.status === "complete" && "bg-primary",
                phase.status === "active" && "bg-primary/70",
                phase.status === "pending" && "bg-transparent",
              )}
              style={{ width: `${phase.pct}%` }}
            />
          </div>
        ))}
      </div>

      {/* Labels */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {phases.map((phase) => (
          <div key={phase.id} className="min-w-0">
            <div className="flex items-center gap-1">
              {phase.status === "complete" && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
              <p className="truncate text-xs font-medium text-foreground">{phase.shortName}</p>
            </div>
            <p
              className={cn(
                "mt-0.5 text-xs tabular-nums",
                phase.status === "complete" && "font-semibold text-primary",
                phase.status === "active" && "font-semibold text-primary/80",
                phase.status === "pending" && "text-muted-foreground",
              )}
            >
              {phase.pct}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
