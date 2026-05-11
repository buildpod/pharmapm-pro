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
    <div className="space-y-4">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Select a report type · print or save as PDF · export to Excel
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-left transition-colors",
                active === tab.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs font-semibold leading-tight">{tab.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{tab.desc}</p>
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
