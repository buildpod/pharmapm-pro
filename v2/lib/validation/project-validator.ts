// M20.2 — Cross-entity validation layer.
//
// Per-form validation (in entity drawers) catches single-entity issues. This
// validator runs across the whole project state to surface cross-cutting
// problems that no single form can see:
//   - A milestone planned after project go-live
//   - A task due after its linked milestone
//   - A cost line whose actual exceeds budget
//   - An in-review document with no reviewers
//   - A risk with no owner
//
// Returns a "health score" (100 = clean) and a structured issues list so the
// dashboard "Project Health" card can render it.

import type {
  Project, Milestone, Task, Risk, Document, CostLine,
} from "@/lib/mockData";

export type IssueSeverity = "high" | "medium" | "low";

export interface ValidationIssue {
  id: string;                  // stable id: "rule-id:entityKind:entityId"
  rule: string;                // human-readable rule name
  severity: IssueSeverity;
  entityKind: "milestone" | "task" | "risk" | "document" | "costLine" | "project";
  entityId: string;
  message: string;
}

export interface ValidationResult {
  healthScore: number;         // 100 - (high*15 + medium*5 + low*1), floor 0
  issues: ValidationIssue[];
  totalsBy: { high: number; medium: number; low: number };
}

export function validateProjectState(args: {
  project: Project;
  milestones: Milestone[];
  tasks: Task[];
  risks: Risk[];
  documents: Document[];
  costLines: CostLine[];
}): ValidationResult {
  const { project, milestones, tasks, risks, documents, costLines } = args;
  const issues: ValidationIssue[] = [];

  // Rule 1 — milestone planned after project go-live (HIGH)
  milestones.forEach((m) => {
    if (m.plannedDate > project.goLiveDate && m.status !== "complete") {
      issues.push({
        id: `ms-after-golive:milestone:${m.id}`,
        rule: "Milestone planned after project go-live",
        severity: "high",
        entityKind: "milestone",
        entityId: m.id,
        message: `${m.id.toUpperCase()} planned ${m.plannedDate} — past go-live ${project.goLiveDate}`,
      });
    }
  });

  // Rule 2 — task due after its linked milestone (MEDIUM)
  const msById: Record<string, Milestone> = {};
  milestones.forEach((m) => { msById[m.id] = m; });
  tasks.forEach((t) => {
    if (!t.milestoneId) return;
    const ms = msById[t.milestoneId];
    if (!ms) return;
    if (t.dueDate > ms.plannedDate && t.status !== "Complete") {
      issues.push({
        id: `task-after-ms:task:${t.id}`,
        rule: "Task due after its linked milestone",
        severity: "medium",
        entityKind: "task",
        entityId: t.id,
        message: `${t.id.toUpperCase()} due ${t.dueDate} but milestone ${ms.id.toUpperCase()} planned ${ms.plannedDate}`,
      });
    }
  });

  // Rule 3 — cost line actual exceeds budget (MEDIUM)
  costLines.forEach((c) => {
    if (c.budgetK > 0 && c.actualK > c.budgetK) {
      issues.push({
        id: `cost-over:costLine:${c.id}`,
        rule: "Cost actual exceeds budget",
        severity: "medium",
        entityKind: "costLine",
        entityId: c.id,
        message: `${c.id.toUpperCase()}: $${c.actualK}k actual vs $${c.budgetK}k budget (${Math.round((c.actualK / c.budgetK) * 100)}%)`,
      });
    }
  });

  // Rule 4 — in-review document with no reviewers (LOW)
  documents.forEach((d) => {
    if (d.status === "in-review" && d.reviewers.length === 0) {
      issues.push({
        id: `doc-no-rev:document:${d.id}`,
        rule: "Document in review with no reviewers assigned",
        severity: "low",
        entityKind: "document",
        entityId: d.id,
        message: `${d.id.toUpperCase()} (${d.name}) is in-review but has no reviewers`,
      });
    }
  });

  // Rule 5 — risk with no owner (LOW)
  risks.forEach((r) => {
    if (r.status === "open" && (!r.owner || r.owner.trim() === "")) {
      issues.push({
        id: `risk-no-owner:risk:${r.id}`,
        rule: "Open risk has no owner",
        severity: "low",
        entityKind: "risk",
        entityId: r.id,
        message: `${r.id.toUpperCase()} (${r.title}) is open but unowned`,
      });
    }
  });

  // Health score: weighted deduction, floored at 0
  const totalsBy = {
    high:   issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low:    issues.filter((i) => i.severity === "low").length,
  };
  const healthScore = Math.max(0, 100 - (totalsBy.high * 15 + totalsBy.medium * 5 + totalsBy.low * 1));

  return { healthScore, issues, totalsBy };
}
