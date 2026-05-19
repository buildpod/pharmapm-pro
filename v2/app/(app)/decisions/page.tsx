import { DecisionsGrid } from "@/components/decisions/decisions-grid";

export default function DecisionsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Decisions</h1>
        <p className="text-sm text-muted-foreground">
          Material decisions on this project — what was decided, when, by whom, what alternatives were considered, and the rationale. Every audit and SteerCo review reads from here.
        </p>
      </header>
      <DecisionsGrid />
    </div>
  );
}
