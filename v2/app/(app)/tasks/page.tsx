import { CheckSquare } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
        <p className="text-sm text-muted-foreground">Grouped by workstream · priority flags · milestone links</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
        <CheckSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Coming in M6</p>
        <p className="text-xs text-muted-foreground mt-1">Workstream grouping · inline progress · task–milestone links</p>
      </div>
    </div>
  );
}
