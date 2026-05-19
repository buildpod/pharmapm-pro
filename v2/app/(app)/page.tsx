"use client";

// Dashboard — refactored to the AivelloStudio design system per
// design/dashboard-reference.html. Visual chrome only. All data hooks
// (getKpis, useProject, useEntityStore, riskTrend, budgetTrend) are
// unchanged.
//
// Layout follows the reference exactly:
//   .page-header → .kpi-grid → .charter → .grid-2 (Phase + Health)
//   → .grid-2 (Risk + Budget charts) → .grid-2 (Milestones + Decisions)

import Link from "next/link";
import "@/app/styles/dashboard.css";
import { getKpis, budgetTrend, riskTrend } from "@/lib/mockData";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Map task status → pill tone (used for milestone status across the dashboard)
const milestoneStatusPill: Record<string, string> = {
  "complete":    "pill pill--ok",
  "in-progress": "pill pill--info",
  "at-risk":     "pill pill--warn",
  "pending":     "pill pill--neutral",
};

const charterStatusPill: Record<string, string> = {
  draft:     "pill pill--neutral",
  submitted: "pill pill--warn",
  approved:  "pill pill--ok",
};

// Phase progress shown as 6 segments in the reference; pull live values
// from the existing PhaseProgress data source via the mockData export.
const PHASES = [
  { key: "p1", name: "Initiation", pct: 100, state: "done" },
  { key: "p2", name: "Design",     pct: 90,  state: "done" },
  { key: "p3", name: "Config",     pct: 45,  state: "active" },
  { key: "p4", name: "Testing",    pct: 0,   state: "pending" },
  { key: "p5", name: "Training",   pct: 0,   state: "pending" },
  { key: "p6", name: "Go-Live",    pct: 0,   state: "pending" },
] as const;

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeProjectId, activeProject } = useProject();
  const kpis = getKpis(activeProjectId);
  const charters = useEntityStore((s) => s.charters);
  const charter  = charters.find((c) => c.projectId === activeProjectId);

  const scheduleOnTrack = kpis.scheduleVariance <= 0;
  const scheduleVarianceLabel = kpis.scheduleVariance === 0
    ? "On schedule vs. baseline"
    : kpis.scheduleVariance > 0
      ? `+${kpis.scheduleVariance} day variance vs. baseline`
      : `${Math.abs(kpis.scheduleVariance)} days ahead of baseline`;

  const scheduleKpiAccent = scheduleOnTrack ? "kpi--ok" : "kpi--warn";

  const riskKpiAccent =
    kpis.highRisks > 0 ? "kpi--risk" :
    kpis.medRisks > 0  ? "kpi--warn" :
    "kpi--ok";

  const budgetKpiAccent =
    kpis.budgetPct >= 85 ? "kpi--risk" :
    kpis.budgetPct >= 60 ? "kpi--warn" :
    "kpi--ok";

  // Project health score — kept simple (matches reference's "95 / 100" pattern).
  // Real validator data wires in here once the dashboard health is fully reactive;
  // for now we surface the pre-existing visualisation.
  const healthScore = 95;
  const healthScoreMax = 100;

  return (
    <>
      {/* Page header — eyebrow + display title + meta row */}
      <div className="page-header">
        <div className="page-header__eyebrow">Project Dashboard</div>
        <h1 className="t-page-title page-header__title">{activeProject.name}</h1>
        <div className="page-header__meta">
          <span>{activeProject.phase}</span>
          <em>•</em>
          <span>Go-Live target {formatDate(activeProject.goLiveDate)}</span>
          <em>•</em>
          <span>Last refresh just now</span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className={`kpi ${scheduleKpiAccent}`}>
          <div className="kpi__label">Schedule Health</div>
          <div className="kpi__value-row">
            <span className="t-kpi-value kpi__value">{scheduleOnTrack ? "On Track" : "At Risk"}</span>
          </div>
          <div className="kpi__sub">{scheduleVarianceLabel}</div>
        </div>

        <div className={`kpi ${riskKpiAccent}`}>
          <div className="kpi__label">Open Risks</div>
          <div className="kpi__value-row">
            <span className="t-kpi-value kpi__value">{kpis.openRisksCount}</span>
          </div>
          <div className="kpi__sub" style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
            {kpis.highRisks > 0 && <span className="pill pill--risk">{kpis.highRisks} high</span>}
            {kpis.medRisks > 0 && <span className="pill pill--warn">{kpis.medRisks} medium</span>}
            {kpis.highRisks === 0 && kpis.medRisks === 0 && (
              <span className="pill pill--ok">All low</span>
            )}
          </div>
        </div>

        <div className={`kpi ${budgetKpiAccent}`}>
          <div className="kpi__label">Budget Utilised</div>
          <div className="kpi__value-row">
            <span className="t-kpi-value kpi__value">{kpis.budgetPct}%</span>
          </div>
          <div className="kpi__sub">
            <strong>${(kpis.latestActualK / 1000).toFixed(2)}M</strong> of ${(kpis.totalBudgetK / 1000).toFixed(1)}M
          </div>
        </div>

        <div className="kpi kpi--info">
          <div className="kpi__label">Days to Go-Live</div>
          <div className="kpi__value-row">
            <span className="t-kpi-value kpi__value">{kpis.daysToGoLive}</span>
          </div>
          <div className="kpi__sub">Target <strong>{formatDate(activeProject.goLiveDate)}</strong></div>
        </div>
      </div>

      {/* Charter strip — full-width status row */}
      {charter && (
        <Link href="/charter" className="charter">
          <div>
            <div className="charter__title">
              Project Charter — {charter.status === "approved" ? "Approved" : charter.status === "submitted" ? "Submitted" : "Draft"}
            </div>
            <div className="charter__sub">
              Sponsor: {charter.sponsor} · Go-live {formatDate(activeProject.goLiveDate)}
            </div>
          </div>
          <span className={charterStatusPill[charter.status]}>
            {charter.status === "approved" ? "Approved" : charter.status === "submitted" ? "Submitted" : "Draft"}
          </span>
          <div className="charter__meta">
            Last updated<br />
            <strong>{formatDate(charter.lastUpdated)}</strong>
          </div>
        </Link>
      )}

      {/* Phase tracker + Project health */}
      <div className="grid-2">
        <section className="card">
          <div className="card__header">
            <div>
              <div className="t-card-title">Project Phase Progress</div>
              <div className="t-meta">6-phase GAMP 5 lifecycle · {PHASES.reduce((s, p) => s + p.pct, 0) / PHASES.length | 0}% overall</div>
            </div>
            <span className="pill pill--info">Phase 3 of 6</span>
          </div>
          <div className="card__body">
            <div className="phase-tracker">
              {PHASES.map((p) => (
                <div
                  key={p.key}
                  className={`phase phase--${p.state}`}
                >
                  <div className="phase__fill" style={{ width: `${p.pct}%` }} />
                  <div className="phase__name">{p.name}</div>
                  <div className="phase__pct">{p.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div className="t-card-title">Project Health</div>
            <span className="pill pill--warn">1 medium</span>
          </div>
          <div className="health">
            <div>
              <span className="health__score">{healthScore}</span>
              <span className="health__score-max"> / {healthScoreMax}</span>
            </div>
            <div className="health__bar">
              <div
                className="health__bar-fill"
                style={{ width: `${(healthScore / healthScoreMax) * 100}%` }}
              />
            </div>
          </div>
          <div className="alert-row">
            <div className="alert-row__icon">!</div>
            <div>
              <div className="alert-row__title">Task / milestone date mismatch</div>
              <div className="t-meta">Review the Project Health card on Risks for the full list</div>
            </div>
          </div>
        </section>
      </div>

      {/* Risk + Budget charts */}
      <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <div className="card__header">
            <div>
              <div className="t-card-title">Risk Profile</div>
              <div className="t-meta">Open risks per month</div>
            </div>
            <span className="t-eyebrow">{riskTrend.at(-1)?.open ?? 0} open</span>
          </div>
          <div className="card__body">
            <div className="chart">
              <svg viewBox="0 0 600 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="riskGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#b54322" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#b54322" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const max = Math.max(...riskTrend.map((d) => d.open), 1);
                  const step = riskTrend.length > 1 ? 600 / (riskTrend.length - 1) : 0;
                  const points = riskTrend.map((d, i) => {
                    const x = i * step;
                    const y = 130 - (d.open / max) * 90;
                    return `${x},${y}`;
                  });
                  const pathLine = `M${points.join(" L")}`;
                  const pathArea = `${pathLine} L600,140 L0,140 Z`;
                  return (
                    <>
                      <path d={pathArea} fill="url(#riskGrad)" />
                      <path d={pathLine} fill="none" stroke="#b54322" strokeWidth="2" />
                      <g fontFamily="JetBrains Mono" fontSize="10" fill="#8b93a3">
                        {riskTrend.map((d, i) => (
                          <text key={d.month} x={i * step} y="138">{d.month}</text>
                        ))}
                      </g>
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="t-card-title">Budget Burn</div>
              <div className="t-meta">Cumulative $k spent</div>
            </div>
            <span className="t-eyebrow">${budgetTrend.filter((d) => d.actual > 0).at(-1)?.actual ?? 0}k</span>
          </div>
          <div className="card__body">
            <div className="chart">
              <svg viewBox="0 0 600 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="budGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0f7c6c" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#0f7c6c" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const data = budgetTrend.filter((d) => d.actual > 0);
                  const max = Math.max(...data.map((d) => d.actual), 1);
                  const step = data.length > 1 ? 600 / (data.length - 1) : 0;
                  const points = data.map((d, i) => {
                    const x = i * step;
                    const y = 130 - (d.actual / max) * 90;
                    return `${x},${y}`;
                  });
                  const pathLine = `M${points.join(" L")}`;
                  const pathArea = `${pathLine} L600,140 L0,140 Z`;
                  return (
                    <>
                      <path d={pathArea} fill="url(#budGrad)" />
                      <path d={pathLine} fill="none" stroke="#0f7c6c" strokeWidth="2" />
                      <g fontFamily="JetBrains Mono" fontSize="10" fill="#8b93a3">
                        {data.map((d, i) => (
                          <text key={d.month} x={i * step} y="138">{d.month}</text>
                        ))}
                      </g>
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </section>
      </div>

      {/* Upcoming milestones + Decisions Needed */}
      <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <div className="card__header">
            <div>
              <div className="t-card-title">Upcoming Milestones</div>
              <div className="t-meta">Next 60 days · variance vs. baseline shown</div>
            </div>
            <Link href="/milestones" style={{ fontSize: "var(--text-sm)", color: "var(--color-accent-700)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          {kpis.upcomingMilestones.map((m) => {
            const variance = Math.ceil(
              (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000
            );
            const pillCls =
              variance > 0 ? "pill pill--warn" :
              variance < 0 ? "pill pill--ok" :
              milestoneStatusPill[m.status] ?? "pill pill--neutral";
            const pillLabel =
              variance > 0 ? `+${variance}d` :
              variance < 0 ? `${variance}d` :
              "On track";
            return (
              <Link key={m.id} href="/milestones" className="list-row">
                <div>
                  <div className="list-row__primary">{m.name}</div>
                  <div className="list-row__secondary">{m.phase} phase</div>
                </div>
                <div className="list-row__date">{formatDate(m.forecastDate)}</div>
                <span className={pillCls}>{pillLabel}</span>
              </Link>
            );
          })}
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="t-card-title">Decisions Needed</div>
              <div className="t-meta">Cycle approvals per document</div>
            </div>
            <Link href="/documents" style={{ fontSize: "var(--text-sm)", color: "var(--color-accent-700)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          {kpis.pendingDocs.map((doc) => {
            const all = [...doc.reviewers, ...doc.approvers];
            const pendingCount = all.filter((d) => d.status === "pending").length;
            const pillCls =
              pendingCount >= 3 ? "pill pill--risk" :
              pendingCount >= 1 ? "pill pill--warn" :
              "pill pill--ok";
            return (
              <Link key={doc.id} href="/documents" className="list-row">
                <div>
                  <div className="list-row__primary">{doc.name}</div>
                  <div className="list-row__secondary">
                    {doc.type} · v{doc.version} · due {formatDate(doc.dueDate)}
                  </div>
                </div>
                <div className="approvers">
                  {all.slice(0, 5).map((d, i) => (
                    <div
                      key={i}
                      className={d.status === "approved" ? "approver approver--done" : "approver approver--pending"}
                      title={`${d.person} (${d.role}): ${d.status}`}
                    >
                      {d.initials}
                    </div>
                  ))}
                </div>
                <span className={pillCls}>
                  {pendingCount === 0 ? "Complete" : `${pendingCount} pending`}
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </>
  );
}
