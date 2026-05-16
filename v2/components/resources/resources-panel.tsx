"use client";

import { useState, createContext, useContext } from "react";
import { toast } from "sonner";
import { Users, Calendar, ClipboardList, Layers, AlertTriangle, XCircle, Plus, Trash2, X } from "lucide-react";
import {
  milestones, tasks, risks, documents,
  type TeamMember, type RecurringMeeting, type Absence, type AbsenceReason,
} from "@/lib/mockData";
import { TeamMemberFormDrawer } from "./team-member-form";
import { MeetingFormDrawer } from "./meeting-form";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const TODAY = "2026-05-11";

// ─── Resources state (lifted) ────────────────────────────────────────────────

type ResourcesContextValue = {
  absences: Absence[];
  addAbsence: (a: Omit<Absence, "id">) => void;
  removeAbsence: (id: string) => void;
  teamMembers: TeamMember[];
  recurringMeetings: RecurringMeeting[];
};

// Context defaults are empty — real values come from the entity store via the provider in <ResourcesPanel>
const ResourcesContext = createContext<ResourcesContextValue>({
  absences: [],
  addAbsence: () => {},
  removeAbsence: () => {},
  teamMembers: [],
  recurringMeetings: [],
});

function useResources() {
  return useContext(ResourcesContext);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && aEnd >= bStart;
}

function getMemberById(members: TeamMember[], id: string) {
  return members.find((m) => m.id === id);
}

function getMemberAbsencesInWeek(absences: Absence[], memberId: string, wStart: string, wEnd: string) {
  return absences.filter(
    (ab) => ab.memberId === memberId && overlaps(ab.startDate, ab.endDate, wStart, wEnd)
  );
}

function getImpactCount(member: TeamMember, rangeStart: string, rangeEnd: string) {
  const t = tasks.filter(
    (t) =>
      t.owner === member.initials &&
      t.status !== "Complete" &&
      t.dueDate >= rangeStart &&
      t.dueDate <= rangeEnd
  ).length;
  const m = milestones.filter(
    (m) =>
      m.owner === member.initials &&
      m.status !== "complete" &&
      m.forecastDate >= rangeStart &&
      m.forecastDate <= rangeEnd
  ).length;
  return t + m;
}

