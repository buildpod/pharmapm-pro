import { FileText } from "lucide-react";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        <p className="text-sm text-muted-foreground">Per-person reviewer/approver chips · decision tracking</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
        <FileText className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Coming in M5</p>
        <p className="text-xs text-muted-foreground mt-1">Avatar chips per reviewer · approval workflow · decision history</p>
      </div>
    </div>
  );
}
