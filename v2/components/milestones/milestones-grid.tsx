"use client";

import { useState, useRef, useEffect } from "react";
import {
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { milestones as initialMilestones, project, type Milestone, type MilestoneStatus } from "@/lib/mockData";
import {
  computeRAG,
  computeDependencyStatus,
  cascade,
  scheduleBackward,
  previewCascade,
  type ScheduleMilestone,
} from "@/lib/domain/scheduling";
import { addWorkingDays } from "@/lib/domain/dates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TODAY = "2026-05-11";

// ─── Domain conversion helpers ────────────────────────────────────────────────

function toId(id: string) {
  return parseInt(id.replace("m", ""));
}

function toScheduleMs(m: Milestone): ScheduleMilestone {
  const dur = m.duration ?? 1;
  // plannedDate is the completion date (= plannedEnd); derive start from it
  const plannedStart = addWorkingDays(m.plannedDate, -(dur - 1)) ?? m.plannedDate;
  return {
    id: toId(m.id),
    predecessor: m.predecessor ? toId(m.predecessor) : undefined,
    lag: m.lag ?? 0,
    duration: dur,
    plannedStart,
    plannedEnd: m.plannedDate,
    status:
      m.status === "complete"
        ? "Complete"
        : m.status === "in-progress"
        ? "In Progress"
        : m.status === "at-risk"
        ? "Blocked"
        : "Not Started",
    lockDate: m.locked,
  };
}

function applyDomainResult(
  originals: Milestone[],
  domainResults: ScheduleMilestone[]
): Milestone[] {
  const byId: Record<number, ScheduleMilestone> = {};
  domainResults.forEach((sm) => { byId[sm.id] = sm; });
  return originals.map((m) => {
    const sm = byId[toId(m.id)];
    if (!sm) return m;
    return { ...m, plannedDate: sm.plannedEnd ?? m.plannedDate };
  });
}

// ─── Badge styles ─────────────────────────────────────────────────────────────

const ragBadge = {
  Green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Amber: "bg-amber-50 text-amber-700 border-amber-200",
  Red:   "bg-rose-50 text-rose-700 border-rose-200",
};

const depBadge = {
  Clear:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  Waiting: "bg-amber-50 text-amber-700 border-amber-200",
  Blocked: "bg-rose-50 text-rose-700 border-rose-200",
};

const statusIcon = {
  complete:    { icon: CheckCircle2, cls: "text-emerald-600" },
  "in-progress": { icon: Circle,    cls: "text-blue-600"   },
  "at-risk":   { icon: AlertCircle, cls: "text-rose-600" },
  pending:     { icon: Clock,       cls: "text-muted-foreground" },
} as const;

const statusOptions: MilestoneStatus[] = ["pending", "in-progress", "at-risk", "complete"];

const phaseOptions = ["All", "Initiation", "Design", "Config", "Testing", "Training", "Go-Live"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Cascade preview dialog ───────────────────────────────────────────────────

interface CascadePreviewState {
  affected: { id: number; name?: string; oldEnd?: string; newEnd?: string; daysShifted: number }[];
  pendingMilestones: Milestone[];
}

function CascadePreviewDialog({
  preview,
  onApply,
  onDiscard,
}: {
  preview: CascadePreviewState;
  onApply: (ms: Milestone[]) => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDiscard(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cascade Preview</DialogTitle>
          <DialogDescription>
            This date change will shift {preview.affected.length} downstream milestone
            {preview.affected.length !== 1 ? "s" : ""}. Review before applying.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 max-h-72 overflow-y-auto">
          <ul className="space-y-2">
            {preview.affected.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-xs">
                <span className="font-medium text-foreground truncate">{a.name ?? `Milestone ${a.id}`}</span>
                <div className="text-right shrink-0">
                  <p className="text-muted-foreground line-through">{a.oldEnd ? formatDate(a.oldEnd) : "—"}</p>
                  <p className="font-semibold text-foreground">{a.newEnd ? formatDate(a.newEnd) : "—"}</p>
                  {a.daysShifted !== 0 && (
                    <p className={cn("text-[10px]", a.daysShifted > 0 ? "text-destructive" : "text-green-600")}>
                      {a.daysShifted > 0 ? `+${a.daysShifted}d` : `${a.daysShifted}d`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              onClick={onDiscard}
            >
              Discard
            </button>
          </DialogClose>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={() => onApply(preview.pendingMilestones)}
          >
            Apply cascade
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline date cell ─────────────────────────────────────────────────────────

function DateCell({
  value,
  editable,
  onCommit,
}: {
  value: string;
  editable: boolean;
  onCommit: (newVal: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editable) {
    return <span className="text-foreground text-xs">{formatDate(value)}</span>;
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 text-xs text-foreground hover:text-primary"
        title="Click to edit"
      >
        {formatDate(value)}
        <Calendar className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 shrink-0" />
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      defaultValue={value}
      className="w-28 rounded border border-primary px-1 py-0.5 text-xs text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
      onBlur={(e) => {
        setEditing(false);
        if (e.target.value && e.target.value !== value) onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const val = (e.target as HTMLInputElement).value;
          setEditing(false);
          if (val && val !== value) onCommit(val);
        }
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

// ─── Status cell — click icon to cycle status ────────────────────────────────

const nextMilestoneStatus: Record<MilestoneStatus, MilestoneStatus> = {
  pending:      "in-progress",
  "in-progress": "at-risk",
  "at-risk":    "complete",
  complete:     "pending",
};

function StatusCell({
  value,
  editable,
  onChange,
}: {
  value: MilestoneStatus;
  editable: boolean;
  onChange: (s: MilestoneStatus) => void;
}) {
  const { icon: Icon, cls } = statusIcon[value];
  if (!editable) {
    return (
      <span title={value}>
        <Icon className={cn("h-3.5 w-3.5", cls)} />
      </span>
    );
  }
  return (
    <button
      onClick={() => onChange(nextMilestoneStatus[value])}
      title={`${value} — click to mark ${nextMilestoneStatus[value]}`}
      className="hover:opacity-70 transition-opacity"
    >
      <Icon className={cn("h-3.5 w-3.5", cls)} />
    </button>
  );
}

// ─── Main grid ───────────────────────────────────────────────────────────────

export function MilestonesGrid() {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [filterPhase, setFilterPhase] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [cascadePreview, setCascadePreview] = useState<CascadePreviewState | null>(null);

  const domainMilestones = milestones.map(toScheduleMs);

  // Apply a planned-date change: run cascade preview, show modal if needed
  function handlePlannedDateChange(id: string, newDate: string) {
    const numId = toId(id);
    const edit = { id: numId, field: "plannedEnd" as const, value: newDate };
    const preview = previewCascade(domainMilestones, edit);

    // Build the "already-applied" milestone state so we can hand it to the modal
    const cascadeResult = cascade(
      domainMilestones.map((sm) => sm.id === numId ? { ...sm, plannedEnd: newDate } : sm)
    );
    const pending = applyDomainResult(milestones, cascadeResult.milestones);

    if (preview.affected.length > 0) {
      setCascadePreview({ affected: preview.affected, pendingMilestones: pending });
    } else {
      // No downstream impact — apply directly
      setMilestones(pending);
    }
  }

  // Apply a forecast-date change directly (no cascade — forecast is a projection)
  function handleForecastDateChange(id: string, newDate: string) {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, forecastDate: newDate } : m));
  }

  // Toggle lock
  function handleLockToggle(id: string) {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, locked: !m.locked } : m));
  }

  // Status change
  function handleStatusChange(id: string, status: MilestoneStatus) {
    setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  }

  // Schedule from Go-Live
  function handleScheduleFromGoLive() {
    const result = scheduleBackward(domainMilestones, project.goLiveDate);
    if (result.error) return;
    setMilestones(applyDomainResult(milestones, result.milestones));
  }

  // Reset to original mock data
  function handleReset() {
    setMilestones(initialMilestones);
  }

  const filtered = milestones.filter((m) => {
    if (filterPhase !== "All" && m.phase !== filterPhase) return false;
    if (filterStatus !== "All" && m.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <select
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {phaseOptions.map((p) => <option key={p} value={p}>{p === "All" ? "All phases" : p}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="All">All statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex-1" />

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>

        <button
          onClick={handleScheduleFromGoLive}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Calendar className="h-3.5 w-3.5" />
          Schedule from Go-Live
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        <div className="grid grid-cols-[24px_2fr_1fr_1fr_1fr_64px_80px_80px_32px] gap-0 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div />
          <div>Milestone</div>
          <div>Phase</div>
          <div>Planned</div>
          <div>Forecast</div>
          <div className="text-center">Dur</div>
          <div className="text-center">RAG</div>
          <div className="text-center">Dep</div>
          <div />
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No milestones match the current filters.</p>
            <p className="mt-1 text-xs text-muted-foreground">Try clearing phase or status filters.</p>
          </div>
        )}

        <ul className="divide-y divide-border">
          {filtered.map((m) => {
            const dm = toScheduleMs(m);
            const rag = computeRAG(dm, TODAY);
            const dep = computeDependencyStatus(dm, domainMilestones, TODAY);
            const variance = Math.ceil(
              (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000
            );
            const canEdit = m.status !== "complete";

            return (
              <li
                key={m.id}
                className={cn(
                  "grid grid-cols-[24px_2fr_1fr_1fr_1fr_64px_80px_80px_32px] gap-0 items-center px-5 py-3.5",
                  "hover:bg-muted/20 transition-colors"
                )}
              >
                {/* Status (editable dropdown for non-complete) */}
                <div>
                  <StatusCell
                    value={m.status}
                    editable={!m.locked}
                    onChange={(s) => handleStatusChange(m.id, s)}
                  />
                </div>

                {/* Name + owner */}
                <div className="min-w-0 pl-2">
                  <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">Owner: {m.owner}</p>
                </div>

                {/* Phase */}
                <div className="truncate text-xs text-muted-foreground">{m.phase}</div>

                {/* Planned date (editable) */}
                <div>
                  <DateCell
                    value={m.plannedDate}
                    editable={canEdit && !m.locked}
                    onCommit={(v) => handlePlannedDateChange(m.id, v)}
                  />
                  {variance !== 0 && (
                    <p className={cn(
                      "mt-0.5 text-[11px] font-semibold tabular-nums",
                      variance > 0 ? "text-rose-600" : "text-emerald-600",
                    )}>
                      {variance > 0 ? `+${variance}d` : `${variance}d`}
                    </p>
                  )}
                </div>

                {/* Forecast date (editable, no cascade) */}
                <div>
                  <DateCell
                    value={m.forecastDate}
                    editable={canEdit && !m.locked}
                    onCommit={(v) => handleForecastDateChange(m.id, v)}
                  />
                </div>

                {/* Duration */}
                <div className="text-center text-xs tabular-nums text-muted-foreground">
                  {m.duration ?? 1}d
                </div>

                {/* RAG */}
                <div className="flex justify-center">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", ragBadge[rag])}>
                    {rag}
                  </span>
                </div>

                {/* Dep */}
                <div className="flex justify-center">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", depBadge[dep])}>
                    {dep}
                  </span>
                </div>

                {/* Lock toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => handleLockToggle(m.id)}
                    title={m.locked ? "Unlock date" : "Lock date"}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {m.locked
                      ? <Lock className="h-3 w-3" />
                      : <Unlock className="h-3 w-3 opacity-30 hover:opacity-80" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-muted/20 px-5 py-3 text-[11px]">
          <span className="font-semibold text-muted-foreground">RAG:</span>
          {(["Green", "Amber", "Red"] as const).map((r) => (
            <span key={r} className={cn("rounded-full border px-2 py-0.5 font-semibold", ragBadge[r])}>{r}</span>
          ))}
          <span className="mx-1 text-border">·</span>
          <span className="font-semibold text-muted-foreground">Dep:</span>
          {(["Clear", "Waiting", "Blocked"] as const).map((d) => (
            <span key={d} className={cn("rounded-full border px-2 py-0.5 font-semibold", depBadge[d])}>{d}</span>
          ))}
          <span className="mx-1 text-border">·</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" /> Click to toggle lock · click dates to edit
          </span>
        </div>
      </div>

      {/* Cascade preview modal */}
      {cascadePreview && (
        <CascadePreviewDialog
          preview={cascadePreview}
          onApply={(ms) => {
            setMilestones(ms);
            setCascadePreview(null);
          }}
          onDiscard={() => setCascadePreview(null)}
        />
      )}
    </div>
  );
}
