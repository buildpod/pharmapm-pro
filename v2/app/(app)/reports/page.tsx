import { WeeklyReport } from "@/components/reports/weekly-report";

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Weekly status report · print or save as PDF · export to Excel
        </p>
      </div>
      <WeeklyReport />
    </div>
  );
}
