import { CharterView } from "@/components/charter/charter-view";

export default function CharterPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Charter</h1>
        <p className="text-sm text-muted-foreground">
          The formal authorisation for this project — purpose, objectives, scope, sponsor, and approval. Reference document for every SteerCo decision.
        </p>
      </header>
      <CharterView />
    </div>
  );
}
