import { MilestonesGrid } from "@/components/milestones/milestones-grid";

export default function MilestonesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Milestones</h2>
        <p className="text-sm text-muted-foreground">
          Interactive schedule · edit dates · cascade preview · dependency engine
        </p>
      </div>
      <MilestonesGrid />
    </div>
  );
}
