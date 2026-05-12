"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type {
  RecurringMeeting, MeetingFrequency, AttendeeRole, MeetingAttendee, TeamMember,
} from "@/lib/mockData";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { SelectWithCustom } from "@/components/ui/select-with-custom";
import { isIsoDate, inProjectRange, PROJECT_DATE_MIN, PROJECT_DATE_MAX } from "@/lib/validation";

const TYPES: RecurringMeeting["type"][]   = ["steerco", "workstream", "governance"];
const FREQS: MeetingFrequency[]           = ["weekly", "bi-weekly", "monthly"];
const DAYS                                = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function nextMtgId(all: RecurringMeeting[]): string {
  const nums = all
    .map((m) => parseInt(m.id.replace(/^mtg/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `mtg${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

export function MeetingFormDrawer({
  open, initial, allMeetings, teamMembers, knownWorkstreams, onSave, onDelete, onClose,
}: {
  open: boolean;
  initial: RecurringMeeting | null;
  allMeetings: RecurringMeeting[];
  teamMembers: TeamMember[];
  knownWorkstreams: string[];
  onSave: (m: RecurringMeeting) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const [name,         setName]         = useState("");
  const [type,         setType]         = useState<RecurringMeeting["type"]>("workstream");
  const [workstream,   setWorkstream]   = useState("");
  const [frequency,    setFrequency]    = useState<MeetingFrequency>("weekly");
  const [dayOfWeek,    setDayOfWeek]    = useState("Tuesday");
  const [durationMins, setDurationMins] = useState(30);
  const [nextDate,     setNextDate]     = useState("");
  const [attendees,    setAttendees]    = useState<MeetingAttendee[]>([]);
  const [confirming,   setConfirming]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name                 ?? "");
    setType(initial?.type                 ?? "workstream");
    setWorkstream(initial?.workstream     ?? knownWorkstreams[0] ?? "");
    setFrequency(initial?.frequency       ?? "weekly");
    setDayOfWeek(initial?.dayOfWeek       ?? "Tuesday");
    setDurationMins(initial?.durationMins ?? 30);
    setNextDate(initial?.nextDate         ?? "");
    setAttendees(initial?.attendees       ?? []);
    setConfirming(false);
    setError(null);
  }, [open, initial, knownWorkstreams]);

  function toggleAttendee(memberId: string) {
    setAttendees((prev) => {
      const idx = prev.findIndex((a) => a.memberId === memberId);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { memberId, role: "mandatory" as AttendeeRole }];
    });
  }
  function setAttendeeRole(memberId: string, role: AttendeeRole) {
    setAttendees((prev) => prev.map((a) => a.memberId === memberId ? { ...a, role } : a));
  }

  function handleSave() {
    if (!name.trim())             { setError("Name is required"); return; }
    if (!nextDate)                { setError("Next date is required"); return; }
    if (!isIsoDate(nextDate))     { setError("Next date must be yyyy-mm-dd"); return; }
    if (!inProjectRange(nextDate)){ setError(`Next date must be between ${PROJECT_DATE_MIN} and ${PROJECT_DATE_MAX}`); return; }
    if (durationMins < 5)         { setError("Duration must be at least 5 minutes"); return; }
    if (attendees.length === 0)   { setError("At least one attendee is required"); return; }
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    if (nextDate < today) {
      toast.warning("Next date is in the past", { description: `${nextDate}` });
    }

    onSave({
      id: initial?.id ?? nextMtgId(allMeetings),
      name: name.trim(),
      type,
      ...(type === "workstream" && workstream.trim() ? { workstream: workstream.trim() } : {}),
      frequency,
      dayOfWeek,
      durationMins,
      nextDate,
      attendees,
      projectId: initial?.projectId ?? "",
    });
  }

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={isNew ? "Add meeting" : `Edit · ${initial?.name ?? ""}`}
      subtitle={isNew ? "Recurring meetings drive the SteerCo and Workstream pre-briefs. Mark mandatory attendees so conflicts surface against absences." : `${initial?.type} · ${initial?.frequency}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew ? (
            <button onClick={() => setConfirming(true)} disabled={confirming}
              className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">Cancel</button>
            <button onClick={handleSave} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              {isNew ? "Add meeting" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {confirming && initial ? (
        <ConfirmDelete label={`meeting "${initial.name}"`} onConfirm={() => onDelete(initial.id)} onCancel={() => setConfirming(false)} />
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <Field label="Name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vendor Sync" className={inputCls} autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value as RecurringMeeting["type"])} className={inputCls}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {type === "workstream" ? (
              <Field label="Workstream">
                <SelectWithCustom value={workstream} onChange={setWorkstream} options={knownWorkstreams} />
              </Field>
            ) : <div />}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Frequency">
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as MeetingFrequency)} className={inputCls}>
                {FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Day">
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={inputCls}>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Duration" hint="minutes">
              <input type="number" min={5} value={durationMins}
                onChange={(e) => setDurationMins(Math.max(5, Number(e.target.value) || 5))} className={inputCls} />
            </Field>
          </div>

          <Field label="Next date" required>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Attendees" required hint={`${attendees.length} selected · click a member to toggle, click M/O to switch role`}>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
              {teamMembers.length === 0 ? (
                <p className="px-1 py-2 text-xs italic text-muted-foreground">No team members defined yet.</p>
              ) : teamMembers.map((m) => {
                const att = attendees.find((a) => a.memberId === m.id);
                const selected = !!att;
                return (
                  <div key={m.id} className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleAttendee(m.id)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary" />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                      {m.initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                    {selected && att && (
                      <div className="flex gap-1">
                        {(["mandatory", "optional"] as AttendeeRole[]).map((r) => (
                          <button key={r} type="button" onClick={() => setAttendeeRole(m.id, r)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${att.role === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                            {r === "mandatory" ? "M" : "O"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Field>

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30">{error}</p>
          )}
        </form>
      )}
    </EntityDrawer>
  );
}
