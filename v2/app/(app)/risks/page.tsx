import { RisksGrid } from "@/components/risks/risks-grid";

export default function RisksPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Risks</h2>
        <p className="text-sm text-muted-foreground">
          P × I score matrix · sorted by score · click to update status
        </p>
      </div>
      <RisksGrid />
    </div>
  );
}
