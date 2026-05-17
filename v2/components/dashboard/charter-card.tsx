"use client";

// M22 — Charter dashboard card. Compact status surface that links to /charter.

import Link from "next/link";
import { Scroll, ArrowRight, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntityStore } from "@/lib/stores/entity-store";
import { useProject } from "@/components/projects/project-provider";
import { type CharterStatus } from "@/lib/mockData";

const statusPill: Record<CharterStatus, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "border-slate-200 bg-slate-50 text-slate-700" },
  submitted: { label: "Submitted", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  approved:  { label: "Approved",  cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CharterCard() {
  const { activeProjectId, activeProject } = useProject();
  const charters = useEntityStore((s) => s.charters);
  const charter  = charters.find((c) => c.projectId === activeProjectId);

  return (
    <Link
      href="/charter"
      className="group block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Scroll className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Project Charter</p>
            {charter ? (
              <span className={cn("mt-0.5 inline-block rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider", statusPill[charter.status].cls)}>
                {statusPill[charter.status].label}
              </span>
            ) : (
              <span className="mt-0.5 inline-block rounded-full border border-dashed border-slate-300 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Not started
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {charter ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate" title={charter.sponsor}>{charter.sponsor}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Go-live {formatDate(activeProject.goLiveDate)}</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Last updated {formatDate(charter.lastUpdated)}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Create the project&apos;s authorising document. Anchors scope and sponsor before further planning.
        </p>
      )}
    </Link>
  );
}
