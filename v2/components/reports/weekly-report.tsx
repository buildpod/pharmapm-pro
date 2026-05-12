"use client";

import { useState } from "react";
import { Printer, Download, AlertTriangle, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import {
  project,
  milestones,
  tasks,
  risks,
  documents,
  costLines,
  getKpis,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY     = new Date("2026-05-11");
const REPORT_WK = "Week of 11 May 2026";
const NEXT_2WK  = new Date("2026-05-25"); // today + 14 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Derived report data ──────────────────────────────────────────────────────

function buildReportData() {
  const kpis = getKpis();

  // Schedule health derived from variance of next upcoming milestone
  const scheduleHealth =
    kpis.scheduleVariance >= 5 ? "Red" :
    kpis.scheduleVariance >  0 ? "Amber" : "Green";

  // Milestones due or completed in the past 7 days (this week)
  const thisWeekMs = milestones.filter((m) => {
    const d = new Date(m.forecastDate);
    return d >= new Date("2026-05-04") && d <= TODAY;
  });

  // Milestones due in the next 14 days
  const upcomingMs = milestones
    .filter((m) => {
      const d = new Date(m.forecastDate);
      return d > TODAY && d <= NEXT_2WK && m.status !== "complete";
    })
    .sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));

  // Tasks completing this week
  const thisWeekTasks = tasks.filter((t) => {
    const d = new Date(t.dueDate);
    return d >= new Date("2026-05-04") && d <= TODAY && t.status === "Complete";
  });

  // Tasks due in next 14 days (not complete)
  const upcomingTasks = tasks
    .filter((t) => {
      const d = new Date(t.dueDate);
      return d > TODAY && d <= NEXT_2WK && t.status !== "Complete";
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Open risks sorted by score desc
  const openRisks = risks
    .filter((r) => r.status === "open")
    .sort((a, b) => b.score - a.score);

  // Pending decisions across documents
  const pendingDecisions = documents.flatMap((doc) =>
    [...(doc.reviewers ?? []), ...(doc.approvers ?? [])]
      .filter((d) => d.status === "pending")
      .map((d) => ({ docTitle: doc.name, docType: doc.type, person: d.person, role: d.role }))
  );

  const totalBudgetK = costLines.reduce((s, c) => s + c.budgetK, 0);
  const totalActualK = costLines.reduce((s, c) => s + c.actualK, 0);
  const burnPct      = Math.round((totalActualK / totalBudgetK) * 100);

  return {
    kpis,
    scheduleHealth,
    thisWeekMs, upcomingMs,
    thisWeekTasks, upcomingTasks,
    openRisks, pendingDecisions,
    burnPct, totalActualK, totalBudgetK,
  };
}

// ─── Score band ───────────────────────────────────────────────────────────────

function scoreBandStyles(score: number) {
  if (score >= 15) return "bg-rose-50 text-rose-700 border border-rose-200";
  if (score >= 8)  return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
}

// ─── Excel export ─────────────────────────────────────────────────────────────

function exportExcel(data: ReturnType<typeof buildReportData>) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Summary
  const summaryRows = [
    ["AivelloStudio RIM — Weekly Status Report"],
    ["Project", project.name],
    ["Client",  project.client],
    ["Phase",   project.phase],
    ["Report Date", REPORT_WK],
    [],
    ["KPI", "Value"],
    ["Schedule Health",  data.scheduleHealth],
    ["Open Risks",       data.openRisks.length],
    ["High Risks",       data.kpis.highRisks],
    ["Budget Utilised",  `${data.burnPct}%`],
    ["Days to Go-Live",  data.kpis.daysToGoLive],
    ["Budget Spent",     `$${data.totalActualK}k of $${data.totalBudgetK}k`],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  // Sheet 2 — Upcoming Milestones
  const msHeaders = ["ID", "Milestone", "Phase", "Status", "Planned", "Forecast", "Variance (days)"];
  const msRows = data.upcomingMs.map((m) => [
    m.id,
    m.name,
    m.phase,
    m.status,
    fmtDate(m.plannedDate),
    fmtDate(m.forecastDate),
    daysBetween(new Date(m.plannedDate), new Date(m.forecastDate)),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([msHeaders, ...msRows]), "Milestones (Next 2 Weeks)");

  // Sheet 3 — Open Risks
  const riskHeaders = ["ID", "Risk", "Category", "P", "I", "Score", "Owner", "Mitigation"];
  const riskRows = data.openRisks.map((r) => [r.id, r.title, r.category, r.probability, r.impact, r.score, r.owner, r.mitigation]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([riskHeaders, ...riskRows]), "Open Risks");

  // Sheet 4 — Decisions Needed
  const decHeaders = ["Document", "Type", "Person", "Role"];
  const decRows = data.pendingDecisions.map((d) => [d.docTitle, d.docType, d.person, d.role]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([decHeaders, ...decRows]), "Decisions Needed");

  // Sheet 5 — Tasks (upcoming)
  const taskHeaders = ["ID", "Task", "Workstream", "Priority", "Owner", "Due", "Status", "Progress %"];
  const taskRows = data.upcomingTasks.map((t) => [t.id, t.name, t.workstream, t.priority, t.owner, fmtDate(t.dueDate), t.status, t.progress]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]), "Tasks (Next 2 Weeks)");

  XLSX.writeFile(wb, `AivelloRIM_WeeklyReport_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 print:break-inside-avoid">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const msStatusStyles: Record<string, string> = {
  "complete":    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "in-progress": "bg-blue-50 text-blue-700 border border-blue-200",
  "at-risk":     "bg-rose-50 text-rose-700 border border-rose-200",
  "pending":     "bg-muted text-muted-foreground",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function WeeklyReport() {
  const [data] = useState(buildReportData);

  const healthColor =
    data.scheduleHealth === "Green" ? "text-green-600" :
    data.scheduleHealth === "Amber" ? "text-amber-600" :
    "text-rose-600";

  return (
    <div className="space-y-4">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </button>
        <button
          onClick={() => exportExcel(data)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Excel
        </button>
        <span className="text-[10px] text-muted-foreground ml-2">
          5-sheet workbook: Summary · Milestones · Risks · Decisions · Tasks
        </span>
      </div>

      {/* ── Report card — this is what gets printed ── */}
      <div
        id="weekly-report"
        className="rounded-lg border border-border bg-card shadow-sm p-6 space-y-6 print:shadow-none print:border-0 print:p-0 print:rounded-none"
      >
        {/* Report header */}
        <div className="flex items-start justify-between border-b border-border pb-4 print:pb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AivelloStudio RIM</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Weekly Status Report</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{project.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{project.phase} · {project.client}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground">{REPORT_WK}</p>
            <p>Go-Live: {fmtDate(project.goLiveDate)}</p>
            <p>Methodology: {project.methodology}</p>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <Section title="Headline Metrics">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Schedule Health", value: data.scheduleHealth, sub: "RAG status", color: healthColor },
              { label: "Days to Go-Live",  value: data.kpis.daysToGoLive,  sub: fmtDate(project.goLiveDate), color: "text-foreground" },
              { label: "Open Risks",       value: data.openRisks.length,    sub: `${data.kpis.highRisks} high`, color: data.openRisks.length > 3 ? "text-rose-600" : "text-foreground" },
              { label: "Budget Utilised",  value: `${data.burnPct}%`,        sub: `$${data.totalActualK}k / $${data.totalBudgetK}k`, color: data.burnPct > 85 ? "text-rose-600" : data.burnPct > 60 ? "text-amber-600" : "text-foreground" },
              { label: "Decisions Pending",value: data.pendingDecisions.length, sub: "across all docs", color: data.pendingDecisions.length > 0 ? "text-amber-600" : "text-foreground" },
              { label: "Tasks In Flight",  value: tasks.filter((t) => t.status === "In Progress").length, sub: `${tasks.filter((t) => t.status === "Blocked").length} blocked`, color: "text-foreground" },
            ].map((k) => (
              <div key={k.label} className="rounded-md border border-border bg-muted/20 px-3 py-2.5 print:border-border">
                <p className={cn("text-xl font-bold tabular-nums", k.color)}>{k.value}</p>
                <p className="text-[10px] font-semibold text-foreground mt-0.5">{k.label}</p>
                <p className="text-[10px] text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Two-column body ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:grid-cols-2">

          {/* This week */}
          <Section title="This Week (completed / due)">
            {data.thisWeekMs.length === 0 && data.thisWeekTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No milestones or tasks fell due this week.</p>
            ) : (
              <div className="space-y-2">
                {data.thisWeekMs.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.phase} · {fmtDate(m.forecastDate)}</p>
                    </div>
                    <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0", msStatusStyles[m.status])}>
                      {m.status}
                    </span>
                  </div>
                ))}
                {data.thisWeekTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.workstream} · {t.owner}</p>
                    </div>
                    <span className="ml-auto rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 shrink-0">
                      Complete
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Next 2 weeks */}
          <Section title="Next 2 Weeks (due by 25 May)">
            {data.upcomingMs.length === 0 && data.upcomingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nothing due in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingMs.map((m) => {
                  const var_ = daysBetween(new Date(m.plannedDate), new Date(m.forecastDate));
                  return (
                    <div key={m.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                      <Clock className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground leading-tight truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">{m.phase} · Due {fmtDate(m.forecastDate)}</p>
                      </div>
                      {var_ > 0 && (
                        <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 shrink-0">
                          +{var_}d
                        </span>
                      )}
                    </div>
                  );
                })}
                {data.upcomingTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                    <Clock className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-tight truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.workstream} · {t.owner} · Due {fmtDate(t.dueDate)}</p>
                    </div>
                    <span className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0",
                      t.priority === "Critical" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                      t.priority === "High"     ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Top risks */}
          <Section title="Top Open Risks">
            {data.openRisks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No open risks.</p>
            ) : (
              <div className="rounded-md border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-1.5 text-center w-12">Score</th>
                      <th className="px-3 py-1.5 text-left">Risk</th>
                      <th className="px-3 py-1.5 text-center w-12">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.openRisks.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums", scoreBandStyles(r.score))}>
                            {r.score}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground leading-tight">{r.title}</p>
                          <p className="text-[10px] text-muted-foreground">{r.category} · P{r.probability}×I{r.impact}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{r.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Decisions needed */}
          <Section title="Decisions Needed">
            {data.pendingDecisions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No pending decisions.</p>
            ) : (
              <div className="rounded-md border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">Document</th>
                      <th className="px-3 py-1.5 text-left">Person</th>
                      <th className="px-3 py-1.5 text-left w-20">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.pendingDecisions.map((d, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground leading-tight">{d.docTitle}</p>
                          <span className="text-[9px] text-muted-foreground">{d.docType}</span>
                        </td>
                        <td className="px-3 py-2 text-foreground">{d.person}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                            d.role === "Approver" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-muted text-muted-foreground"
                          )}>
                            {d.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] text-muted-foreground print:pt-2">
          <span>Generated by AivelloStudio RIM · {REPORT_WK}</span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Confidential — for internal project use only
          </span>
        </div>
      </div>
    </div>
  );
}
