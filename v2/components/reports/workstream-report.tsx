"use client";

import { useState } from "react";
import { Printer, Download, ChevronRight, AlertTriangle, Layers } from "lucide-react";
import * as XLSX from "xlsx";
import {
  project,
  milestones,
  tasks,
  risks,
  type Task,
  type TaskStatus,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const TODAY = new Date("2026-05-11");
const TODAY_ISO = "2026-05-11";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Workstream list ──────────────────────────────────────────────────────────

const ALL_WORKSTREAMS = Array.from(new Set(tasks.map((t) => t.workstream)));

// ─── Status styles ────────────────────────────────────────────────────────────

const statusStyles: Record<TaskStatus, string> = {
  "Complete":    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "In Progress": "bg-blue-50 text-blue-700 border border-blue-200",
  "Not Started": "bg-muted text-muted-foreground",
  "Blocked":     "bg-rose-50 text-rose-700 border border-rose-200",
  "On Hold":     "bg-violet-50 text-violet-700 border border-violet-200",
};

const priorityDot: Record<string, string> = {
  Critical: "bg-rose-500",
  High:     "bg-amber-500",
  Medium:   "bg-yellow-400",
  Low:      "bg-muted-foreground/40",
};

const priorityPill: Record<string, string> = {
  Critical: "bg-rose-50 text-rose-700 border border-rose-200",
  High:     "bg-amber-50 text-amber-700 border border-amber-200",
  Medium:   "bg-yellow-50 text-yellow-700",
  Low:      "bg-muted text-muted-foreground",
};

// ─── Derived data ─────────────────────────────────────────────────────────────

function buildWorkstreamData(ws: string) {
  const wsTasks = tasks.filter((t) => t.workstream === ws);

  const total     = wsTasks.length;
  const complete  = wsTasks.filter((t) => t.status === "Complete").length;
  const inProgress = wsTasks.filter((t) => t.status === "In Progress").length;
  const blocked   = wsTasks.filter((t) => t.status === "Blocked").length;
  const notStarted = wsTasks.filter((t) => t.status === "Not Started").length;
  const avgProgress = total > 0 ? Math.round(wsTasks.reduce((s, t) => s + t.progress, 0) / total) : 0;

  // Milestones linked to tasks in this workstream
  const linkedMilestoneIds = new Set(wsTasks.map((t) => t.milestoneId).filter(Boolean));
  const linkedMilestones = milestones
    .filter((m) => linkedMilestoneIds.has(m.id))
    .sort((a, b) => a.forecastDate.localeCompare(b.forecastDate));

  // Overdue tasks
  const overdue = wsTasks.filter((t) => t.dueDate < TODAY_ISO && t.status !== "Complete");

  // Upcoming (next 14 days)
  const upcoming = wsTasks
    .filter((t) => t.dueDate > TODAY_ISO && t.dueDate <= "2026-05-25" && t.status !== "Complete")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // External task dependencies (tasks from other workstreams that this workstream depends on)
  const allMyDeps = wsTasks.flatMap((t) => t.dependsOn ?? []);
  const externalDeps = allMyDeps
    .map((depId) => tasks.find((t) => t.id === depId))
    .filter((t): t is Task => !!t && t.workstream !== ws);
  const uniqueExternal = Array.from(new Map(externalDeps.map((t) => [t.id, t])).values());

  // Risks related by owner (workstream-specific owners)
  const wsOwners = new Set(wsTasks.map((t) => t.owner));
  const wsRisks = risks.filter((r) => wsOwners.has(r.owner) && r.status === "open");

  return {
    wsTasks, total, complete, inProgress, blocked, notStarted,
    avgProgress, linkedMilestones, overdue, upcoming,
    uniqueExternal, wsRisks,
  };
}

// ─── Excel export ─────────────────────────────────────────────────────────────

function exportWorkstreamExcel(ws: string, data: ReturnType<typeof buildWorkstreamData>) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Summary
  const summaryRows = [
    ["AivelloStudio RIM — Workstream Report"],
    ["Project",     project.name],
    ["Workstream",  ws],
    ["Report Date", fmtDate(TODAY_ISO)],
    [],
    ["Metric",         "Value"],
    ["Total Tasks",    data.total],
    ["Complete",       data.complete],
    ["In Progress",    data.inProgress],
    ["Blocked",        data.blocked],
    ["Not Started",    data.notStarted],
    ["Avg Progress",   `${data.avgProgress}%`],
    ["Overdue Tasks",  data.overdue.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  // Sheet 2 — All Tasks
  const taskHeaders = ["ID", "Task", "Priority", "Owner", "Due Date", "Status", "Progress %", "Depends On"];
  const taskRows = data.wsTasks.map((t) => [
    t.id, t.name, t.priority, t.owner, fmtDate(t.dueDate), t.status, t.progress,
    (t.dependsOn ?? []).join(", "),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]), "Tasks");

  // Sheet 3 — Linked Milestones
  const msHeaders = ["ID", "Milestone", "Phase", "Status", "Planned", "Forecast"];
  const msRows = data.linkedMilestones.map((m) => [
    m.id, m.name, m.phase, m.status, fmtDate(m.plannedDate), fmtDate(m.forecastDate),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([msHeaders, ...msRows]), "Linked Milestones");

  // Sheet 4 — External Dependencies
  if (data.uniqueExternal.length > 0) {
    const depHeaders = ["Task ID", "Task", "Workstream", "Status", "Due", "Progress %"];
    const depRows = data.uniqueExternal.map((t) => [
      t.id, t.name, t.workstream, t.status, fmtDate(t.dueDate), t.progress,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([depHeaders, ...depRows]), "External Dependencies");
  }

  XLSX.writeFile(wb, `AivelloRIM_${ws.replace(/ /g, "_")}_Report_${TODAY.toISOString().slice(0, 10)}.xlsx`);
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

// ─── Task table ───────────────────────────────────────────────────────────────

function TaskTable({ tasks: tList, allTasks }: { tasks: Task[]; allTasks: Task[] }) {
  const taskMap = Object.fromEntries(allTasks.map((t) => [t.id, t]));

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-1.5 w-6" />
            <th className="px-3 py-1.5 text-left">Task</th>
            <th className="px-3 py-1.5 text-center w-20">Priority</th>
            <th className="px-3 py-1.5 text-center w-12">Owner</th>
            <th className="px-3 py-1.5 text-left w-20">Due</th>
            <th className="px-3 py-1.5 text-left w-28">Progress</th>
            <th className="px-3 py-1.5 text-center w-24">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tList.map((t) => {
            const isOverdue = t.dueDate < TODAY_ISO && t.status !== "Complete";
            return (
              <tr key={t.id} className={cn(t.status === "Blocked" ? "bg-rose-50/40" : "")}>
                <td className="px-3 py-2 text-center">
                  <span className={cn("block h-2 w-2 rounded-full mx-auto", priorityDot[t.priority])} />
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground leading-tight">{t.name}</p>
                  {(t.dependsOn ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(t.dependsOn ?? []).map((depId) => {
                        const dep = taskMap[depId];
                        const done = dep?.status === "Complete";
                        return (
                          <span key={depId} className={cn(
                            "text-[9px] rounded px-1 py-0.5 font-medium",
                            done ? "bg-green-50 text-green-600" : dep?.workstream !== t.workstream ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"
                          )}>
                            → {depId.toUpperCase()}{dep?.workstream !== t.workstream ? " (ext)" : ""}{done ? " ✓" : ""}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", priorityPill[t.priority])}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{t.owner}</td>
                <td className={cn("px-3 py-2 text-[10px]", isOverdue ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
                  {fmtDate(t.dueDate)}{isOverdue ? " !" : ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full",
                          t.status === "Complete" ? "bg-green-500" :
                          t.status === "Blocked"  ? "bg-rose-500" : "bg-primary"
                        )}
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{t.progress}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold whitespace-nowrap", statusStyles[t.status])}>
                    {t.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkstreamReport() {
  const [selectedWs, setSelectedWs] = useState<string>(ALL_WORKSTREAMS[0]);
  const data = buildWorkstreamData(selectedWs);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {/* Workstream selector */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 shadow-sm">
          <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <select
            value={selectedWs}
            onChange={(e) => setSelectedWs(e.target.value)}
            className="bg-transparent text-xs font-semibold text-foreground focus:outline-none"
          >
            {ALL_WORKSTREAMS.map((ws) => <option key={ws} value={ws}>{ws}</option>)}
          </select>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
        <button
          onClick={() => exportWorkstreamExcel(selectedWs, data)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export Excel
        </button>
        <span className="text-[10px] text-muted-foreground">
          Exports tasks + milestones + dependencies for this workstream only
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
              <span className="text-[10px] text-muted-foreground">Workstream Report</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{selectedWs}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{project.name} · {project.phase}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground">{fmtDate(TODAY_ISO)}</p>
            <p>{data.complete}/{data.total} tasks complete</p>
            <p>{data.avgProgress}% average progress</p>
          </div>
        </div>

        {/* Summary KPI strip */}
        <Section title="Workstream Health">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Total Tasks",  value: data.total,      color: "text-foreground" },
              { label: "Complete",     value: data.complete,   color: "text-green-600" },
              { label: "In Progress",  value: data.inProgress, color: "text-blue-600" },
              { label: "Blocked",      value: data.blocked,    color: data.blocked > 0 ? "text-rose-600" : "text-foreground" },
              { label: "Overdue",      value: data.overdue.length, color: data.overdue.length > 0 ? "text-rose-600" : "text-foreground" },
            ].map((k) => (
              <div key={k.label} className="rounded-md border border-border bg-muted/20 px-3 py-2.5 text-center">
                <p className={cn("text-2xl font-bold tabular-nums", k.color)}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Overall progress bar */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-[10px] text-muted-foreground w-28 shrink-0">Overall progress</span>
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  data.avgProgress === 100 ? "bg-green-500" :
                  data.blocked > 0 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${data.avgProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-foreground w-10 text-right">{data.avgProgress}%</span>
          </div>
        </Section>

        {/* Linked milestones */}
        {data.linkedMilestones.length > 0 && (
          <Section title="Linked Milestones">
            <div className="rounded-md border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 text-left">Milestone</th>
                    <th className="px-3 py-1.5 text-left w-24">Phase</th>
                    <th className="px-3 py-1.5 text-center w-20">Planned</th>
                    <th className="px-3 py-1.5 text-center w-20">Forecast</th>
                    <th className="px-3 py-1.5 text-center w-20">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.linkedMilestones.map((m) => {
                    const var_ = Math.ceil((new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000);
                    return (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-medium text-foreground">{m.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.phase}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{fmtDate(m.plannedDate)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("font-medium", var_ > 0 ? "text-amber-600" : "text-foreground")}>
                            {fmtDate(m.forecastDate)}{var_ > 0 ? ` (+${var_}d)` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                            m.status === "complete"    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            m.status === "in-progress" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                            m.status === "at-risk"     ? "bg-rose-50 text-rose-700 border border-rose-200" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* External dependencies */}
        {data.uniqueExternal.length > 0 && (
          <Section title="External Dependencies (from other workstreams)">
            <div className="space-y-1.5">
              {data.uniqueExternal.map((t) => (
                <div key={t.id} className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2",
                  t.status === "Blocked"  ? "border-rose-200 bg-rose-50" :
                  t.status === "Complete" ? "border-green-200 bg-green-50" :
                  "border-amber-200 bg-amber-50"
                )}>
                  <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0",
                    t.status === "Blocked"  ? "text-rose-500" :
                    t.status === "Complete" ? "text-green-500" : "text-amber-500"
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground leading-tight">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.workstream} · {t.owner} · Due {fmtDate(t.dueDate)}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold whitespace-nowrap shrink-0", statusStyles[t.status])}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* All tasks */}
        <Section title={`All Tasks — ${selectedWs} (${data.total})`}>
          <TaskTable tasks={data.wsTasks.sort((a, b) => {
            const order = { "Blocked": 0, "In Progress": 1, "Not Started": 2, "On Hold": 3, "Complete": 4 };
            return (order[a.status] ?? 5) - (order[b.status] ?? 5);
          })} allTasks={tasks} />
        </Section>

        {/* Risks */}
        {data.wsRisks.length > 0 && (
          <Section title="Open Risks in this Workstream">
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
                  {data.wsRisks.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-center">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                          r.score >= 15 ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          r.score >= 8  ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        )}>
                          {r.score}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground">{r.category} · P{r.probability}×I{r.impact}</p>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground leading-snug">{r.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>AivelloStudio RIM · {selectedWs} Workstream Report · {fmtDate(TODAY_ISO)}</span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Confidential — internal use only
          </span>
        </div>
      </div>
    </div>
  );
}
