import { DocumentsList } from "@/components/documents/documents-list";

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Per-person reviewer/approver chips · click to record decisions · status auto-derives
        </p>
      </div>
      <DocumentsList />
    </div>
  );
}
