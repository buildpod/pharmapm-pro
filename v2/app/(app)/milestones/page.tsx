import { MilestonesGrid } from "@/components/milestones/milestones-grid";

export default function MilestonesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Milestones</h1>
        <p className="text-sm text-muted-foreground">
          Interactive schedule with dependency-aware cascade preview. Click a planned date to edit — downstream impact is shown before you commit.
        </p>
      </header>
      <MilestonesGrid />
    </div>
  );
}
