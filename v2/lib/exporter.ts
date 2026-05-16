// M19 — Clean project export workbook.
//
// Pure function: hand in a project + its entities + settings, get a downloaded
// .xlsx. Uses xlsx-js-style (styled fork of xlsx) loaded via dynamic import so
// it stays out of the initial bundle.
//
// 8 sheets: Summary · Gantt · Milestones · Tasks · Documents · Risks · Costs ·
// Resources & Meetings.

import type {
  Project, Milestone, Task, Risk, Document, CostLine,
  TeamMember, RecurringMeeting, Absence,
} from "./mockData";
import type { AppSettings } from "./settingsStore";
import { addWorkingDays } from "./domain/dates";
import { computeRAG, computeCriticalPath, type ScheduleMilestone } from "./domain/scheduling";

// ─── Type shorthands for xlsx-js-style cell/style objects ────────────────────

interface CellStyle {
  font?:      { name?: string; sz?: number; bold?: boolean; italic?: boolean; color?: { rgb: string } };
  fill?:      { fgColor?: { rgb: string }; bgColor?: { rgb: string }; patternType?: string };
  alignment?: { horizontal?: "left" | "center" | "right"; vertical?: "top" | "middle" | "bottom"; wrapText?: boolean };
  border?:    {
    top?:    { style: string; color?: { rgb: string } };
    bottom?: { style: string; color?: { rgb: string } };
    left?:   { style: string; color?: { rgb: string } };
    right?:  { style: string; color?: { rgb: string } };
  };
  numFmt?: string;
}

interface Cell {
  v: string | number | boolean | null;   // value
  t?: "s" | "n" | "b" | "d";              // type
  s?: CellStyle;                          // style (xlsx-js-style extension)
}

// reason: xlsx-js-style lacks rigorous types — its Worksheet is a dynamic record.
type Worksheet = Record<string, unknown>;

// ─── Style presets ───────────────────────────────────────────────────────────

const COLORS = {
  primary: "1E3A8A",       // deep indigo (header)
  primaryFg: "FFFFFF",
  bandHeader: "F1F5F9",    // slate-50
  bandHeaderFg: "475569",  // slate-600
  zebraEven: "FAFAFA",
  border: "E2E8F0",
  cpFill: "FECDD3",        // rose-200
  cpFg: "9F1239",          // rose-700
  inProgress: "DBEAFE",    // blue-100
  atRisk: "FEF3C7",        // amber-100
  complete: "D1FAE5",      // emerald-100
  pending: "F1F5F9",       // slate-100
  todayFill: "FEF9C3",     // yellow-100 (today column highlight)
} as const;

const headerStyle: CellStyle = {
  font: { bold: true, color: { rgb: COLORS.primaryFg }, sz: 11 },
  fill: { fgColor: { rgb: COLORS.primary }, patternType: "solid" },
  alignment: { horizontal: "left", vertical: "middle" },
  border: { bottom: { style: "thin", color: { rgb: COLORS.border } } },
};

const sectionStyle: CellStyle = {
  font: { bold: true, color: { rgb: COLORS.bandHeaderFg }, sz: 10 },
  fill: { fgColor: { rgb: COLORS.bandHeader }, patternType: "solid" },
  alignment: { horizontal: "left", vertical: "middle" },
};

const titleStyle: CellStyle = {
  font: { bold: true, sz: 16 },
  alignment: { horizontal: "left", vertical: "middle" },
};

const labelStyle: CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: COLORS.bandHeaderFg } },
};

const cellStyleBase: CellStyle = {
  font: { sz: 10 },
  alignment: { horizontal: "left", vertical: "middle", wrapText: true },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function isoToDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function isoMonday(iso: string): string {
  const d = isoToDate(iso);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = (day + 6) % 7; // back to Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function nextMonday(iso: string): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function monthShort(iso: string): string {
  return isoToDate(iso).toLocaleString("en", { month: "short", year: "2-digit" });
}

function deriveStart(m: Milestone): string {
  const dur = m.duration ?? 1;
  return addWorkingDays(m.plannedDate, -(dur - 1)) ?? m.plannedDate;
}

function rowsToSheet(XLSX: typeof import("xlsx-js-style"), rows: (Cell | null)[][]): Worksheet {
  // Build the worksheet object directly to preserve styles on every cell.
  const ws: Worksheet = {};
  const range = { s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 0 } };
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === null) return;
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = cell;
      if (c > range.e.c) range.e.c = c;
    });
  });
  ws["!ref"] = XLSX.utils.encode_range(range);
  return ws;
}

