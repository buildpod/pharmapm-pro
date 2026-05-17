"use client";

import { useState, useEffect } from "react";
import { EntityDrawer, Field, inputCls } from "@/components/ui/entity-drawer";
import { type Charter, type CharterStatus } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

const STATUSES: CharterStatus[] = ["draft", "submitted", "approved"];

const STATUS_LABEL: Record<CharterStatus, string> = {
  draft:     "Draft",
  submitted: "Submitted for approval",
  approved:  "Approved",
};

export function CharterFormDrawer({
  open,
  initial,
  projectId,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: Charter | null;
  projectId: string;
  onSave: (c: Charter) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;

  const [purpose,            setPurpose]            = useState("");
  const [objectives,         setObjectives]         = useState<string[]>([]);
  const [inScope,            setInScope]            = useState<string[]>([]);
  const [outOfScope,         setOutOfScope]         = useState<string[]>([]);
  const [successCriteria,    setSuccessCriteria]    = useState<string[]>([]);
  const [assumptions,        setAssumptions]        = useState<string[]>([]);
  const [constraints,        setConstraints]        = useState<string[]>([]);
  const [sponsor,            setSponsor]            = useState("");
  const [projectManager,     setProjectManager]     = useState("");
  const [budgetSummary,      setBudgetSummary]      = useState("");
  const [status,             setStatus]             = useState<CharterStatus>("draft");
  const [approvedBy,         setApprovedBy]         = useState("");
  const [approvedDate,       setApprovedDate]       = useState("");
  const [error,              setError]              = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPurpose(initial?.purpose ?? "");
    setObjectives(initial?.objectives ?? []);
    setInScope(initial?.inScope ?? []);
    setOutOfScope(initial?.outOfScope ?? []);
    setSuccessCriteria(initial?.successCriteria ?? []);
    setAssumptions(initial?.assumptions ?? []);
    setConstraints(initial?.constraints ?? []);
    setSponsor(initial?.sponsor ?? "");
    setProjectManager(initial?.projectManager ?? "");
    setBudgetSummary(initial?.budgetSummary ?? "");
    setStatus(initial?.status ?? "draft");
    setApprovedBy(initial?.approvedBy ?? "");
    setApprovedDate(initial?.approvedDate ?? "");
    setError(null);
  }, [open, initial]);

  function handleSave() {
    // Required-field validation. Per error-message-pattern skill:
    // what / why / next — each error names the missing field and tells the
    // user what to do.
    if (!purpose.trim())          { setError("Add a purpose statement before saving."); return; }
    if (!sponsor.trim())          { setError("Sponsor is required — every charter needs an executive owner."); return; }
    if (!projectManager.trim())   { setError("Project manager is required."); return; }
    if (status === "approved" && (!approvedBy.trim() || !approvedDate)) {
      setError("Approved charters need both an approver name and the approval date.");
      return;
    }
    setError(null);

    const built: Charter = {
      id: initial?.id ?? `charter-${projectId}`,
      projectId,
      purpose: purpose.trim(),
      objectives: objectives.map((s) => s.trim()).filter(Boolean),
      inScope: inScope.map((s) => s.trim()).filter(Boolean),
      outOfScope: outOfScope.map((s) => s.trim()).filter(Boolean),
      successCriteria: successCriteria.map((s) => s.trim()).filter(Boolean),
      assumptions: assumptions.map((s) => s.trim()).filter(Boolean),
      constraints: constraints.map((s) => s.trim()).filter(Boolean),
      sponsor: sponsor.trim(),
      projectManager: projectManager.trim(),
      budgetSummary: budgetSummary.trim(),
      status,
      ...(status === "approved" ? {
        approvedBy: approvedBy.trim(),
        approvedDate,
      } : {}),
      lastUpdated: initial?.lastUpdated ?? new Date().toISOString().slice(0, 10),
    };
    onSave(built);
  }

  const title    = isNew ? "Create charter" : "Edit charter";
  const subtitle = isNew
    ? "The authorising document for this project. Required fields are marked."
    : `Last updated ${initial?.lastUpdated ?? "—"}`;

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex items-center justify-end gap-2">
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
            {isNew ? "Create charter" : "Save changes"}
          </button>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Field label="Purpose" required hint="One to three short paragraphs framing why this project exists.">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={5}
            className={cn(inputCls, "min-h-[100px]")}
            placeholder="What problem does this project solve, and why now?"
          />
        </Field>

        <ListField label="Objectives" hint="Measurable outcomes. One per line." items={objectives} onChange={setObjectives} placeholder="e.g. Migrate 14,200 dossiers by 2026-08-15" />

        <div className="grid gap-4 sm:grid-cols-2">
          <ListField label="In scope" items={inScope} onChange={setInScope} placeholder="e.g. Document workflows" />
          <ListField label="Out of scope" items={outOfScope} onChange={setOutOfScope} placeholder="e.g. QMS integration" />
        </div>

        <ListField label="Success criteria" hint="How will you know it worked?" items={successCriteria} onChange={setSuccessCriteria} placeholder="e.g. Migration completeness ≥ 99.5%" />

        <div className="grid gap-4 sm:grid-cols-2">
          <ListField label="Assumptions" items={assumptions} onChange={setAssumptions} placeholder="e.g. Vendor provides 2 consultants" />
          <ListField label="Constraints" items={constraints} onChange={setConstraints} placeholder="e.g. Go-live locked at 2026-09-02" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sponsor" required>
            <input
              type="text"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              className={inputCls}
              placeholder="e.g. Dr Margaret Chen, VP Regulatory Affairs"
            />
          </Field>
          <Field label="Project manager" required>
            <input
              type="text"
              value={projectManager}
              onChange={(e) => setProjectManager(e.target.value)}
              className={inputCls}
              placeholder="e.g. Vineet Pathak"
            />
          </Field>
        </div>

        <Field label="Budget summary" hint="One line — total, breakdown, contingency.">
          <input
            type="text"
            value={budgetSummary}
            onChange={(e) => setBudgetSummary(e.target.value)}
            className={inputCls}
            placeholder="e.g. $1.85M total · $1.20M vendor · $0.45M internal · $0.20M contingency"
          />
        </Field>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CharterStatus)}
            className={inputCls}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>

        {status === "approved" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Approved by" required>
              <input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className={inputCls}
                placeholder="Sponsor name as it appears on the signoff"
              />
            </Field>
            <Field label="Approval date" required>
              <input
                type="date"
                value={approvedDate}
                onChange={(e) => setApprovedDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}
      </form>
    </EntityDrawer>
  );
}

// ─── List-of-strings field with add / remove ─────────────────────────────────

function ListField({
  label, hint, items, onChange, placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  function updateAt(i: number, value: string) {
    onChange(items.map((x, idx) => (idx === i ? value : x)));
  }
  function removeAt(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function addOne() {
    onChange([...items, ""]);
  }
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-1.5">
        {items.length === 0 && (
          <p className="text-[11px] italic text-muted-foreground">Nothing added yet.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <input
              type="text"
              value={item}
              onChange={(e) => updateAt(i, e.target.value)}
              className={cn(inputCls, "text-xs")}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Remove this entry"
              aria-label="Remove entry"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addOne}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add entry
        </button>
      </div>
    </Field>
  );
}