function getWeeks(n = 8) {
  const weeks: { label: string; shortLabel: string; start: string; end: string }[] = [];
  const base = new Date(TODAY);
  for (let i = 0; i < n; i++) {
    const start = new Date(base);
    start.setDate(base.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    const fmt = (d: Date) => `${d.toLocaleString("en", { month: "short" })} ${d.getDate()}`;
    weeks.push({
      label: `${fmt(start)}–${fmt(end)}`,
      shortLabel: fmt(start),
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }
  return weeks;
}

const reasonPill: Record<string, string> = {
  "Vacation":       "bg-blue-50 text-blue-700 border border-blue-200",
  "Public Holiday": "bg-violet-50 text-violet-700 border border-violet-200",
  "Conference":     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Sick Leave":     "bg-orange-50 text-orange-700 border border-orange-200",
  "Other":          "bg-muted text-muted-foreground",
};

// ─── Add Absence form (inline card) ──────────────────────────────────────────

const REASON_OPTIONS: AbsenceReason[] = ["Vacation", "Public Holiday", "Conference", "Sick Leave", "Other"];

function AddAbsenceForm({
  onCancel,
  onSubmit,
  members,
}: {
  onCancel: () => void;
  onSubmit: (a: Omit<Absence, "id">) => void;
  members: TeamMember[];
}) {
  const ops = members.filter((m) => m.workstream !== "Executive");
  const [memberId, setMemberId] = useState(ops[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState<AbsenceReason>("Vacation");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!memberId)               { setError("Pick a team member"); return; }
    if (!startDate || !endDate)  { setError("Both start and end dates are required"); return; }
    if (startDate > endDate)     { setError("End date must be on or after start date"); return; }
    setError(null);
    onSubmit({
      memberId, startDate, endDate, reason,
      ...(note.trim() ? { note: note.trim() } : {}),
      projectId: "", // parent panel overwrites with activeProjectId
    });
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Add Absence</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Mock-only — no backend persistence yet.</p>
        </div>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Team member</span>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ops.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.role}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as AbsenceReason)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {REASON_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-muted-foreground">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="font-medium text-muted-foreground">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Veeva Summit 2026"
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:bg-rose-950/30">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Save absence
        </button>
      </div>
    </div>
  );
}

// ─── Tab 1: Team Availability ────────────────────────────────────────────────

function TeamAvailabilityTab({ onEditMember }: { onEditMember: (m: TeamMember) => void }) {
  const { absences, addAbsence, removeAbsence, teamMembers } = useResources();
  const [addOpen, setAddOpen] = useState(false);
  const weeks = getWeeks(8);
  const ops = teamMembers.filter((m) => m.workstream !== "Executive");

  return (
    <div className="space-y-5">
      {/* Legend + add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          {[
            { cls: "bg-muted/50 border-border",           label: "Available" },
            { cls: "bg-amber-100 border-amber-200",       label: "Absent — no impact" },
            { cls: "bg-rose-100 border-rose-200",         label: "Absent — items at risk" },
          ].map(({ cls, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded-sm border inline-block", cls)} />
              {label}
            </span>
          ))}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Absence
        </button>
      </div>

      {addOpen && (
        <AddAbsenceForm
          members={teamMembers}
          onCancel={() => setAddOpen(false)}
          onSubmit={(a) => {
            addAbsence(a);
            setAddOpen(false);
          }}
        />
      )}

      {/* Calendar grid */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground sticky left-0 bg-muted/40 w-44">
                Member
              </th>
              {weeks.map((w) => (
                <th key={w.start} className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {w.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ops.map((member) => (
              <tr key={member.id} className="hover:bg-muted/20">
                <td className="px-3 py-2 sticky left-0 bg-card">
                  <button
                    onClick={() => onEditMember(member)}
                    className="flex items-center gap-2 text-left hover:text-primary"
                    title="Click to edit member"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {member.initials}
                    </span>
                    <div>
                      <p className="text-xs font-medium leading-none">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground">{member.role}</p>
                    </div>
                  </button>
                </td>
                {weeks.map((week) => {
                  const weekAbs = getMemberAbsencesInWeek(absences, member.id, week.start, week.end);
                  const absent = weekAbs.length > 0;
                  const impact = absent ? getImpactCount(member, week.start, week.end) : 0;
                  return (
                    <td key={week.start} className="px-1 py-1 text-center">
                      {absent ? (
                        <div
                          title={weekAbs.map((a) => `${a.reason}${a.note ? ` — ${a.note}` : ""}`).join(", ")}
                          className={cn(
                            "rounded px-1.5 py-1 text-[10px] font-semibold leading-none cursor-default",
                            impact > 0
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          )}
                        >
                          {impact > 0 ? `⚠ ${impact}` : "Away"}
                        </div>
                      ) : (
                        <div className="mx-auto h-7 w-full rounded bg-muted/30 border border-border/40" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Absence cards */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Registered Absences</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {absences.map((ab) => {
            const member = getMemberById(teamMembers, ab.memberId);
            if (!member) return null;
            const impactTasks = tasks.filter(
              (t) =>
                t.owner === member.initials &&
                t.status !== "Complete" &&
                t.dueDate >= ab.startDate &&
                t.dueDate <= ab.endDate
            );
            const impactMs = milestones.filter(
              (m) =>
                m.owner === member.initials &&
                m.status !== "complete" &&
                m.forecastDate >= ab.startDate &&
                m.forecastDate <= ab.endDate
            );
            const hasImpact = impactTasks.length + impactMs.length > 0;
            return (
              <div
                key={ab.id}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  hasImpact ? "border-rose-200 bg-rose-50 dark:bg-rose-950/20" : "border-border bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {member.initials}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ab.startDate} → {ab.endDate}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", reasonPill[ab.reason] ?? "bg-muted text-muted-foreground")}>
                      {ab.reason}
                    </span>
                    <button
                      onClick={() => removeAbsence(ab.id)}
                      title="Remove absence"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {ab.note && <p className="text-[10px] text-muted-foreground italic">{ab.note}</p>}
                {hasImpact && (
                  <div className="rounded bg-rose-100 dark:bg-rose-900/30 px-2 py-1.5 text-[10px] text-rose-700 dark:text-rose-400 space-y-0.5">
                    <p className="font-semibold">
                      ⚠ {impactTasks.length + impactMs.length} item{impactTasks.length + impactMs.length > 1 ? "s" : ""} at risk during this period
                    </p>
                    {impactTasks.map((t) => (
                      <p key={t.id}>• Task: {t.name} (due {t.dueDate})</p>
                    ))}
                    {impactMs.map((m) => (
                      <p key={m.id}>• Milestone: {m.name} (forecast {m.forecastDate})</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Meeting Cadence ──────────────────────────────────────────────────

function MeetingCadenceTab({ onEditMeeting }: { onEditMeeting: (m: RecurringMeeting) => void }) {
  const { absences, teamMembers, recurringMeetings } = useResources();

  function hasMandatoryConflict(mtg: RecurringMeeting) {
    return mtg.attendees.some(
      (att) =>
        att.role === "mandatory" &&
        absences.some(
          (ab) =>
            ab.memberId === att.memberId &&
            overlaps(ab.startDate, ab.endDate, mtg.nextDate, mtg.nextDate)
        )
    );
  }

  const typeStyle: Record<string, string> = {
    steerco:    "bg-violet-50 text-violet-700 border border-violet-200",
    workstream: "bg-blue-50 text-blue-700 border border-blue-200",
    governance: "bg-slate-50 text-slate-700 border border-slate-200",
  };

  const freqLabel: Record<string, string> = {
    "weekly":    "Every week",
    "bi-weekly": "Every 2 weeks",
    "monthly":   "Monthly",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {recurringMeetings.map((mtg) => {
        const conflict = hasMandatoryConflict(mtg);
        const mandatory = mtg.attendees.filter((a) => a.role === "mandatory");
        const optional  = mtg.attendees.filter((a) => a.role === "optional");

        return (
          <div
            key={mtg.id}
            className={cn(
              "rounded-lg border bg-card p-4 space-y-3",
              conflict ? "border-rose-300" : "border-border"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  onClick={() => onEditMeeting(mtg)}
                  className="text-left text-sm font-semibold text-foreground hover:text-primary hover:underline"
                  title="Click to edit meeting"
                >
                  {mtg.name}
                </button>
                {mtg.workstream && (
                  <p className="text-[10px] text-muted-foreground">{mtg.workstream} workstream</p>
                )}
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", typeStyle[mtg.type])}>
                {mtg.type === "steerco" ? "SteerCo" : mtg.type === "workstream" ? "Workstream" : "Governance"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-muted-foreground">Cadence</p>
                <p className="font-medium text-foreground">{freqLabel[mtg.frequency]}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Day</p>
                <p className="font-medium text-foreground">{mtg.dayOfWeek}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium text-foreground">{mtg.durationMins} min</p>
              </div>
            </div>

            <div className="text-[11px]">
              <p className="text-muted-foreground">Next occurrence</p>
              <p className={cn("font-semibold", conflict ? "text-rose-600" : "text-foreground")}>
                {mtg.nextDate}{conflict && " — ⚠ Mandatory attendee conflict"}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mandatory</p>
              <div className="flex flex-wrap gap-1.5">
                {mandatory.map((att) => {
                  const m = getMemberById(teamMembers, att.memberId);
                  if (!m) return null;
                  const absent = absences.some(
                    (ab) =>
                      ab.memberId === att.memberId &&
                      overlaps(ab.startDate, ab.endDate, mtg.nextDate, mtg.nextDate)
                  );
                  return (
                    <span
                      key={att.memberId}
                      title={`${m.name} — ${m.role}${absent ? " (ABSENT)" : ""}`}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        absent
                          ? "bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-red-300"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {absent ? `⚠ ${m.initials}` : m.initials}
                    </span>
                  );
                })}
              </div>
            </div>

            {optional.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Optional</p>
                <div className="flex flex-wrap gap-1.5">
                  {optional.map((att) => {
                    const m = getMemberById(teamMembers, att.memberId);
                    if (!m) return null;
                    return (
                      <span
                        key={att.memberId}
                        title={`${m.name} — ${m.role}`}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground"
                      >
                        {m.initials}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: SteerCo Pre-Brief ────────────────────────────────────────────────

function SteerCoPreBriefTab() {
  const { absences, teamMembers, recurringMeetings } = useResources();
  const steerco = recurringMeetings.find((m) => m.type === "steerco")!;
  const mandatory = teamMembers.filter((m) => m.steercoRole === "mandatory");

  const openRisks = risks.filter((r) => r.status === "open");
  const escalated = openRisks.filter((r) => r.score >= 12);
  const delayedMs = milestones.filter(
    (m) => m.status !== "complete" && m.forecastDate > m.plannedDate
  );
  const budgetPct = Math.round((780 / 2000) * 100); // May actual vs total budget

  const scheduleRag = delayedMs.length >= 2 ? "Amber" : delayedMs.length === 1 ? "Amber" : "Green";
  const budgetRag   = budgetPct >= 85 ? "Red" : budgetPct >= 60 ? "Amber" : "Green";
  const riskRag     = escalated.length >= 2 ? "Red" : escalated.length >= 1 ? "Amber" : "Green";

  const pendingApprovals = documents.flatMap((doc) =>
    doc.approvers
      .filter((a) => a.status === "pending")
      .map((a) => ({ doc, approver: a }))
  );

  // Resource conflicts in next 2 weeks
  const twoWeeksEnd = "2026-05-25";
  const nearConflicts = absences.filter((ab) =>
    overlaps(ab.startDate, ab.endDate, TODAY, twoWeeksEnd)
  );

  const ragStyle: Record<string, string> = {
    Red:   "border-rose-200 bg-rose-50 dark:bg-rose-950/20",
    Amber: "border-amber-200 bg-amber-50 dark:bg-amber-950/20",
    Green: "border-green-200 bg-green-50 dark:bg-green-950/20",
  };
  const ragText: Record<string, string> = {
    Red:   "text-rose-700",
    Amber: "text-amber-700",
    Green: "text-green-700",
  };

  function getAttendeeDigest(member: TeamMember) {
    type ActionType = "Present" | "Approve" | "Review" | "Note";
    const actions: { type: ActionType; label: string }[] = [];

    if (member.initials === "VP") {
      actions.push({ type: "Present", label: "Overall project status (Amber — schedule slippage)" });
    }

    documents.forEach((doc) => {
      doc.approvers
        .filter((a) => a.person === member.name && a.status === "pending")
        .forEach(() => actions.push({ type: "Approve", label: doc.name }));
      doc.reviewers
        .filter((a) => a.person === member.name && a.status === "pending")
        .forEach(() => actions.push({ type: "Review", label: doc.name }));
    });

    openRisks
      .filter((r) => r.owner === member.initials)
      .forEach((r) => actions.push({ type: "Note", label: `Risk: ${r.title} (score ${r.score})` }));

    delayedMs
      .filter((m) => m.owner === member.initials)
      .forEach((m) => {
        const slip = Math.ceil(
          (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86400000
        );
        actions.push({ type: "Note", label: `Milestone delayed: ${m.name} (+${slip}d)` });
      });

    return actions;
  }

  const actionStyle: Record<string, string> = {
    Present: "bg-violet-50 text-violet-700 border border-violet-200",
    Approve: "bg-rose-50 text-rose-700 border border-rose-200",
    Review:  "bg-amber-50 text-amber-700 border border-amber-200",
    Note:    "bg-blue-50 text-blue-700",
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Steering Committee Pre-Brief</p>
          <p className="text-xs text-muted-foreground">
            Next: {steerco.nextDate} · {steerco.dayOfWeek} · {steerco.durationMins} min
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors print:hidden"
        >
          Print / Save PDF
        </button>
      </div>

      {/* RAG dashboard */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Project RAG</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { label: "Schedule", rag: scheduleRag, detail: `${delayedMs.length} milestone(s) delayed` },
              { label: "Budget",   rag: budgetRag,   detail: `${budgetPct}% of $2M utilised` },
              { label: "Risk",     rag: riskRag,     detail: `${escalated.length} escalated risk(s)` },
            ] as const
          ).map((item) => (
            <div key={item.label} className={cn("rounded-lg border px-3 py-2 text-center", ragStyle[item.rag])}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className={cn("text-xl font-black", ragText[item.rag])}>{item.rag}</p>
              <p className="text-[10px] text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Decisions required */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Approvals Required This Meeting</p>
        {pendingApprovals.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No pending approvals</p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left">Document</th>
                  <th className="px-3 py-2 text-left">Approver</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingApprovals.map(({ doc, approver }, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground">{doc.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{approver.person}</td>
                    <td className="px-3 py-2 text-muted-foreground">{approver.role}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Escalated risks */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Escalated Risks (Score ≥ 12)</p>
        {escalated.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No escalated risks</p>
        ) : (
          <div className="space-y-2">
            {escalated.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 px-3 py-2">
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 shrink-0">
                  {r.score}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground">Owner: {r.owner} · {r.category}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Near-term resource conflicts */}
      {nearConflicts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Resource Conflicts — Next 2 Weeks</p>
          <div className="space-y-1.5">
            {nearConflicts.map((ab) => {
              const member = getMemberById(teamMembers, ab.memberId);
              if (!member) return null;
              const impact = getImpactCount(member, ab.startDate, ab.endDate);
              return (
                <div key={ab.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                    {member.initials}
                  </span>
                  <span className="font-medium text-foreground">{member.name}</span>
                  <span className="text-muted-foreground">{ab.startDate} → {ab.endDate} · {ab.reason}</span>
                  {impact > 0 && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      ⚠ {impact} item{impact > 1 ? "s" : ""} at risk
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-attendee pre-brief */}
      <div>
        <p className="mb-3 text-xs font-semibold text-foreground">Per-Attendee Pre-Brief</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {mandatory.map((member) => {
            const actions = getAttendeeDigest(member);
            return (
              <div key={member.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {member.initials}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{member.name}</p>
                    <p className="text-[10px] text-muted-foreground">{member.role}</p>
                  </div>
                </div>
                {actions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    No pending actions — attend to receive project status update
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className={cn("mt-px rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0", actionStyle[a.type])}>
                          {a.type}
                        </span>
                        <span className="text-[11px] text-foreground">{a.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Workstream Pre-Brief ─────────────────────────────────────────────

const ALL_WORKSTREAMS = ["Configuration", "Validation", "Data Migration", "Training", "Project Mgmt"];

function WorkstreamPreBriefTab() {
  const { absences, teamMembers } = useResources();
  const [ws, setWs] = useState(ALL_WORKSTREAMS[0]);

  const lead      = teamMembers.find((m) => m.workstream === ws);
  const wsTasks   = tasks.filter((t) => t.workstream === ws);
  const fourWeeks = "2026-06-08";

  const overdue  = wsTasks.filter((t) => t.status !== "Complete" && t.dueDate < TODAY);
  const blocked  = wsTasks.filter((t) => t.status === "Blocked");
  const dueSoon  = wsTasks.filter(
    (t) => t.status !== "Complete" && t.dueDate >= TODAY && t.dueDate <= "2026-05-25"
  );

  const linkedMs = milestones.filter(
    (m) =>
      wsTasks.some((t) => t.milestoneId === m.id) &&
      m.status !== "complete" &&
      m.forecastDate <= fourWeeks
  );

  const wsMembers = teamMembers.filter(
    (m) => m.workstream === ws || (m.initials === "VP" && ws !== "Project Mgmt")
  );
  const wsAbsences = absences.filter(
    (ab) =>
      wsMembers.some((m) => m.id === ab.memberId) &&
      overlaps(ab.startDate, ab.endDate, TODAY, fourWeeks)
  );

  const complete = wsTasks.filter((t) => t.status === "Complete").length;
  const inProg   = wsTasks.filter((t) => t.status === "In Progress").length;

  const statusStyle: Record<string, string> = {
    "Complete":    "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "In Progress": "bg-blue-50 text-blue-700 border border-blue-200",
    "Not Started": "bg-muted text-muted-foreground",
    "Blocked":     "bg-rose-50 text-rose-700 border border-rose-200",
    "On Hold":     "bg-amber-50 text-amber-700 border border-amber-200",
  };
  const prioStyle: Record<string, string> = {
    Critical: "bg-rose-50 text-rose-700 border border-rose-200",
    High:     "bg-orange-50 text-orange-700 border border-orange-200",
    Medium:   "bg-yellow-50 text-yellow-700 border border-yellow-200",
    Low:      "bg-muted text-muted-foreground",
  };

  const focusTasks = [
    ...overdue,
    ...blocked.filter((t) => !overdue.includes(t)),
    ...dueSoon.filter((t) => !overdue.includes(t) && !blocked.includes(t)),
  ];

  return (
    <div className="space-y-5">
      {/* Workstream picker */}
      <div className="flex flex-wrap gap-1">
        {ALL_WORKSTREAMS.map((w) => (
          <button
            key={w}
            onClick={() => setWs(w)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              ws === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Lead header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
            {lead?.initials ?? "–"}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{ws} Workstream</p>
            <p className="text-xs text-muted-foreground">
              Lead: {lead?.name ?? "Unassigned"} · {lead?.role ?? ""}
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-center text-xs">
          {[
            { label: "Total",       val: wsTasks.length,  cls: "text-foreground"    },
            { label: "Complete",    val: complete,         cls: "text-green-600"     },
            { label: "In Progress", val: inProg,           cls: "text-blue-600"      },
            { label: "Blocked",     val: blocked.length,   cls: "text-rose-600"       },
          ].map(({ label, val, cls }) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className={cn("font-bold", cls)}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert flags */}
      {(overdue.length > 0 || blocked.length > 0 || wsAbsences.length > 0) && (
        <div className="space-y-1.5">
          {overdue.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>
                <span className="font-semibold">{overdue.length} task{overdue.length > 1 ? "s" : ""} overdue: </span>
                {overdue.map((t) => t.name).join(", ")}
              </span>
            </div>
          )}
          {blocked.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-xs text-orange-700">
              <XCircle className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>
                <span className="font-semibold">{blocked.length} task{blocked.length > 1 ? "s" : ""} blocked: </span>
                {blocked.map((t) => t.name).join(", ")}
              </span>
            </div>
          )}
          {wsAbsences.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700">
              <Calendar className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>
                <span className="font-semibold">Absences in next 4 weeks: </span>
                {wsAbsences.map((ab) => {
                  const m = getMemberById(teamMembers, ab.memberId);
                  return `${m?.name ?? ab.memberId} (${ab.startDate}→${ab.endDate})`;
                }).join("; ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Linked milestones */}
      {linkedMs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Upcoming Milestones (next 4 weeks)</p>
          <div className="space-y-1.5">
            {linkedMs.map((m) => {
              const slip = m.forecastDate > m.plannedDate
                ? Math.ceil(
                    (new Date(m.forecastDate).getTime() - new Date(m.plannedDate).getTime()) / 86400000
                  )
                : 0;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                    m.status === "at-risk" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {m.status}
                  </span>
                  <span className="flex-1 font-medium text-foreground">{m.name}</span>
                  <span className="text-muted-foreground tabular-nums">{m.forecastDate}</span>
                  {slip > 0 && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      +{slip}d
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Focus task table */}
      {focusTasks.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">
            Focus Items — Overdue, Blocked & Due This Fortnight
          </p>
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 text-left">Task</th>
                  <th className="px-3 py-2 text-center w-20">Priority</th>
                  <th className="px-3 py-2 text-center w-24">Status</th>
                  <th className="px-3 py-2 text-center w-16">Owner</th>
                  <th className="px-3 py-2 text-center w-24">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {focusTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium text-foreground">{t.name}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", prioStyle[t.priority])}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusStyle[t.status])}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{t.owner}</td>
                    <td className={cn(
                      "px-3 py-2 text-center tabular-nums",
                      t.dueDate < TODAY ? "font-bold text-rose-600" : "text-muted-foreground"
                    )}>
                      {t.dueDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No urgent items in this workstream for the next 2 weeks.
        </p>
      )}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

type Tab = "availability" | "cadence" | "steerco" | "workstream";

const tabs = [
  { id: "availability" as const, label: "Team Availability", Icon: Users },
  { id: "cadence"      as const, label: "Meeting Cadence",   Icon: Calendar },
  { id: "steerco"      as const, label: "SteerCo Pre-Brief", Icon: ClipboardList },
  { id: "workstream"   as const, label: "Workstream Brief",  Icon: Layers },
];

type MemberDrawer  = { mode: "closed" } | { mode: "new" } | { mode: "edit"; member: TeamMember };
type MeetingDrawer = { mode: "closed" } | { mode: "new" } | { mode: "edit"; meeting: RecurringMeeting };

export function ResourcesPanel() {
  const { activeProjectId } = useProject();
  const [tab, setTab] = useState<Tab>("availability");
  const absences            = useEntityStore((s) => s.absences);
  const teamMembers         = useEntityStore((s) => s.teamMembers);
  const recurringMeetings   = useEntityStore((s) => s.meetings);
  const addAbsenceAction    = useEntityStore((s) => s.addAbsence);
  const deleteAbsenceAction = useEntityStore((s) => s.deleteAbsence);
  const addTeamMember       = useEntityStore((s) => s.addTeamMember);
  const updateTeamMember    = useEntityStore((s) => s.updateTeamMember);
  const deleteTeamMemberAction = useEntityStore((s) => s.deleteTeamMember);
  const addMeetingAction    = useEntityStore((s) => s.addMeeting);
  const updateMeetingAction = useEntityStore((s) => s.updateMeeting);
  const deleteMeetingAction = useEntityStore((s) => s.deleteMeeting);
  const [memberDrawer,  setMemberDrawer]          = useState<MemberDrawer>({ mode: "closed" });
  const [meetingDrawer, setMeetingDrawer]         = useState<MeetingDrawer>({ mode: "closed" });

  // Scope everything to the active project
  const projectAbsences = absences.filter((a) => a.projectId === activeProjectId);
  const projectMembers  = teamMembers.filter((m) => m.projectId === activeProjectId);
  const projectMeetings = recurringMeetings.filter((m) => m.projectId === activeProjectId);

  function addAbsence(a: Omit<Absence, "id">) {
    const id = `ab${Date.now()}`;
    const withProj: Absence = { ...a, id, projectId: activeProjectId };
    addAbsenceAction(withProj);
    const member = teamMembers.find((m) => m.id === a.memberId);
    toast.success(`Absence added`, {
      description: `${member?.name ?? a.memberId} · ${a.startDate} → ${a.endDate} · ${a.reason}`,
    });
  }

  function removeAbsence(id: string) {
    const ab = absences.find((x) => x.id === id);
    if (!ab) return;
    deleteAbsenceAction(id);
    const member = teamMembers.find((m) => m.id === ab.memberId);
    toast.success("Absence removed", {
      description: `${member?.name ?? ab.memberId} · ${ab.startDate} → ${ab.endDate}`,
    });
  }

  function saveMember(m: TeamMember) {
    const withProj: TeamMember = { ...m, projectId: m.projectId || activeProjectId };
    const exists = teamMembers.some((x) => x.id === withProj.id);
    if (exists) {
      updateTeamMember(withProj);
      toast.success("Member updated", { description: withProj.name });
    } else {
      addTeamMember(withProj);
      toast.success("Member added", { description: withProj.name });
    }
    setMemberDrawer({ mode: "closed" });
  }
  function deleteMember(id: string) {
    const target = teamMembers.find((m) => m.id === id);
    deleteTeamMemberAction(id);
    toast.success("Member deleted", { description: target?.name });
    setMemberDrawer({ mode: "closed" });
  }

  function saveMeeting(m: RecurringMeeting) {
    const withProj: RecurringMeeting = { ...m, projectId: m.projectId || activeProjectId };
    const exists = recurringMeetings.some((x) => x.id === withProj.id);
    if (exists) {
      updateMeetingAction(withProj);
      toast.success("Meeting updated", { description: withProj.name });
    } else {
      addMeetingAction(withProj);
      toast.success("Meeting added", { description: withProj.name });
    }
    setMeetingDrawer({ mode: "closed" });
  }
  function deleteMeeting(id: string) {
    const target = recurringMeetings.find((m) => m.id === id);
    deleteMeetingAction(id);
    toast.success("Meeting deleted", { description: target?.name });
    setMeetingDrawer({ mode: "closed" });
  }

  // Workstreams from this project's members + meetings, deduped
  const knownWorkstreams = Array.from(new Set([
    ...projectMembers.map((m) => m.workstream),
    ...projectMeetings.map((m) => m.workstream).filter((w): w is string => !!w),
  ])).filter((w) => w !== "Executive");

  return (
    <ResourcesContext.Provider value={{ absences: projectAbsences, addAbsence, removeAbsence, teamMembers: projectMembers, recurringMeetings: projectMeetings }}>
    <div className="space-y-4">
      {/* Tab bar with Add buttons inline */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {tab === "availability" && (
          <button
            onClick={() => setMemberDrawer({ mode: "new" })}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add Member
          </button>
        )}
        {tab === "cadence" && (
          <button
            onClick={() => setMeetingDrawer({ mode: "new" })}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Meeting
          </button>
        )}
      </div>

      {tab === "availability" && <TeamAvailabilityTab onEditMember={(m) => setMemberDrawer({ mode: "edit", member: m })} />}
      {tab === "cadence"      && <MeetingCadenceTab onEditMeeting={(m) => setMeetingDrawer({ mode: "edit", meeting: m })} />}
      {tab === "steerco"      && <SteerCoPreBriefTab />}
      {tab === "workstream"   && <WorkstreamPreBriefTab />}

      <TeamMemberFormDrawer
        open={memberDrawer.mode !== "closed"}
        initial={memberDrawer.mode === "edit" ? memberDrawer.member : null}
        allMembers={projectMembers}
        knownWorkstreams={knownWorkstreams}
        onSave={saveMember}
        onDelete={deleteMember}
        onClose={() => setMemberDrawer({ mode: "closed" })}
      />

      <MeetingFormDrawer
        open={meetingDrawer.mode !== "closed"}
        initial={meetingDrawer.mode === "edit" ? meetingDrawer.meeting : null}
        allMeetings={projectMeetings}
        teamMembers={projectMembers}
        knownWorkstreams={knownWorkstreams}
        onSave={saveMeeting}
        onDelete={deleteMeeting}
        onClose={() => setMeetingDrawer({ mode: "closed" })}
      />
    </div>
    </ResourcesContext.Provider>
  );
}
