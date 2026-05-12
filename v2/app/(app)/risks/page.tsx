import { RisksGrid } from "@/components/risks/risks-grid";

export default function RisksPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Risks</h1>
        <p className="text-sm text-muted-foreground">
          Probability × Impact heatmap with full mitigation context. The matrix on the left and the cards on the right are cross-linked — click any risk dot to jump to its detail.
        </p>
      </header>
      <RisksGrid />
    </div>
  );
}
