import { DollarSign } from "lucide-react";

export default function CostsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Costs</h2>
        <p className="text-sm text-muted-foreground">Budget vs actual · burn bars · totals row</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
        <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Coming in M6</p>
        <p className="text-xs text-muted-foreground mt-1">Budget vs actual · burn bars · cost category breakdown</p>
      </div>
    </div>
  );
}
