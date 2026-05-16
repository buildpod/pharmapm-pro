"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  milestones as initialMilestones,
  tasks as initialTasks,
  risks as initialRisks,
  documents as initialDocuments,
  costLines as initialCostLines,
  teamMembers as initialTeamMembers,
  recurringMeetings as initialMeetings,
  absences as initialAbsences,
  type Project, type Milestone, type Task, type Risk, type Document,
  type CostLine, type TeamMember, type RecurringMeeting, type Absence,
} from "@/lib/mockData";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settingsStore";
import { exportProjectWorkbook } from "@/lib/exporter";
import { cn } from "@/lib/utils";

function readPersisted<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Triggers a one-click export of the given project's full workbook.
// Reads persisted entity arrays (M16.1) + settings, filters to this project,
// passes the slice to lib/exporter. Renders a button with loading state.

export function ExportButton({
  project,
  variant = "default",
  className,
}: {
  project: Project;
  variant?: "default" | "compact";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const allMilestones  = readPersisted<Milestone[]>("aivello_milestones_v1", initialMilestones);
      const allTasks       = readPersisted<Task[]>("aivello_tasks_v1", initialTasks);
      const allRisks       = readPersisted<Risk[]>("aivello_risks_v1", initialRisks);
      const allDocuments   = readPersisted<Document[]>("aivello_documents_v1", initialDocuments);
      const allCostLines   = readPersisted<CostLine[]>("aivello_costLines_v1", initialCostLines);
      const allMembers     = readPersisted<TeamMember[]>("aivello_teamMembers_v1", initialTeamMembers);
      const allMeetings    = readPersisted<RecurringMeeting[]>("aivello_meetings_v1", initialMeetings);
      const allAbsences    = readPersisted<Absence[]>("aivello_absences_v1", initialAbsences);
      const settings       = readPersisted<AppSettings>("aivello_settings_v1", DEFAULT_SETTINGS);

      await exportProjectWorkbook({
        project,
        milestones: allMilestones.filter((m) => m.projectId === project.id),
        tasks:      allTasks.filter((t) => t.projectId === project.id),
        risks:      allRisks.filter((r) => r.projectId === project.id),
        documents:  allDocuments.filter((d) => d.projectId === project.id),
        costLines:  allCostLines.filter((c) => c.projectId === project.id),
        teamMembers: allMembers.filter((m) => m.projectId === project.id),
        meetings:    allMeetings.filter((m) => m.projectId === project.id),
        absences:    allAbsences.filter((a) => a.projectId === project.id),
        settings,
      });
      toast.success("Workbook exported", { description: `${project.name} — 8 sheets` });
    } catch (e) {
      console.error("Export failed", e);
      toast.error("Export failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleExport}
        disabled={busy}
        title={`Export ${project.name} as Excel workbook`}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50",
          className
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        Export
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      title={`Export ${project.name} as Excel workbook (8 sheets)`}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50",
        className
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Export
    </button>
  );
}
