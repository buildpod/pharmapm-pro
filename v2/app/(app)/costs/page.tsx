import { CostsGrid } from "@/components/costs/costs-grid";

export default function CostsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Costs</h2>
        <p className="text-sm text-muted-foreground">
          Budget vs actual · burn bars by category · monthly trend
        </p>
      </div>
      <CostsGrid />
    </div>
  );
}
