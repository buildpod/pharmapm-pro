import { TasksGrid } from "@/components/tasks/tasks-grid";

export default function TasksPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
        <p className="text-sm text-muted-foreground">
          Grouped by workstream · priority flags · click to advance status · inline progress editing
        </p>
      </div>
      <TasksGrid />
    </div>
  );
}
