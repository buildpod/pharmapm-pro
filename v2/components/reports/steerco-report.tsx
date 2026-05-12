"use client";

import { useState } from "react";
import { Printer, Download, ChevronRight, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import * as XLSX from "xlsx";
import {
  project,
  phases,
  milestones,
  tasks,
  risks,
  documents,
  costLines,
  budgetTrend,
  getKpis,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY       = new Date("2026-05-11");
const MEETING_DATE = "11 May 2026";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Derived data ─────────────────────────────────────────────────────────────

function buildSteerCoData() {
  const kpis = getKpis();

  const scheduleVariance = kpis.scheduleVariance;
  const scheduleRag: "Green" | "Amber" | "Red" =
    scheduleVariance >= 5 ? "Red" : scheduleVariance > 0 ? "Amber" : "Green";

  const totalBudgetK = costLines.reduce((s, c) => s + c.budgetK, 0);
  const totalActualK = costLines.reduce((s, c) => s + c.actualK, 0);
  const burnPct      = Math.round((totalActualK / totalBudgetK) * 100);
  const budgetRag: "Green" | "Amber" | "Red" =
    burnPct > 85 ? "Red" : burnPct > 70 ? "Amber" : "Green";

  const openHighRisks = risks.filter((r) => r.status === "open" && r.score >= 15);
  const qualityRag: "Green" | "Amber" | "Red" =
    openHighRisks.length >= 3 ? "Red" : openHighRisks.length >= 1 ? "Amber" : "Green";

  // Scope: blocked tasks or tasks with Critical priority not started
  const criticalNotStarted = tasks.filter((t) => t.priority === "Critical" && t.status === "Not Started");
  const scopeRag: "Green" | "Amber" | "Red" =
    criticalNotStarted.length >= 2 ? "Red" : criticalNotStarted.length >= 1 ? "Amber" : "Green";

  // Key milestones (next 3 by forecast date, not complete)
  const keyMilestones = milestones
    .filter((m) => m.status !== "complete")
    .sort((a, b) => a.forecastDate.localeCompare(b.forecastDate))
    .slice(0, 4);

  // Completed milestones
  const completedMs = milestones.filter((m) => m.status === "complete");

  // Decisions needed at SteerCo level (approver pending)
  const steerCoDecisions = documents.flatMap((doc) =>
    (doc.approvers ?? [])
      .filter((a) => a.status === "pending")
      .map((a) => ({ docName: doc.name, docType: doc.type, approver: a.person }))
  );

  // Escalated risks (high score, open)
  const escalatedRisks = risks
    .filter((r) => r.status === "open" && r.score >= 12)
    .sort((a, b) => b.score - a.score);

  // Overall health
  const overallRag: "Green" | "Amber" | "Red" =
    [scheduleRag, budgetRag, qualityRag, scopeRag].includes("Red") ? "Red" :
    [scheduleRag, budgetRag, qualityRag, scopeRag].includes("Amber") ? "Amber" : "Green";

  // Phase completion
  const activePhase = phases.find((p) => p.status === "active");

  // Budget trend for last 3 months
  const recentTrend = budgetTrend.slice(-3);

  return {
    kpis, scheduleRag, budgetRag, qualityRag, scopeRag, overallRag,
    burnPct, totalActualK, totalBudgetK, keyMilestones, completedMs,
    steerCoDecisions, escalatedRisks, activePhase, recentTrend,
    scheduleVariance, criticalNotStarted,
  };
}

// ─── RAG helpers ──────────────────────────────────────────────────────────────

const ragBg: Record<"Green" | "Amber" | "Red", string> = {
  Green: "bg-green-500",
  Amber: "bg-amber-500",
  Red:   "bg-rose-500",
};
const ragBorder: Record<"Green" | "Amber" | "Red", string> = {
  Green: "border-green-200 bg-green-50",
  Amber: "border-amber-200 bg-amber-50",
  Red:   "border-rose-200 bg-rose-50",
};
const ragText: Record<"Green" | "Amber" | "Red", string> = {
  Green: "text-green-700",
  Amber: "text-amber-700",
  Red:   "text-rose-700",
};

function RagDot({ rag }: { rag: "Green" | "Amber" | "Red" }) {
  return <span className={cn("inline-block h-3 w-3 rounded-full shrink-0", ragBg[rag])} />;
}

function RagCard({ label, rag, detail }: { label: string; rag: "Green" | "Amber" | "Red"; detail: string }) {
  return (
    <div className={cn("rounded-lg border p-3 space-y-1", ragBorder[rag])}>
      <div className="flex items-center gap-2">
        <RagDot rag={rag} />
        <span className="text-xs font-bold text-foreground">{label}</span>
        <span className={cn("ml-auto text-xs font-bold", ragText[rag])}>{rag}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{detail}</p>
    </div>
  );
}

// ─── Score band ───────────────────────────────────────────────────────────────

function scorePill(score: number) {
  if (score >= 15) return "bg-rose-50 text-rose-700 border border-rose-200";
  if (score >= 8)  return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
}

// ─── Excel export ─────────────────────────────────────────────────────────────

function exportSteerCoExcel(data: ReturnType<typeof buildSteerCoData>) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — SteerCo Summary
  const summaryRows = [
    ["AivelloStudio RIM — Steering Committee Report"],
    ["Project",      project.name],
    ["Client",       project.client],
    ["Meeting Date", MEETING_DATE],
    [],
    ["RAG Dashboard", "Status", "Detail"],
    ["Overall",   data.overallRag,   ""],
    ["Schedule",  data.scheduleRag,  `Variance: ${data.scheduleVariance >= 0 ? "+" : ""}${data.scheduleVariance} days`],
    ["Budget",    data.budgetRag,    `${data.burnPct}% of $${data.totalBudgetK}k spent`],
    ["Quality",   data.qualityRag,   `${data.escalatedRisks.length} escalated risks`],
    ["Scope",     data.scopeRag,     `${data.criticalNotStarted.length} critical tasks not started`],
    [],
    ["Days to Go-Live", data.kpis.daysToGoLive],
    ["Milestones Complete", `${data.completedMs.length}/${milestones.length}`],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "SteerCo Summary");

  // Sheet 2 — Key Milestones
  const msHeaders = ["Milestone", "Phase", "Status", "Planned", "Forecast", "Variance (days)"];
  const msRows = data.keyMilestones.map((m) => [
    m.name, m.phase, m.status,
    fmtDate(m.plannedDate), fmtDate(m.forecastDate),
    Math.ceil((new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([msHeaders, ...msRows]), "Key Milestones");

  // Sheet 3 — Decisions for SteerCo
  const decHeaders = ["Document", "Type", "Approver Required"];
  const decRows = data.steerCoDecisions.map((d) => [d.docName, d.docType, d.approver]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([decHeaders, ...decRows]), "Decisions Needed");

  // Sheet 4 — Escalated Risks
  const riskHeaders = ["Risk", "Category", "Score", "P", "I", "Owner", "Mitigation"];
  const riskRows = data.escalatedRisks.map((r) => [r.title, r.category, r.score, r.probability, r.impact, r.owner, r.mitigation]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([riskHeaders, ...riskRows]), "Escalated Risks");

  XLSX.writeFile(wb, `AivelloRIM_SteerCo_${TODAY.toISOString().slice(0, 10)}.xlsx`);
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

// ─── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="h-3 w-3 text-amber-500" />;
  if (delta < 0) return <TrendingDown className="h-3 w-3 text-green-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SteerCoReport() {
  const [data] = useState(buildSteerCoData);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save PDF
        </button>
        <button
          onClick={() => exportSteerCoExcel(data)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Excel
        </button>
        <span className="text-[10px] text-muted-foreground ml-2">
          4-sheet workbook: SteerCo Summary · Key Milestones · Decisions · Escalated Risks
        </span>
      </div>

      {/* Report card */}
      <div className="rounded-lg border border-border bg-card shadow-sm p-6 space-y-6 print:shadow-none print:border-0 print:p-0 print:rounded-none">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AivelloStudio RIM</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Steering Committee Report</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{project.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{project.phase} · {project.client}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs text-muted-foreground">Overall Status</span>
              <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", ragBorder[data.overallRag], ragText[data.overallRag])}>
                <RagDot rag={data.overallRag} />
                {data.overallRag}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Meeting: {MEETING_DATE}</p>
            <p className="text-xs text-muted-foreground">Go-Live: {fmtDate(project.goLiveDate)} · <strong>{data.kpis.daysToGoLive} days</strong></p>
          </div>
        </div>

        {/* RAG Dashboard */}
        <Section title="RAG Dashboard">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RagCard label="Schedule" rag={data.scheduleRag}
              detail={data.scheduleVariance === 0 ? "All milestones on track" : `Next milestone ${data.scheduleVariance > 0 ? `+${data.scheduleVariance}d late` : "on track"}`} />
            <RagCard label="Budget" rag={data.budgetRag}
              detail={`$${data.totalActualK}k of $${data.totalBudgetK}k (${data.burnPct}%) spent`} />
            <RagCard label="Quality / Risk" rag={data.qualityRag}
              detail={`${data.escalatedRisks.length} risk${data.escalatedRisks.length !== 1 ? "s" : ""} requiring SteerCo awareness`} />
            <RagCard label="Scope" rag={data.scopeRag}
              detail={data.criticalNotStarted.length === 0 ? "All critical tasks in flight" : `${data.criticalNotStarted.length} critical task${data.criticalNotStarted.length !== 1 ? "s" : ""} not yet started`} />
          </div>
        </Section>

        {/* Two-column body */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:grid-cols-2">

          {/* Key milestones */}
          <Section title="Critical Path Milestones">
            <div className="rounded-md border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 text-left">Milestone</th>
                    <th className="px-3 py-1.5 text-center w-20">Forecast</th>
                    <th className="px-3 py-1.5 text-center w-16">Var.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.keyMilestones.map((m) => {
                    const var_ = Math.ceil((new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000);
                    return (
                      <tr key={m.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground leading-tight">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.phase}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{fmtDate(m.forecastDate)}</td>
                        <td className="px-3 py-2 text-center">
                          {var_ === 0 ? (
                            <span className="text-green-600 font-semibold text-[10px]">On plan</span>
                          ) : (
                            <span className={cn("font-semibold text-[10px]", var_ > 0 ? "text-amber-600" : "text-green-600")}>
                              {var_ > 0 ? `+${var_}d` : `${var_}d`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 mt-1">
              <span>{data.completedMs.length} of {milestones.length} milestones complete</span>
              <span>{data.kpis.daysToGoLive} days to go-live</span>
            </div>
          </Section>

          {/* Progress by phase */}
          <Section title="Phase Completion">
            <div className="space-y-2">
              {phases.map((ph) => (
                <div key={ph.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground">{ph.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{ph.pct}%</span>
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                        ph.status === "complete" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        ph.status === "active"   ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {ph.status === "complete" ? "Done" : ph.status === "active" ? "Active" : "Pending"}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full",
                        ph.status === "complete" ? "bg-green-500" :
                        ph.status === "active"   ? "bg-primary" :
                        "bg-muted-foreground/20"
                      )}
                      style={{ width: `${ph.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Escalated risks */}
          <Section title="Risks Requiring SteerCo Awareness">
            {data.escalatedRisks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No high-score risks currently open.</p>
            ) : (
              <div className="rounded-md border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-1.5 text-center w-12">Score</th>
                      <th className="px-3 py-1.5 text-left">Risk</th>
                      <th className="px-3 py-1.5 text-left">Mitigation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.escalatedRisks.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", scorePill(r.score))}>
                            {r.score}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground leading-tight">{r.title}</p>
                          <p className="text-[10px] text-muted-foreground">{r.category} · P{r.probability}×I{r.impact} · {r.owner}</p>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px] leading-snug">{r.mitigation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Decisions needed from SteerCo */}
          <Section title="Decisions Required from SteerCo">
            {data.steerCoDecisions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No approvals pending from steering committee.</p>
            ) : (
              <div className="space-y-2">
                {data.steerCoDecisions.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{d.docName}</p>
                      <p className="text-[10px] text-muted-foreground">{d.docType} · Pending approval from {d.approver}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Budget trend mini table */}
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Budget Trend (last 3 months)</p>
              <div className="rounded-md border border-border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-1 text-left">Month</th>
                      <th className="px-3 py-1 text-right">Planned $k</th>
                      <th className="px-3 py-1 text-right">Actual $k</th>
                      <th className="px-3 py-1 text-center w-8">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recentTrend.map((b, i) => (
                      <tr key={b.month}>
                        <td className="px-3 py-1.5 font-medium">{b.month}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{b.planned}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{b.actual || "—"}</td>
                        <td className="px-3 py-1.5 flex justify-center">
                          <TrendIcon delta={i > 0 ? (b.actual - data.recentTrend[i - 1].actual) : 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>AivelloStudio RIM · Steering Committee Report · {MEETING_DATE}</span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Strictly Confidential — Steering Committee Use Only
          </span>
        </div>
      </div>
    </div>
  );
}