function setColWidths(ws: Worksheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function setRowHeights(ws: Worksheet, heights: number[]) {
  ws["!rows"] = heights.map((hpt) => ({ hpt }));
}

function mergeRange(ws: Worksheet, s: { r: number; c: number }, e: { r: number; c: number }) {
  ws["!merges"] = ws["!merges"] ?? [];
  (ws["!merges"] as { s: { r: number; c: number }; e: { r: number; c: number } }[]).push({ s, e });
}

// ─── Sheet builders ──────────────────────────────────────────────────────────

function buildSummary(
  XLSX: typeof import("xlsx-js-style"),
  project: Project,
  milestones: Milestone[],
  tasks: Task[],
  risks: Risk[],
  documents: Document[],
  costLines: CostLine[],
): Worksheet {
  const totalBudgetK = costLines.reduce((s, c) => s + c.budgetK, 0);
  const totalActualK = costLines.reduce((s, c) => s + c.actualK, 0);
  const burnPct = totalBudgetK > 0 ? Math.round((totalActualK / totalBudgetK) * 100) : 0;
  const openRisks = risks.filter((r) => r.status === "open");
  const escalated = openRisks.filter((r) => r.score >= 12);
  const atRiskMs = milestones.filter((m) => m.status === "at-risk").length;
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress").length;
  const pendingDocs = documents.filter((d) => d.status === "in-review").length;

  // Worst RAG colour across schedule + budget + risk
  const scheduleRag = atRiskMs >= 2 ? "Red" : atRiskMs >= 1 ? "Amber" : "Green";
  const budgetRag   = burnPct >= 85 ? "Red" : burnPct >= 60 ? "Amber" : "Green";
  const riskRag     = escalated.length >= 2 ? "Red" : escalated.length >= 1 ? "Amber" : "Green";

  const ragFill: Record<string, string> = { Green: COLORS.complete, Amber: COLORS.atRisk, Red: COLORS.cpFill };
  const ragFg:   Record<string, string> = { Green: "065F46", Amber: "92400E", Red: COLORS.cpFg };

  const rows: (Cell | null)[][] = [
    [{ v: project.name, t: "s", s: titleStyle }, null, null, null],
    [{ v: `${project.client} · ${project.phase}`, t: "s", s: { font: { sz: 11, color: { rgb: COLORS.bandHeaderFg } } } }, null, null, null],
    [],
    [{ v: "PROJECT METADATA", t: "s", s: sectionStyle }, null, null, null],
    [{ v: "Start date",      t: "s", s: labelStyle }, { v: project.startDate,   t: "s", s: cellStyleBase }, null, null],
    [{ v: "Go-live target",  t: "s", s: labelStyle }, { v: project.goLiveDate,  t: "s", s: cellStyleBase }, null, null],
    [{ v: "Methodology",     t: "s", s: labelStyle }, { v: project.methodology, t: "s", s: cellStyleBase }, null, null],
    [{ v: "Generated",       t: "s", s: labelStyle }, { v: todayIso(),          t: "s", s: cellStyleBase }, null, null],
    [],
    [{ v: "RAG SNAPSHOT", t: "s", s: sectionStyle }, null, null, null],
    [{ v: "Area",     t: "s", s: labelStyle }, { v: "Status", t: "s", s: labelStyle }, { v: "Detail", t: "s", s: labelStyle }, null],
    [
      { v: "Schedule", t: "s", s: cellStyleBase },
      { v: scheduleRag, t: "s", s: { ...cellStyleBase, font: { bold: true, color: { rgb: ragFg[scheduleRag] } }, fill: { fgColor: { rgb: ragFill[scheduleRag] }, patternType: "solid" } } },
      { v: `${atRiskMs} milestone(s) at risk`, t: "s", s: cellStyleBase },
      null,
    ],
    [
      { v: "Budget", t: "s", s: cellStyleBase },
      { v: budgetRag, t: "s", s: { ...cellStyleBase, font: { bold: true, color: { rgb: ragFg[budgetRag] } }, fill: { fgColor: { rgb: ragFill[budgetRag] }, patternType: "solid" } } },
      { v: `${burnPct}% of $${(totalBudgetK / 1000).toFixed(2)}M utilised`, t: "s", s: cellStyleBase },
      null,
    ],
    [
      { v: "Risk", t: "s", s: cellStyleBase },
      { v: riskRag, t: "s", s: { ...cellStyleBase, font: { bold: true, color: { rgb: ragFg[riskRag] } }, fill: { fgColor: { rgb: ragFill[riskRag] }, patternType: "solid" } } },
      { v: `${escalated.length} escalated · ${openRisks.length} open`, t: "s", s: cellStyleBase },
      null,
    ],
    [],
    [{ v: "KPIS", t: "s", s: sectionStyle }, null, null, null],
    [{ v: "Milestones",       t: "s", s: labelStyle }, { v: milestones.length,                                  t: "n", s: cellStyleBase }, { v: `${milestones.filter((m) => m.status === "complete").length} complete`, t: "s", s: cellStyleBase }, null],
    [{ v: "Tasks",            t: "s", s: labelStyle }, { v: tasks.length,                                        t: "n", s: cellStyleBase }, { v: `${inProgressTasks} in progress`,                                       t: "s", s: cellStyleBase }, null],
    [{ v: "Risks",            t: "s", s: labelStyle }, { v: risks.length,                                        t: "n", s: cellStyleBase }, { v: `${openRisks.length} open · ${escalated.length} escalated`,            t: "s", s: cellStyleBase }, null],
    [{ v: "Documents",        t: "s", s: labelStyle }, { v: documents.length,                                    t: "n", s: cellStyleBase }, { v: `${pendingDocs} in review`,                                             t: "s", s: cellStyleBase }, null],
    [{ v: "Budget ($k)",      t: "s", s: labelStyle }, { v: totalBudgetK,                                        t: "n", s: cellStyleBase }, { v: `$${totalActualK}k spent (${burnPct}%)`,                                t: "s", s: cellStyleBase }, null],
  ];

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [24, 18, 60, 4]);
  mergeRange(ws, { r: 0, c: 0 }, { r: 0, c: 3 });
  mergeRange(ws, { r: 1, c: 0 }, { r: 1, c: 3 });
  setRowHeights(ws, [24, 18]);
  return ws;
}

