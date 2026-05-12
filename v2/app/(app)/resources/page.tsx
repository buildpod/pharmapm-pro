import { ResourcesPanel } from "@/components/resources/resources-panel";

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Resources</h1>
        <p className="text-sm text-muted-foreground">
          Team availability, meeting cadence, and pre-brief materials. Absences automatically surface impacted tasks and milestones; SteerCo and workstream pre-briefs derive per-attendee actions from live project data.
        </p>
      </header>
      <ResourcesPanel />
    </div>
  );
}
