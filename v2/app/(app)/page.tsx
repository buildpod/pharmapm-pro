"use client";

import Link from "next/link";
import {
  TrendingUp, TrendingDown, AlertTriangle, DollarSign, Clock, Milestone,
  FileText, CheckCircle2, Circle, AlertCircle, ArrowUpRight, ChevronRight,
} from "lucide-react";
import { getKpis, budgetTrend, riskTrend } from "@/lib/mockData";
import { PhaseProgress } from "@/components/dashboard/phase-progress";
import { Sparkline } from "@/components/dashboard/sparkline";
import { ProjectHealth } from "@/components/dashboard/project-health";
import { CharterCard } from "@/components/dashboard/charter-card";
import { useProject } from "@/components/projects/project-provider";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Per-person avatar color (Linear/Notion pattern)
const AVATAR_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-teal-500",
  "bg-cyan-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500", "bg-pink-500",
];
function avatarColor(initials: string) {
  const hash = initials.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const statusIcon = {
  "complete":    { icon: CheckCircle2, cls: "text-emerald-600" },
  "in-progress": { icon: Circle,       cls: "text-blue-600"    },
  "at-risk":     { icon: AlertCircle,  cls: "text-rose-600"    },
  "pending":     { icon: Circle,       cls: "text-muted-foreground" },
} as const;

// ─── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, Icon, tone = "neutral", trend,
}: {
  label: string;
  value: string | number;
  sub: string;
  Icon: typeof TrendingUp;
  tone?: "neutral" | "good" | "warn" | "bad";
  trend?: "up" | "down" | "flat";
}) {
  const toneStyles = {
    neutral: { value: "text-foreground",     icon: "text-muted-foreground", chipBg: "bg-muted text-muted-foreground" },
    good:    { value: "text-emerald-600",    icon: "text-emerald-500",      chipBg: "bg-emerald-50 text-emerald-700" },
    warn:    { value: "text-amber-600",      icon: "text-amber-500",        chipBg: "bg-amber-50 text-amber-700"     },
    bad:     { value: "text-rose-600",       icon: "text-rose-500",         chipBg: "bg-rose-50 text-rose-700"       },
  };
  const t = toneStyles[tone];

  return (
    <div className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", t.chipBg)}>
          <Icon className={cn("h-4 w-4", t.icon)} />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <p className={cn("text-3xl font-bold tabular-nums leading-none", t.value)}>{value}</p>
        {trend && (
          <span className={cn("flex items-center text-xs font-semibold",
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-muted-foreground"
          )}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeProjectId, activeProject } = useProject();
  const kpis = getKpis(activeProjectId);
  const scheduleOnTrack = kpis.scheduleVariance <= 0;
  const varianceLabel = kpis.scheduleVariance === 0
    ? "On schedule"
    : kpis.scheduleVariance > 0
    ? `+${kpis.scheduleVariance} day variance`
    : `${kpis.scheduleVariance} day ahead`;

  return (
    <div className="space-y-8">
      {/* Header — context from the active project */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Project Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {activeProject.name} · {activeProject.phase} · Go-Live target {activeProject.goLiveDate}
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Schedule Health"
          value={scheduleOnTrack ? "On Track" : "At Risk"}
          sub={varianceLabel}
          Icon={scheduleOnTrack ? TrendingUp : TrendingDown}
          tone={scheduleOnTrack ? "good" : "bad"}
        />
        <KpiCard
          label="Open Risks"
          value={kpis.openRisksCount}
          sub={`${kpis.highRisks} high · ${kpis.medRisks} medium`}
          Icon={AlertTriangle}
          tone={kpis.highRisks > 0 ? "bad" : kpis.medRisks > 0 ? "warn" : "good"}
        />
        <KpiCard
          label="Budget Utilised"
          value={`${kpis.budgetPct}%`}
          sub={`$${(kpis.latestActualK / 1000).toFixed(2)}M of $${(kpis.totalBudgetK / 1000).toFixed(1)}M`}
          Icon={DollarSign}
          tone={kpis.budgetPct >= 85 ? "bad" : kpis.budgetPct >= 60 ? "warn" : "neutral"}
        />
        <KpiCard
          label="Days to Go-Live"
          value={kpis.daysToGoLive}
          sub={`Target ${activeProject.goLiveDate}`}
          Icon={Clock}
          tone="neutral"
        />
      </div>

      {/* Phase progress + Project health + Charter card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <PhaseProgress />
        <div className="space-y-4">
          <ProjectHealth />
          <CharterCard />
        </div>
      </div>

      {/* Sparkline cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Risk Profile</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Open risks per month</p>
            </div>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
              {riskTrend.at(-1)?.open ?? 0} open
            </span>
          </div>
          <Sparkline data={riskTrend} dataKey="open" color="#f59e0b" gradientId="riskGrad" label="Open risks" />
          <div className="mt-1 flex gap-2">
            {riskTrend.map((d) => (
              <div key={d.month} className="flex-1 text-center">
                <p className="text-[10px] font-medium text-muted-foreground">{d.month}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Budget Burn</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Cumulative $k spent</p>
            </div>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
              ${budgetTrend.filter((d) => d.actual > 0).at(-1)?.actual ?? 0}k
            </span>
          </div>
          <Sparkline data={budgetTrend.filter((d) => d.actual > 0)} dataKey="actual" color="#3b82f6" gradientId="budgetGrad" label="Actual $k" />
          <div className="mt-1 flex gap-2">
            {budgetTrend.filter((d) => d.actual > 0).map((d) => (
              <div key={d.month} className="flex-1 text-center">
                <p className="text-[10px] font-medium text-muted-foreground">{d.month}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming milestones + decisions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming milestones */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3">
            <Milestone className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Upcoming Milestones</p>
            <Link href="/milestones" className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {kpis.upcomingMilestones.map((m) => {
              const { icon: Icon, cls } = statusIcon[m.status];
              const variance = Math.ceil(
                (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000
              );
              return (
                <li key={m.id}>
                  <Link
                    href="/milestones"
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", cls)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.phase}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-foreground tabular-nums">{formatDate(m.forecastDate)}</p>
                      {variance !== 0 && (
                        <p className={cn(
                          "mt-0.5 text-[11px] font-semibold tabular-nums",
                          variance > 0 ? "text-rose-600" : "text-emerald-600",
                        )}>
                          {variance > 0 ? `+${variance}d` : `${variance}d`}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Decisions */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Decisions Needed</p>
            <Link href="/documents" className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {kpis.pendingDocs.map((doc) => {
              const all = [...doc.reviewers, ...doc.approvers];
              const pendingCount = all.filter((d) => d.status === "pending").length;
              return (
                <li key={doc.id}>
                  <Link
                    href="/documents"
                    className="group block px-5 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{doc.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {doc.type} · v{doc.version} · due {formatDate(doc.dueDate)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {pendingCount} pending
                      </span>
                    </div>
                    {/* Decision avatars */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {all.map((d, i) => (
                        <div key={i} className="relative" title={`${d.person} (${d.role}): ${d.status}`}>
                          <span className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            d.status === "pending" ? "bg-slate-300" : avatarColor(d.initials),
                          )}>
                            {d.initials}
                          </span>
                          <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card text-[8px] font-black",
                            d.status === "approved" ? "bg-emerald-500 text-white"
                            : d.status === "rejected" ? "bg-rose-500 text-white"
                            : "bg-slate-200 text-slate-600",
                          )}>
                            {d.status === "approved" ? "✓" : d.status === "rejected" ? "✗" : "·"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border bg-muted/20 px-5 py-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              Open the Documents page to cycle decisions per person
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
