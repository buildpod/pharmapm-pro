import { CostsGrid } from "@/components/costs/costs-grid";

export default function CostsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Costs</h1>
        <p className="text-sm text-muted-foreground">
          Budget versus actual spend across all cost categories. Per-line burn bars surface anything approaching its budget ceiling.
        </p>
      </header>
      <CostsGrid />
    </div>
  );
}
