"use client";

import { useState } from "react";
import { FileText, Users, Layers } from "lucide-react";
import { WeeklyReport } from "@/components/reports/weekly-report";
import { SteerCoReport } from "@/components/reports/steerco-report";
import { WorkstreamReport } from "@/components/reports/workstream-report";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "weekly",      label: "Weekly Status",        icon: FileText, desc: "Full project status · print · Excel" },
  { id: "steerco",     label: "Steering Committee",   icon: Users,    desc: "Executive RAG · escalations · gate decisions" },
  { id: "workstream",  label: "Workstream",           icon: Layers,   desc: "Per-workstream tasks · dependencies · milestones" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ReportsPage() {
  const [active, setActive] = useState<TabId>("weekly");

  return (
    <div className="space-y-6">
      <header className="space-y-1 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Pick a report type. Each one can be printed (or saved as PDF) and exported to a multi-sheet Excel workbook.
        </p>
      </header>

      {/* Tab bar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left shadow-sm transition-all",
                isActive
                  ? "border-primary bg-primary/5 text-primary shadow"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <span className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{tab.label}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{tab.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Report content */}
      {active === "weekly"     && <WeeklyReport />}
      {active === "steerco"    && <SteerCoReport />}
      {active === "workstream" && <WorkstreamReport />}
    </div>
  );
}