function buildMilestones(
  XLSX: typeof import("xlsx-js-style"),
  milestones: Milestone[],
  settings: AppSettings,
): Worksheet {
  const sorted = milestones.slice().sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));

  const domainMs: ScheduleMilestone[] = milestones.map((m) => ({
    id: parseInt(m.id.replace(/^m/, ""), 10),
    name: m.name,
    predecessor: m.predecessor ? parseInt(m.predecessor.replace(/^m/, ""), 10) : undefined,
    duration: m.duration,
    lag: m.lag,
    plannedStart: deriveStart(m),
    plannedEnd: m.plannedDate,
    status: m.status,
  }));

  const cp = computeCriticalPath(domainMs, settings.workingDays, settings.holidays);

  const headers = ["ID", "Name", "Phase", "Planned", "Forecast", "Variance (d)", "Duration (d)", "Predecessor", "RAG", "Critical Path", "Status", "Owner", "Locked"];
  const rows: (Cell | null)[][] = [
    headers.map((h) => ({ v: h, t: "s" as const, s: headerStyle })),
  ];

  sorted.forEach((m, i) => {
    const variance = daysBetween(m.plannedDate, m.forecastDate);
    const numId = parseInt(m.id.replace(/^m/, ""), 10);
    const isCP = cp.criticalIds.has(numId);
    const dm = domainMs.find((d) => d.id === numId)!;
    const rag = computeRAG(dm, todayIso(), settings.ragThresholds);

    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = {
      ...cellStyleBase,
      ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}),
    };

    rows.push([
      { v: m.id.toUpperCase(), t: "s", s: baseStyle },
      { v: m.name,             t: "s", s: baseStyle },
      { v: m.phase,            t: "s", s: baseStyle },
      { v: m.plannedDate,      t: "s", s: baseStyle },
      { v: m.forecastDate,     t: "s", s: baseStyle },
      { v: variance,           t: "n", s: { ...baseStyle, font: { ...baseStyle.font, color: { rgb: variance > 0 ? COLORS.cpFg : (variance < 0 ? "065F46" : "475569") } } } },
      { v: m.duration ?? 1,    t: "n", s: baseStyle },
      { v: m.predecessor?.toUpperCase() ?? "",      t: "s", s: baseStyle },
      { v: rag,                t: "s", s: { ...baseStyle, font: { bold: true, color: { rgb: rag === "Red" ? COLORS.cpFg : rag === "Amber" ? "92400E" : "065F46" } } } },
      { v: isCP ? "Yes" : "",  t: "s", s: { ...baseStyle, font: { bold: isCP, color: { rgb: isCP ? COLORS.cpFg : "475569" } }, fill: isCP ? { fgColor: { rgb: COLORS.cpFill }, patternType: "solid" } : baseStyle.fill } },
      { v: m.status,           t: "s", s: baseStyle },
      { v: m.owner,            t: "s", s: baseStyle },
      { v: m.locked ? "Yes" : "", t: "s", s: baseStyle },
    ]);
  });

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [8, 40, 14, 12, 12, 13, 13, 14, 8, 14, 14, 8, 8]);
  ws["!freeze"] = { xSplit: 2, ySplit: 1 };
  return ws;
}

