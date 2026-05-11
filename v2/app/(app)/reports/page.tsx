import { BarChart2 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground">Weekly status report · print stylesheet · Excel export</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
        <BarChart2 className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Coming in M7</p>
        <p className="text-xs text-muted-foreground mt-1">Printable weekly status · Excel export via SheetJS</p>
      </div>
    </div>
  );
}
