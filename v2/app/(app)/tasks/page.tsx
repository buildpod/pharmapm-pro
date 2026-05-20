import { TasksGrid } from "@/components/tasks/tasks-grid";

export default function TasksPage() {
  return (
    <>
      <div className="page-header">
        <div className="page-header__eyebrow">Planning</div>
        <h1 className="t-page-title page-header__title">Tasks</h1>
        <div className="page-header__meta">
          <span>Grouped by workstream</span>
          <em>•</em>
          <span>Click status to advance, progress bar to edit</span>
          <em>•</em>
          <span>Dependency tags flag upstream work</span>
        </div>
      </div>
      <TasksGrid />
    </>
  );
}