function buildTasks(
  XLSX: typeof import("xlsx-js-style"),
  tasks: Task[],
  milestones: Milestone[],
): Worksheet {
  const headers = ["ID", "Name", "Priority", "Status", "Progress %", "Owner", "Due", "Milestone", "Depends On"];
  const rows: (Cell | null)[][] = [
    headers.map((h) => ({ v: h, t: "s" as const, s: headerStyle })),
  ];

  // Group by workstream — visible section header rows between groups
  const workstreams = Array.from(new Set(tasks.map((t) => t.workstream)));
  const msById: Record<string, Milestone> = {};
  milestones.forEach((m) => { msById[m.id] = m; });

  workstreams.forEach((ws) => {
    const groupTasks = tasks
      .filter((t) => t.workstream === ws)
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (groupTasks.length === 0) return;

    // Section header (merged across all 9 columns)
    rows.push([
      { v: `${ws} · ${groupTasks.length} task${groupTasks.length === 1 ? "" : "s"}`, t: "s", s: sectionStyle },
      ...Array(8).fill({ v: "", t: "s" as const, s: sectionStyle }),
    ]);

    groupTasks.forEach((t, i) => {
      const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
      const baseStyle: CellStyle = {
        ...cellStyleBase,
        ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}),
      };

      const statusFill = t.status === "Complete"    ? COLORS.complete
                       : t.status === "In Progress" ? COLORS.inProgress
                       : t.status === "Blocked"     ? COLORS.cpFill
                       : t.status === "On Hold"     ? COLORS.atRisk
                       : COLORS.pending;
      const linkedMs = t.milestoneId ? msById[t.milestoneId] : undefined;

      rows.push([
        { v: t.id.toUpperCase(),                              t: "s", s: baseStyle },
        { v: t.name,                                           t: "s", s: baseStyle },
        { v: t.priority,                                       t: "s", s: baseStyle },
        { v: t.status,                                         t: "s", s: { ...baseStyle, fill: { fgColor: { rgb: statusFill }, patternType: "solid" } } },
        { v: t.progress,                                       t: "n", s: { ...baseStyle, numFmt: "0\"%\"" } },
        { v: t.owner,                                          t: "s", s: baseStyle },
        { v: t.dueDate,                                        t: "s", s: baseStyle },
        { v: linkedMs ? `${linkedMs.id.toUpperCase()} · ${linkedMs.name}` : "", t: "s", s: baseStyle },
        { v: (t.dependsOn ?? []).map((id) => id.toUpperCase()).join(", "),       t: "s", s: baseStyle },
      ]);
    });
  });

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [8, 48, 10, 13, 11, 8, 12, 36, 18]);
  ws["!freeze"] = { xSplit: 2, ySplit: 1 };
  return ws;
}

function buildDocuments(
  XLSX: typeof import("xlsx-js-style"),
  documents: Document[],
): Worksheet {
  function fmtDecisions(decs: Document["reviewers"]): string {
    return decs.map((d) => `${d.person} (${d.role}, ${d.status}${d.date ? `, ${d.date}` : ""})`).join("\n");
  }

  const headers = ["ID", "Abbreviation", "Name", "Type", "Phase", "Version", "Status", "Due", "Owner (R)", "Reviewers (C)", "Approvers (A)", "Pending"];
  const rows: (Cell | null)[][] = [
    headers.map((h) => ({ v: h, t: "s" as const, s: headerStyle })),
  ];

  // Group by phase with section header rows
  const phases = ["Planning", "Configuration", "Validation", "Training", "Go-Live"] as const;
  phases.forEach((phase) => {
    const phaseDocs = documents
      .filter((d) => d.phase === phase)
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (phaseDocs.length === 0) return;

    rows.push([
      { v: `${phase} Phase · ${phaseDocs.length} doc${phaseDocs.length === 1 ? "" : "s"}`, t: "s", s: sectionStyle },
      ...Array(11).fill({ v: "", t: "s" as const, s: sectionStyle }),
    ]);

    phaseDocs.forEach((d, i) => {
      const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
      const baseStyle: CellStyle = {
        ...cellStyleBase,
        ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}),
      };

      const pendingCount = [...d.reviewers, ...d.approvers].filter((x) => x.status === "pending").length;
      const statusFill = d.status === "approved" ? COLORS.complete
                       : d.status === "in-review" ? COLORS.atRisk
                       : d.status === "rejected" ? COLORS.cpFill
                       : COLORS.pending;

      rows.push([
        { v: d.id.toUpperCase(),                  t: "s", s: baseStyle },
        { v: d.abbreviation ?? "",                t: "s", s: { ...baseStyle, font: { ...baseStyle.font, bold: true } } },
        { v: d.name,                              t: "s", s: baseStyle },
        { v: d.type,                              t: "s", s: baseStyle },
        { v: d.phase,                             t: "s", s: baseStyle },
        { v: d.version,                           t: "s", s: baseStyle },
        { v: d.status,                            t: "s", s: { ...baseStyle, fill: { fgColor: { rgb: statusFill }, patternType: "solid" } } },
        { v: d.dueDate,                           t: "s", s: baseStyle },
        { v: d.owner,                             t: "s", s: { ...baseStyle, font: { ...baseStyle.font, bold: true } } },
        { v: fmtDecisions(d.reviewers) || "—",   t: "s", s: { ...baseStyle, alignment: { ...baseStyle.alignment, wrapText: true, vertical: "top" } } },
        { v: fmtDecisions(d.approvers) || "—",   t: "s", s: { ...baseStyle, alignment: { ...baseStyle.alignment, wrapText: true, vertical: "top" } } },
        { v: pendingCount,                        t: "n", s: { ...baseStyle, font: { bold: pendingCount > 0, color: { rgb: pendingCount > 0 ? COLORS.cpFg : "475569" } } } },
      ]);
    });
  });

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [8, 14, 36, 14, 14, 9, 12, 12, 11, 50, 50, 10]);
  ws["!freeze"] = { xSplit: 3, ySplit: 1 };
  return ws;
}

