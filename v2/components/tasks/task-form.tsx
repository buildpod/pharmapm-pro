"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Task, TaskStatus, TaskPriority, Milestone } from "@/lib/mockData";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { SelectWithCustom } from "@/components/ui/select-with-custom";
import { isIsoDate, inProjectRange, PROJECT_DATE_MIN, PROJECT_DATE_MAX } from "@/lib/validation";

const PRIORITIES: TaskPriority[] = ["Critical", "High", "Medium", "Low"];
const STATUSES:   TaskStatus[]   = ["Not Started", "In Progress", "Complete", "Blocked", "On Hold"];

function nextTaskId(all: Task[]): string {
  const nums = all
    .map((t) => parseInt(t.id.replace(/^t/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `t${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

export function TaskFormDrawer({
  open,
  initial,
  allTasks,
  allMilestones,
  knownWorkstreams,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  initial: Task | null;
  allTasks: Task[];
  allMilestones: Milestone[];
  knownWorkstreams: string[];
  onSave: (t: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;

  const [name,        setName]        = useState("");
  const [workstream,  setWorkstream]  = useState("");
  const [priority,    setPriority]    = useState<TaskPriority>("Medium");
  const [status,      setStatus]      = useState<TaskStatus>("Not Started");
  const [progress,    setProgress]    = useState<number>(0);
  const [milestoneId, setMilestoneId] = useState("");
  const [owner,       setOwner]       = useState("VP");
  const [dueDate,     setDueDate]     = useState("");
  const [dependsOn,   setDependsOn]   = useState<string[]>([]);

  const [confirming, setConfirming] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name             ?? "");
    setWorkstream(initial?.workstream  ?? knownWorkstreams[0] ?? "");
    setPriority(initial?.priority     ?? "Medium");
    setStatus(initial?.status         ?? "Not Started");
    setProgress(initial?.progress     ?? 0);
    setMilestoneId(initial?.milestoneId ?? "");
    setOwner(initial?.owner           ?? "VP");
    setDueDate(initial?.dueDate       ?? "");
    setDependsOn(initial?.dependsOn   ?? []);
    setConfirming(false);
    setError(null);
  }, [open, initial, knownWorkstreams]);

  function handleSave() {
    if (!name.trim())         { setError("Name is required"); return; }
    if (!workstream.trim())   { setError("Workstream is required"); return; }
    if (!dueDate)             { setError("Due date is required"); return; }
    if (!isIsoDate(dueDate))  { setError("Due date must be yyyy-mm-dd"); return; }
    if (!inProjectRange(dueDate)) {
      setError(`Due date must be between ${PROJECT_DATE_MIN} and ${PROJECT_DATE_MAX}`); return;
    }
    setError(null);

    // Duplicate-name detection (same workstream, case-insensitive, excluding self)
    const dup = allTasks.find(
      (t) =>
        t.id !== initial?.id &&
        t.workstream === workstream.trim() &&
        t.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (dup) {
      toast.warning("Duplicate task name in workstream", {
        description: `"${dup.name}" already exists in ${workstream}. Saving anyway.`,
      });
    }

    // Soft warnings — don't block save, just nudge
    if (milestoneId) {
      const ms = allMilestones.find((m) => m.id === milestoneId);
      if (ms && dueDate > ms.plannedDate) {
        toast.warning("Task due after its milestone", {
          description: `${ms.name} is planned for ${ms.plannedDate}`,
        });
      }
    }
    if (dependsOn.length > 0) {
      const laterDeps = dependsOn
        .map((id) => allTasks.find((t) => t.id === id))
        .filter((t): t is Task => !!t && t.dueDate > dueDate);
      if (laterDeps.length > 0) {
        toast.warning(`Due before ${laterDeps.length} upstream task${laterDeps.length > 1 ? "s" : ""}`, {
          description: laterDeps.map((t) => `${t.id.toUpperCase()} (${t.dueDate})`).join(", "),
        });
      }
    }

    const id = initial?.id ?? nextTaskId(allTasks);
    const clampedProgress = Math.max(0, Math.min(100, progress));
    // Auto-derive status from progress = 100 if status not already complete
    const derivedStatus: TaskStatus =
      clampedProgress === 100 ? "Complete"
      : clampedProgress > 0 && status === "Not Started" ? "In Progress"
      : status;

    const built: Task = {
      id,
      name: name.trim(),
      workstream: workstream.trim(),
      priority,
      status: derivedStatus,
      progress: clampedProgress,
      owner: owner.trim() || "VP",
      dueDate,
      ...(milestoneId ? { milestoneId } : {}),
      ...(dependsOn.length > 0 ? { dependsOn } : {}),
      projectId: initial?.projectId ?? "",
    };
    onSave(built);
  }

  function handleDelete() {
    if (initial) onDelete(initial.id);
  }

  function toggleDep(id: string) {
    setDependsOn((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const title    = isNew ? "Add task" : `Edit · ${initial?.name ?? ""}`;
  const subtitle = isNew
    ? "Tasks are grouped by workstream. Link to a milestone to roll-up progress."
    : `${initial?.id?.toUpperCase()} · ${initial?.workstream}`;

  // Dependency picker — exclude self
  const depCandidates = allTasks.filter((t) => t.id !== initial?.id);

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={confirming}
              className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {isNew ? "Add task" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {confirming && initial ? (
        <ConfirmDelete
          label={`task "${initial.name}"`}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        >
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Configure submission types — Module 1 / Module 3"
              className={inputCls}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Workstream" required>
              <SelectWithCustom value={workstream} onChange={setWorkstream} options={knownWorkstreams} />
            </Field>

            <Field label="Owner" hint="initials">
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value.toUpperCase().slice(0, 4))}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={inputCls}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={inputCls}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Progress" hint={`${progress}% (status auto-advances at 100%)`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Milestone" hint="links task to a milestone (optional)">
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className={inputCls}
              >
                <option value="">— none —</option>
                {allMilestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id.toUpperCase()} · {m.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Due date" required>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label="Depends on"
            hint={`${dependsOn.length} upstream task${dependsOn.length === 1 ? "" : "s"} selected`}
          >
            <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-0.5">
              {depCandidates.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground italic">
                  No other tasks to depend on yet.
                </p>
              ) : (
                depCandidates.map((t) => {
                  const checked = dependsOn.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDep(t.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                          {t.id.toUpperCase()}
                        </span>
                        <span className="ml-1.5 text-foreground">{t.name}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground">({t.workstream})</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </Field>

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30">
              {error}
            </p>
          )}
        </form>
      )}
    </EntityDrawer>
  );
}
