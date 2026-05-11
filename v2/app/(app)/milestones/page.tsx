import { Milestone } from "lucide-react";

export default function MilestonesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Milestones</h2>
        <p className="text-sm text-muted-foreground">Schedule, dependency engine, and cascade preview</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
        <Milestone className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Coming in M4</p>
        <p className="text-xs text-muted-foreground mt-1">Interactive grid · dependency engine · cascade preview</p>
      </div>
    </div>
  );
}
