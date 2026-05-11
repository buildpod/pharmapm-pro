import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Clock,
  Milestone,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { getKpis, budgetTrend, riskTrend } from "@/lib/mockData";
import { PhaseProgress } from "@/components/dashboard/phase-progress";
import { Sparkline } from "@/components/dashboard/sparkline";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const statusIcon = {
  "complete":    { icon: CheckCircle2, cls: "text-green-600" },
  "in-progress": { icon: Circle,       cls: "text-primary"   },
  "at-risk":     { icon: AlertCircle,  cls: "text-destructive" },
  "pending":     { icon: Circle,       cls: "text-muted-foreground" },
} as const;

export default function DashboardPage() {
  const kpis = getKpis();

  const scheduleOnTrack = kpis.scheduleVariance <= 0;
  const varianceLabel   = kpis.scheduleVariance === 0
    ? "On schedule"
    : kpis.scheduleVariance > 0
    ? `+${kpis.scheduleVariance}d variance`
    : `${kpis.scheduleVariance}d ahead`;

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Schedule Health */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">Schedule Health</p>
            {scheduleOnTrack
              ? <TrendingUp className="h-4 w-4 text-green-600" />
              : <TrendingDown className="h-4 w-4 text-destructive" />}
          </div>
          <p className={cn("mt-2 text-2xl font-bold", scheduleOnTrack ? "text-green-600" : "text-destructive")}>
            {scheduleOnTrack ? "On Track" : "At Risk"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{varianceLabel}</p>
        </div>

        {/* Open Risks */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">Open Risks</p>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-500">{kpis.openRisksCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kpis.highRisks} high · {kpis.medRisks} medium
          </p>
        </div>

        {/* Budget */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">Budget Utilised</p>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{kpis.budgetPct}%</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ${(kpis.latestActualK / 1000).toFixed(2)}M of ${(kpis.totalBudgetK / 1000).toFixed(1)}M
          </p>
        </div>

        {/* Days to Go-Live */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">Days to Go-Live</p>
            <Clock className="h-4 w-4 text-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{kpis.daysToGoLive}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Target: 02 Sep 2026</p>
        </div>
      </div>

      {/* ── Phase Progress ──────────────────────────── */}
      <PhaseProgress />

      {/* ── Sparkline Charts ────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Risk Profile */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Risk Profile</p>
            <span className="text-xs text-muted-foreground">open risks / month</span>
          </div>
          <Sparkline
            data={riskTrend}
            dataKey="open"
            color="#f59e0b"
            gradientId="riskGrad"
            label="Open risks"
          />
          <div className="mt-1 flex gap-4">
            {riskTrend.map((d) => (
              <div key={d.month} className="flex-1 text-center">
                <p className="text-[9px] text-muted-foreground">{d.month}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Burn */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Budget Burn</p>
            <span className="text-xs text-muted-foreground">cumulative $k</span>
          </div>
          <Sparkline
            data={budgetTrend.filter((d) => d.actual > 0)}
            dataKey="actual"
            color="#3b82f6"
            gradientId="budgetGrad"
            label="Actual $k"
          />
          <div className="mt-1 flex gap-4">
            {budgetTrend.filter((d) => d.actual > 0).map((d) => (
              <div key={d.month} className="flex-1 text-center">
                <p className="text-[9px] text-muted-foreground">{d.month}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Upcoming Milestones + Pending Docs ─────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Upcoming Milestones */}
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Milestone className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Upcoming Milestones</p>
            <span className="ml-auto text-xs text-muted-foreground">next 5</span>
          </div>
          <ul className="divide-y divide-border">
            {kpis.upcomingMilestones.map((m) => {
              const { icon: Icon, cls } = statusIcon[m.status];
              const variance = Math.ceil(
                (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000
              );
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cls)} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.phase}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-foreground">{formatDate(m.forecastDate)}</p>
                    {variance !== 0 && (
                      <p className={cn("text-[10px]", variance > 0 ? "text-destructive" : "text-green-600")}>
                        {variance > 0 ? `+${variance}d` : `${variance}d`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Decisions Needed */}
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Decisions Needed</p>
            <span className="ml-auto text-xs text-muted-foreground">pending review</span>
          </div>
          <ul className="divide-y divide-border">
            {kpis.pendingDocs.map((doc) => {
              const allDecisions = [...doc.reviewers, ...doc.approvers];
              const pendingCount = allDecisions.filter((d) => d.status === "pending").length;
              return (
                <li key={doc.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {doc.type} · v{doc.version} · due {formatDate(doc.dueDate)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      {pendingCount} pending
                    </span>
                  </div>
                  {/* Decision dots */}
                  <div className="mt-2 flex gap-1">
                    {allDecisions.map((d, i) => (
                      <div
                        key={i}
                        title={`${d.person} (${d.role}): ${d.status}`}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white",
                          d.status === "approved" ? "bg-green-500" : d.status === "rejected" ? "bg-destructive" : "bg-muted-foreground/40"
                        )}
                      >
                        {d.initials}
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
