import { phases } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export function PhaseProgress() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-foreground">Project Phase Progress</p>
      <div className="flex gap-0.5 rounded-full overflow-hidden h-3">
        {phases.map((phase) => {
          return (
            <div
              key={phase.id}
              className="relative flex-1 bg-muted overflow-hidden"
              title={`${phase.name}: ${phase.pct}%`}
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all",
                  phase.status === "complete"  && "bg-primary",
                  phase.status === "active"    && "bg-primary/60",
                  phase.status === "pending"   && "bg-transparent"
                )}
                style={{ width: `${phase.pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-0.5">
        {phases.map((phase) => (
          <div key={phase.id} className="flex-1 min-w-0">
            <p className="truncate text-[9px] text-muted-foreground">{phase.shortName}</p>
            <p
              className={cn(
                "text-[9px] font-semibold",
                phase.status === "complete" && "text-primary",
                phase.status === "active"   && "text-primary/70",
                phase.status === "pending"  && "text-muted-foreground"
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
