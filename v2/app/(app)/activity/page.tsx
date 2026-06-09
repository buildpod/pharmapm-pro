import { ActivityFeed } from "@/components/activity/activity-feed";

export default function ActivityPage() {
  return (
    <>
      <div className="page-header">
        <div className="page-header__eyebrow">Overview</div>
        <h1 className="t-page-title page-header__title">Activity</h1>
        <div className="page-header__meta">
          <span>Everything that changed on this project, newest first</span>
          <em>•</em>
          <span>Each entry traces to its source for audit</span>
        </div>
      </div>
      <ActivityFeed />
    </>
  );
}
