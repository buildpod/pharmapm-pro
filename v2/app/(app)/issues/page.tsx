import { IssuesGrid } from "@/components/issues/issues-grid";

export default function IssuesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Issues</h1>
        <p className="text-sm text-muted-foreground">
          Live problems affecting the project — distinct from Risks (potential future events). Track raised date, owner, severity, and resolution plan. Every audit and SteerCo review reads from this register.
        </p>
      </header>
      <IssuesGrid />
    </div>
  );
}
