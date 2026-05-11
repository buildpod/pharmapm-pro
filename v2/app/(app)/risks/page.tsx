import { AlertTriangle } from "lucide-react";

export default function RisksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Risks</h2>
        <p className="text-sm text-muted-foreground">Sorted by P×I score · color-coded pills</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Coming in M6</p>
        <p className="text-xs text-muted-foreground mt-1">Risk grid · probability × impact scoring · mitigation tracking</p>
      </div>
    </div>
  );
}