function buildRisks(XLSX: typeof import("xlsx-js-style"), risks: Risk[]): Worksheet {
  const headers = ["ID", "Title", "Category", "Probability", "Impact", "Score", "Band", "Status", "Owner", "Mitigation"];
  const rows: (Cell | null)[][] = [
    headers.map((h) => ({ v: h, t: "s" as const, s: headerStyle })),
  ];

  const sorted = risks.slice().sort((a, b) => b.score - a.score);
  sorted.forEach((r, i) => {
    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = {
      ...cellStyleBase,
      ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}),
    };

    const band = r.score >= 15 ? "High" : r.score >= 8 ? "Medium" : "Low";
    const bandFill = band === "High" ? COLORS.cpFill : band === "Medium" ? COLORS.atRisk : COLORS.complete;
    const bandFg   = band === "High" ? COLORS.cpFg  : band === "Medium" ? "92400E"        : "065F46";

    rows.push([
      { v: r.id.toUpperCase(),   t: "s", s: baseStyle },
      { v: r.title,              t: "s", s: baseStyle },
      { v: r.category,           t: "s", s: baseStyle },
      { v: r.probability,        t: "n", s: { ...baseStyle, alignment: { ...baseStyle.alignment, horizontal: "center" } } },
      { v: r.impact,             t: "n", s: { ...baseStyle, alignment: { ...baseStyle.alignment, horizontal: "center" } } },
      { v: r.score,              t: "n", s: { ...baseStyle, font: { bold: true, color: { rgb: bandFg } }, alignment: { ...baseStyle.alignment, horizontal: "center" } } },
      { v: band,                 t: "s", s: { ...baseStyle, font: { bold: true, color: { rgb: bandFg } }, fill: { fgColor: { rgb: bandFill }, patternType: "solid" } } },
      { v: r.status,             t: "s", s: baseStyle },
      { v: r.owner,              t: "s", s: baseStyle },
      { v: r.mitigation,         t: "s", s: { ...baseStyle, alignment: { ...baseStyle.alignment, wrapText: true, vertical: "top" } } },
    ]);
  });

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [8, 46, 14, 11, 8, 8, 9, 11, 8, 50]);
  ws["!freeze"] = { xSplit: 2, ySplit: 1 };
  return ws;
}

