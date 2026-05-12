import { TasksGrid } from "@/components/tasks/tasks-grid";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Grouped by workstream. Click a status badge to advance, click a progress bar to edit. Upstream dependency tags flag what each task is waiting on.
        </p>
      </header>
      <TasksGrid />
    </div>
  );
}
