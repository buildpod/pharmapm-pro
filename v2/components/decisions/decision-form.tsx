"use client";

// M25 — Decision edit drawer.

import { useState, useEffect } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { useEntityStore } from "@/lib/stores/entity-store";
import { useProject } from "@/components/projects/project-provider";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import {
  type DecisionRecord, type DecisionRecordStatus,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

const STATUSES: DecisionRecordStatus[] = ["Pending", "Approved", "Rejected", "Superseded"];

function nextDecisionId(all: DecisionRecord[]): string {
  const nums = all
    .map((d) => parseInt(d.id.replace(/^d/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `d${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

export function DecisionFormDrawer({
  open,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  initial: DecisionRecord | null;
  onSave: (d: DecisionRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const { activeProjectId } = useProject();

  const decisions  = useEntityStore((s) => s.decisionRecords).filter((d) => d.projectId === activeProjectId);
  const milestones = useEntityStore((s) => s.milestones).filter((m) => m.projectId === activeProjectId);
  const risks      = useEntityStore((s) => s.risks).filter((r) => r.projectId === activeProjectId);
  const issues     = useEntityStore((s) => s.issues).filter((i) => i.projectId === activeProjectId);

  const [title,        setTitle]        = useState("");
  const [context,      setContext]      = useState("");
  const [decidedDate,  setDecidedDate]  = useState("");
  const [decidedBy,    setDecidedBy]    = useState("VP");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [chosenOption, setChosenOption] = useState("");
  const [rationale,    setRationale]    = useState("");
  const [status,       setStatus]       = useState<DecisionRecordStatus>("Pending");
  const [supersedesId, setSupersedesId] = useState("");
  const [milestoneId,  setMilestoneId]  = useState("");
  const [riskId,       setRiskId]       = useState("");
  const [issueId,      setIssueId]      = useState("");
  const [confirming,   setConfirming]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setContext(initial?.context ?? "");
    setDecidedDate(initial?.decidedDate ?? new Date().toISOString().slice(0, 10));
    setDecidedBy(initial?.decidedBy ?? "VP");
    setAlternatives(initial?.alternatives ?? []);
    setChosenOption(initial?.chosenOption ?? "");
    setRationale(initial?.rationale ?? "");
    setStatus(initial?.status ?? "Pending");
    setSupersedesId(initial?.supersedesId ?? "");
    setMilestoneId(initial?.linkedMilestoneId ?? "");
    setRiskId(initial?.linkedRiskId ?? "");
    setIssueId(initial?.linkedIssueId ?? "");
    setConfirming(false);
    setError(null);
  }, [open, initial]);

  function handleSave() {
    // Validation per error-message-pattern skill
    if (!title.trim())         { setError("Add a short title so the decision is identifiable in the register."); return; }
    if (!context.trim())       { setError("Explain why this decision was needed — context for future reviewers."); return; }
    if (!decidedDate)          { setError("Pick the date this decision was made."); return; }
    if (!chosenOption.trim())  { setError("Record which option was chosen."); return; }
    if (!rationale.trim())     { setError("Explain why this option was chosen over the alternatives — audit-trail requirement."); return; }
    setError(null);

    const id = initial?.id ?? nextDecisionId(decisions);
    const built: DecisionRecord = {
      id,
      title: title.trim(),
      context: context.trim(),
      decidedDate,
      decidedBy: decidedBy.trim() || "VP",
      alternatives: alternatives.map((s) => s.trim()).filter(Boolean),
      chosenOption: chosenOption.trim(),
      rationale: rationale.trim(),
      status,
      ...(supersedesId ? { supersedesId } : {}),
      ...(milestoneId  ? { linkedMilestoneId: milestoneId } : {}),
      ...(riskId       ? { linkedRiskId: riskId } : {}),
      ...(issueId      ? { linkedIssueId: issueId } : {}),
      projectId: initial?.projectId ?? activeProjectId,
    };
    onSave(built);
  }

  function handleDeleteClick() {
    if (initial) onDelete(initial.id);
  }

  function updateAlt(i: number, value: string) {
    setAlternatives(alternatives.map((x, idx) => (idx === i ? value : x)));
  }
  function removeAlt(i: number) {
    setAlternatives(alternatives.filter((_, idx) => idx !== i));
  }
  function addAlt() {
    setAlternatives([...alternatives, ""]);
  }

  const titleLabel    = isNew ? "Record decision" : `Edit · ${initial?.title ?? ""}`;
  const subtitleLabel = isNew
    ? "A material decision on this project. Required fields are marked."
    : initial?.id?.toUpperCase();

  // Exclude the current decision from the supersedes-picker
  const supersedesCandidates = decisions.filter((d) => d.id !== initial?.id);

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={titleLabel}
      subtitle={subtitleLabel}
      footer={
        confirming ? (
          <ConfirmDelete
            label="Delete this decision permanently?"
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
                {isNew ? "Record decision" : "Save changes"}
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
            placeholder="e.g. Selected Iron Mountain as data-extraction vendor"
          />
        </Field>

        <Field label="Context" required hint="Why was this decision needed? What was the situation?">
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            className={cn(inputCls, "min-h-[70px]")}
            placeholder="What problem was being solved, what triggered the decision."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Decided on" required>
            <input
              type="date"
              value={decidedDate}
              onChange={(e) => setDecidedDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Decided by" required hint="Initials of the decision-maker.">
            <input
              type="text"
              value={decidedBy}
              onChange={(e) => setDecidedBy(e.target.value)}
              className={inputCls}
              placeholder="e.g. VP, QA, KM"
              maxLength={4}
            />
          </Field>
        </div>

        {/* Alternatives — list of strings */}
        <Field label="Alternatives considered" hint="The options that were on the table. One per row.">
          <div className="space-y-1.5">
            {alternatives.length === 0 && (
              <p className="text-[11px] italic text-muted-foreground">No alternatives recorded yet.</p>
            )}
            {alternatives.map((alt, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <input
                  type="text"
                  value={alt}
                  onChange={(e) => updateAlt(i, e.target.value)}
                  className={cn(inputCls, "text-xs")}
                  placeholder="e.g. Vendor A — fixed price $0.35M, 6-week delivery"
                />
                <button
                  type="button"
                  onClick={() => removeAlt(i)}
                  className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Remove this alternative"
                  aria-label="Remove alternative"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addAlt}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add alternative
            </button>
          </div>
        </Field>

        <Field label="Chosen option" required hint="The option that won.">
          <input
            type="text"
            value={chosenOption}
            onChange={(e) => setChosenOption(e.target.value)}
            className={inputCls}
            placeholder="e.g. Iron Mountain"
          />
        </Field>

        <Field label="Rationale" required hint="Why this option, not the others. Audit-trail requirement.">
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            className={cn(inputCls, "min-h-[70px]")}
            placeholder="What tipped the decision. Useful in 6 months when someone asks why."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DecisionRecordStatus)}
              className={inputCls}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Supersedes" hint="Optional — pick a prior decision this one overrides.">
            <select
              value={supersedesId}
              onChange={(e) => setSupersedesId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {supersedesCandidates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id.toUpperCase()} · {d.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Linkage to other entities */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Linked milestone">
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.id.toUpperCase()} · {m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Linked risk">
            <select
              value={riskId}
              onChange={(e) => setRiskId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {risks.map((r) => (
                <option key={r.id} value={r.id}>{r.id.toUpperCase()} · {r.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Linked issue">
            <select
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              className={inputCls}
            >
              <option value="">— None —</option>
              {issues.map((i) => (
                <option key={i.id} value={i.id}>{i.id.toUpperCase()} · {i.title}</option>
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
