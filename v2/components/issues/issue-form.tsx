"use client";

// M24 — Issue edit drawer.

import { useState, useEffect } from "react";
import { useEntityStore } from "@/lib/stores/entity-store";
import { useProject } from "@/components/projects/project-provider";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { Trash2 } from "lucide-react";
import {
  type Issue, type IssueSeverity, type IssueStatus,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

const SEVERITIES: IssueSeverity[] = ["Critical", "High", "Medium", "Low"];
const STATUSES:   IssueStatus[]   = ["Open", "In Progress", "Resolved", "Won't Fix"];

function nextIssueId(all: Issue[]): string {
  const nums = all
    .map((i) => parseInt(i.id.replace(/^i/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `i${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

export function IssueFormDrawer({
  open,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  initial: Issue | null;
  onSave: (it: Issue) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const { activeProjectId } = useProject();
  const issues       = useEntityStore((s) => s.issues);
  const milestones   = useEntityStore((s) => s.milestones).filter((m) => m.projectId === activeProjectId);
  const tasks        = useEntityStore((s) => s.tasks).filter((t) => t.projectId === activeProjectId);

  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [raisedDate,     setRaisedDate]     = useState("");
  const [severity,       setSeverity]       = useState<IssueSeverity>("Medium");
  const [status,         setStatus]         = useState<IssueStatus>("Open");
  const [owner,          setOwner]          = useState("VP");
  const [resolutionPlan, setResolutionPlan] = useState("");
  const [resolvedDate,   setResolvedDate]   = useState("");
  const [milestoneId,    setMilestoneId]    = useState("");
  const [taskId,         setTaskId]         = useState("");
  const [confirming,     setConfirming]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setRaisedDate(initial?.raisedDate ?? new Date().toISOString().slice(0, 10));
    setSeverity(initial?.severity ?? "Medium");
    setStatus(initial?.status ?? "Open");
    setOwner(initial?.owner ?? "VP");
    setResolutionPlan(initial?.resolutionPlan ?? "");
    setResolvedDate(initial?.resolvedDate ?? "");
    setMilestoneId(initial?.milestoneId ?? "");
    setTaskId(initial?.taskId ?? "");
    setConfirming(false);
    setError(null);
  }, [open, initial]);

  function handleSave() {
    // Validation — per error-message-pattern skill: what / why / next
    if (!title.trim()) { setError("Add a short title so the issue is identifiable in the register."); return; }
    if (!description.trim()) { setError("Add a description so reviewers understand what's happening without asking."); return; }
    if (!raisedDate) { setError("Pick the date the issue was raised."); return; }
    const isResolved = status === "Resolved" || status === "Won't Fix";
    if (isResolved && !resolvedDate) {
      setError("Pick the date this issue was resolved. Audit trail needs both raised and resolved dates.");
      return;
    }
    setError(null);

    const id = initial?.id ?? nextIssueId(issues);
    const built: Issue = {
      id,
      title: title.trim(),
      description: description.trim(),
      raisedDate,
      severity,
      status,
      owner: owner.trim() || "VP",
      ...(resolutionPlan.trim() ? { resolutionPlan: resolutionPlan.trim() } : {}),
      ...(isResolved && resolvedDate ? { resolvedDate } : {}),
      ...(milestoneId ? { milestoneId } : {}),
      ...(taskId ? { taskId } : {}),
      projectId: initial?.projectId ?? activeProjectId,
    };
    onSave(built);
  }

  function handleDeleteClick() {
    if (initial) onDelete(initial.id);
  }

  const titleLabel    = isNew ? "Raise issue" : `Edit · ${initial?.title ?? ""}`;
  const subtitleLabel = isNew
    ? "A live problem affecting the project. Required fields are marked."
    : initial?.id?.toUpperCase();

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={titleLabel}
      subtitle={subtitleLabel}
      footer={
        confirming ? (
          <ConfirmDelete
            label="Delete this issue permanently?"
            onConfirm={handleDeleteClick}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
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
                {isNew ? "Raise issue" : "Save changes"}
              </button>
            </div>
          </div>
        )
      }
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Field label="Title" required hint="Short identifier — the row label in the register.">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="e.g. UAT environment provisioning delayed by 9 days"
          />
        </Field>

        <Field label="Description" required hint="What is happening, what's the blocking impact, what evidence have you collected.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={cn(inputCls, "min-h-[80px]")}
            placeholder="Enough context that a reviewer doesn't need to message you for details."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raised date" required>
            <input
              type="date"
              value={raisedDate}
              onChange={(e) => setRaisedDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Owner" required>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={inputCls}
              placeholder="e.g. KM, AR, VP"
              maxLength={4}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Severity">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
              className={inputCls}
            >
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              className={inputCls}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Resolution plan" hint="What's being done about it. Visible to all reviewers.">
          <textarea
            value={resolutionPlan}
            onChange={(e) => setResolutionPlan(e.target.value)}
            rows={3}
            className={cn(inputCls, "min-h-[60px]")}
            placeholder="e.g. Escalated to vendor; mitigation in progress; expected by 2026-05-22."
          />
        </Field>

        {(status === "Resolved" || status === "Won't Fix") && (
          <Field label="Resolved date" required hint="The date this issue was closed out.">
            <input
              type="date"
              value={resolvedDate}
              onChange={(e) => setResolvedDate(e.target.value)}
              className={inputCls}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Linked milestone" hint="Optional.">
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id.toUpperCase()} · {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Linked task" hint="Optional.">
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id.toUpperCase()} · {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
      </form>
    </EntityDrawer>
  );
}
