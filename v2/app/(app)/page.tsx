import {
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Clock,
} from "lucide-react";

const kpis = [
  { label: "Schedule Health", value: "On Track", sub: "+2 days buffer", icon: TrendingUp, color: "text-green-600" },
  { label: "Open Risks", value: "3", sub: "1 high · 2 medium", icon: AlertTriangle, color: "text-amber-600" },
  { label: "Budget Utilised", value: "62%", sub: "$1.24M of $2M", icon: DollarSign, color: "text-primary" },
  { label: "Days to Go-Live", value: "114", sub: "Target: 02 Sep 2026", icon: Clock, color: "text-foreground" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Veeva RIM Implementation — Phase 2 overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className={`mt-2 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Upcoming Milestones</h3>
          </div>
          <p className="text-xs text-muted-foreground">Full milestone data coming in M4.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Decisions Needed</h3>
          </div>
          <p className="text-xs text-muted-foreground">Document review data coming in M5.</p>
        </div>
      </div>
    </div>
  );
}