function buildCosts(XLSX: typeof import("xlsx-js-style"), costLines: CostLine[]): Worksheet {
  const headers = ["ID", "Category", "Description", "Contract", "Budget ($k)", "Actual ($k)", "Burn %", "Owner"];
  const rows: (Cell | null)[][] = [
    headers.map((h) => ({ v: h, t: "s" as const, s: headerStyle })),
  ];

  let totalBudget = 0;
  let totalActual = 0;

  costLines.forEach((c, i) => {
    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = {
      ...cellStyleBase,
      ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}),
    };
    const burnPct = c.budgetK > 0 ? Math.round((c.actualK / c.budgetK) * 100) : 0;
    const burnFg = burnPct >= 85 ? COLORS.cpFg : burnPct >= 60 ? "92400E" : "065F46";

    totalBudget += c.budgetK;
    totalActual += c.actualK;

    rows.push([
      { v: c.id.toUpperCase(), t: "s", s: baseStyle },
      { v: c.category,         t: "s", s: baseStyle },
      { v: c.description,      t: "s", s: baseStyle },
      { v: c.contractType,     t: "s", s: baseStyle },
      { v: c.budgetK,          t: "n", s: { ...baseStyle, numFmt: "$#,##0\"k\"", alignment: { ...baseStyle.alignment, horizontal: "right" } } },
      { v: c.actualK,          t: "n", s: { ...baseStyle, numFmt: "$#,##0\"k\"", alignment: { ...baseStyle.alignment, horizontal: "right" } } },
      { v: burnPct,            t: "n", s: { ...baseStyle, font: { bold: true, color: { rgb: burnFg } }, numFmt: "0\"%\"", alignment: { ...baseStyle.alignment, horizontal: "right" } } },
      { v: c.owner,            t: "s", s: baseStyle },
    ]);
  });

  // Totals row
  const totalsStyle: CellStyle = {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: COLORS.bandHeader }, patternType: "solid" },
    alignment: { horizontal: "right" as const, vertical: "middle" as const },
    border: { top: { style: "thin", color: { rgb: COLORS.border } } },
  };
  rows.push([
    { v: "TOTAL", t: "s", s: { ...totalsStyle, alignment: { ...totalsStyle.alignment, horizontal: "left" } } },
    { v: "", t: "s", s: totalsStyle }, { v: "", t: "s", s: totalsStyle }, { v: "", t: "s", s: totalsStyle },
    { v: totalBudget, t: "n", s: { ...totalsStyle, numFmt: "$#,##0\"k\"" } },
    { v: totalActual, t: "n", s: { ...totalsStyle, numFmt: "$#,##0\"k\"" } },
    { v: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0, t: "n", s: { ...totalsStyle, numFmt: "0\"%\"" } },
    { v: "", t: "s", s: totalsStyle },
  ]);

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [8, 16, 50, 11, 13, 13, 10, 8]);
  ws["!freeze"] = { xSplit: 2, ySplit: 1 };
  return ws;
}

function buildResources(
  XLSX: typeof import("xlsx-js-style"),
  teamMembers: TeamMember[],
  meetings: RecurringMeeting[],
  absences: Absence[],
): Worksheet {
  const rows: (Cell | null)[][] = [];

  // ── Block 1: Team members ───────────────────────────────────────
  rows.push([{ v: "TEAM MEMBERS", t: "s", s: sectionStyle }, null, null, null, null]);
  rows.push(["Initials", "Name", "Role", "Workstream", "SteerCo"].map((h) => ({ v: h, t: "s" as const, s: headerStyle })));
  teamMembers.forEach((m, i) => {
    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = { ...cellStyleBase, ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}) };
    rows.push([
      { v: m.initials,                 t: "s", s: { ...baseStyle, font: { ...baseStyle.font, bold: true } } },
      { v: m.name,                     t: "s", s: baseStyle },
      { v: m.role,                     t: "s", s: baseStyle },
      { v: m.workstream,               t: "s", s: baseStyle },
      { v: m.steercoRole ?? "",        t: "s", s: baseStyle },
    ]);
  });

  rows.push([], []);

  // ── Block 2: Recurring meetings ─────────────────────────────────
  rows.push([{ v: "RECURRING MEETINGS", t: "s", s: sectionStyle }, null, null, null, null, null, null]);
  rows.push(["Name", "Type", "Workstream", "Frequency", "Day", "Duration (min)", "Next Date", "Attendees (Mandatory / Optional)"].map((h) => ({ v: h, t: "s" as const, s: headerStyle })));

  const memberInitials: Record<string, string> = {};
  teamMembers.forEach((m) => { memberInitials[m.id] = m.initials; });

  meetings.forEach((mtg, i) => {
    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = { ...cellStyleBase, ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}) };
    const mandatory = mtg.attendees.filter((a) => a.role === "mandatory").map((a) => memberInitials[a.memberId] ?? a.memberId).join(", ");
    const optional  = mtg.attendees.filter((a) => a.role === "optional").map((a) => memberInitials[a.memberId] ?? a.memberId).join(", ");
    rows.push([
      { v: mtg.name,            t: "s", s: baseStyle },
      { v: mtg.type,            t: "s", s: baseStyle },
      { v: mtg.workstream ?? "", t: "s", s: baseStyle },
      { v: mtg.frequency,       t: "s", s: baseStyle },
      { v: mtg.dayOfWeek,       t: "s", s: baseStyle },
      { v: mtg.durationMins,    t: "n", s: { ...baseStyle, alignment: { ...baseStyle.alignment, horizontal: "right" } } },
      { v: mtg.nextDate,        t: "s", s: baseStyle },
      { v: `M: ${mandatory || "—"} | O: ${optional || "—"}`, t: "s", s: baseStyle },
    ]);
  });

  rows.push([], []);

  // ── Block 3: Absences ───────────────────────────────────────────
  rows.push([{ v: "ABSENCES", t: "s", s: sectionStyle }, null, null, null, null]);
  rows.push(["Member", "Start", "End", "Reason", "Note"].map((h) => ({ v: h, t: "s" as const, s: headerStyle })));

  const memberById: Record<string, TeamMember> = {};
  teamMembers.forEach((m) => { memberById[m.id] = m; });

  absences.forEach((ab, i) => {
    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = { ...cellStyleBase, ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}) };
    const member = memberById[ab.memberId];
    rows.push([
      { v: member ? `${member.initials} · ${member.name}` : ab.memberId, t: "s", s: baseStyle },
      { v: ab.startDate, t: "s", s: baseStyle },
      { v: ab.endDate,   t: "s", s: baseStyle },
      { v: ab.reason,    t: "s", s: baseStyle },
      { v: ab.note ?? "", t: "s", s: baseStyle },
    ]);
  });

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [22, 22, 28, 14, 12, 14, 12, 50]);
  return ws;
}

