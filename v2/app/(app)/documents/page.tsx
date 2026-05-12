import { DocumentsList } from "@/components/documents/documents-list";

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          GxP-aligned lifecycle artefacts. Cards are grouped by validation phase. Click a person chip to record their decision — document status auto-derives.
        </p>
      </header>
      <DocumentsList />
    </div>
  );
}