function buildGantt(
  XLSX: typeof import("xlsx-js-style"),
  milestones: Milestone[],
  settings: AppSettings,
): Worksheet {
  if (milestones.length === 0) {
    return rowsToSheet(XLSX, [[{ v: "No milestones to plot.", t: "s", s: cellStyleBase }]]);
  }

  // Compute date range (Monday-aligned)
  const sorted = milestones.slice().sort((a, b) => deriveStart(a).localeCompare(deriveStart(b)));
  const starts = sorted.map(deriveStart);
  const ends   = sorted.map((m) => m.plannedDate);
  const minStart = isoMonday(starts.reduce((a, b) => (a < b ? a : b)));
  // Pad end out by one week
  let cursor = isoMonday(ends.reduce((a, b) => (a > b ? a : b)));
  cursor = nextMonday(cursor);

  // Build week columns
  const weeks: { iso: string; label: string; monthLabel: string }[] = [];
  let w = minStart;
  while (w <= cursor) {
    weeks.push({
      iso: w,
      label: isoToDate(w).getUTCDate().toString().padStart(2, "0"),
      monthLabel: monthShort(w),
    });
    w = nextMonday(w);
  }

  // CP computation
  const domainMs: ScheduleMilestone[] = milestones.map((m) => ({
    id: parseInt(m.id.replace(/^m/, ""), 10),
    name: m.name,
    predecessor: m.predecessor ? parseInt(m.predecessor.replace(/^m/, ""), 10) : undefined,
    duration: m.duration,
    lag: m.lag,
    plannedStart: deriveStart(m),
    plannedEnd: m.plannedDate,
    status: m.status,
  }));
  const cp = computeCriticalPath(domainMs, settings.workingDays, settings.holidays);

  const today = todayIso();

  // Row 1: month labels (merged across consecutive weeks in same month)
  // Row 2: week column labels (day-of-month of each Monday)
  // Row 3+: one row per milestone

  const fixedHeaders = ["ID", "Name", "Phase", "Owner"];
  const rows: (Cell | null)[][] = [];

  // Month row
  const monthRow: (Cell | null)[] = [
    ...fixedHeaders.map(() => ({ v: "", t: "s" as const, s: headerStyle })),
  ];
  weeks.forEach((wk) => {
    monthRow.push({ v: wk.monthLabel, t: "s", s: { ...headerStyle, alignment: { horizontal: "center", vertical: "middle" } } });
  });
  rows.push(monthRow);

  // Week label row
  const weekRow: (Cell | null)[] = [
    ...fixedHeaders.map((h) => ({ v: h, t: "s" as const, s: headerStyle })),
  ];
  weeks.forEach((wk) => {
    const isThisWeek = wk.iso === isoMonday(today);
    weekRow.push({
      v: wk.label,
      t: "s",
      s: {
        ...headerStyle,
        alignment: { horizontal: "center", vertical: "middle" },
        ...(isThisWeek ? { fill: { fgColor: { rgb: COLORS.todayFill }, patternType: "solid" } } : {}),
      },
    });
  });
  rows.push(weekRow);

  // Milestone rows
  sorted.forEach((m, i) => {
    const startIso = deriveStart(m);
    const endIso = m.plannedDate;
    const numId = parseInt(m.id.replace(/^m/, ""), 10);
    const isCP = cp.criticalIds.has(numId);

    const baseFill = i % 2 === 0 ? undefined : COLORS.zebraEven;
    const baseStyle: CellStyle = {
      ...cellStyleBase,
      ...(baseFill ? { fill: { fgColor: { rgb: baseFill }, patternType: "solid" } } : {}),
    };

    const fixedCells: (Cell | null)[] = [
      { v: m.id.toUpperCase(), t: "s", s: { ...baseStyle, font: { bold: true, sz: 10 } } },
      { v: m.name,             t: "s", s: baseStyle },
      { v: m.phase,            t: "s", s: baseStyle },
      { v: m.owner,            t: "s", s: { ...baseStyle, alignment: { horizontal: "center", vertical: "middle" } } },
    ];

    // Bar cells
    const barFill = isCP                    ? COLORS.cpFill
                   : m.status === "complete"    ? COLORS.complete
                   : m.status === "at-risk"     ? COLORS.atRisk
                   : m.status === "in-progress" ? COLORS.inProgress
                   : COLORS.pending;
    const barFg = isCP                          ? COLORS.cpFg
                 : m.status === "complete"      ? "065F46"
                 : m.status === "at-risk"       ? "92400E"
                 : m.status === "in-progress"   ? "1E40AF"
                 : "475569";

    const weekCells: Cell[] = weeks.map((wk) => {
      const wkEnd = nextMonday(wk.iso);
      // Bar covers this week if any day of [wk.iso, wkEnd) overlaps [startIso, endIso]
      const overlaps = startIso < wkEnd && endIso >= wk.iso;
      const isThisWeek = wk.iso === isoMonday(today);
      if (!overlaps) {
        return {
          v: "",
          t: "s",
          s: {
            ...baseStyle,
            ...(isThisWeek ? { fill: { fgColor: { rgb: COLORS.todayFill }, patternType: "solid" } } : {}),
          },
        };
      }
      return {
        v: "■",
        t: "s",
        s: {
          font: { bold: true, color: { rgb: barFg }, sz: 10 },
          fill: { fgColor: { rgb: barFill }, patternType: "solid" },
          alignment: { horizontal: "center", vertical: "middle" },
        },
      };
    });

    rows.push([...fixedCells, ...weekCells]);
  });

  const ws = rowsToSheet(XLSX, rows);
  setColWidths(ws, [8, 36, 14, 8, ...weeks.map(() => 4)]);
  ws["!freeze"] = { xSplit: 4, ySplit: 2 };

  // Merge month headers across consecutive same-month columns
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  let mergeStart = 4;
  for (let c = 5; c <= weeks.length + 4; c++) {
    const cur  = weeks[c - 4]?.monthLabel;
    const prev = weeks[c - 5]?.monthLabel;
    if (cur !== prev) {
      if (c - 1 > mergeStart) merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: c - 1 } });
      mergeStart = c;
    }
  }
  if (weeks.length + 3 > mergeStart) {
    merges.push({ s: { r: 0, c: mergeStart }, e: { r: 0, c: weeks.length + 3 } });
  }
  ws["!merges"] = merges;

  return ws;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function exportProjectWorkbook(args: {
  project:     Project;
  milestones:  Milestone[];
  tasks:       Task[];
  risks:       Risk[];
  documents:   Document[];
  costLines:   CostLine[];
  teamMembers: TeamMember[];
  meetings:    RecurringMeeting[];
  absences:    Absence[];
  settings:    AppSettings;
}): Promise<void> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummary    (XLSX, args.project, args.milestones, args.tasks, args.risks, args.documents, args.costLines),       "Summary");
  XLSX.utils.book_append_sheet(wb, buildGantt      (XLSX, args.milestones, args.settings),                                                                "Gantt");
  XLSX.utils.book_append_sheet(wb, buildMilestones (XLSX, args.milestones, args.settings),                                                                "Milestones");
  XLSX.utils.book_append_sheet(wb, buildTasks      (XLSX, args.tasks, args.milestones),                                                                   "Tasks");
  XLSX.utils.book_append_sheet(wb, buildDocuments  (XLSX, args.documents),                                                                                 "Documents");
  XLSX.utils.book_append_sheet(wb, buildRisks      (XLSX, args.risks),                                                                                     "Risks");
  XLSX.utils.book_append_sheet(wb, buildCosts      (XLSX, args.costLines),                                                                                 "Costs");
  XLSX.utils.book_append_sheet(wb, buildResources  (XLSX, args.teamMembers, args.meetings, args.absences),                                                 "Resources & Meetings");

  XLSX.writeFile(wb, `${slug(args.project.name)}_${todayIso()}.xlsx`);
}
