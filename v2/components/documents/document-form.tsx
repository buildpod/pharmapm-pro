"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, Plus, X } from "lucide-react";
import type { Document, DocumentPhase, DocumentStatus, Decision } from "@/lib/mockData";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { SelectWithCustom } from "@/components/ui/select-with-custom";
import { isIsoDate, inProjectRange, PROJECT_DATE_MIN, PROJECT_DATE_MAX } from "@/lib/validation";

const PHASES: DocumentPhase[] = ["Planning", "Configuration", "Validation", "Training", "Go-Live"];
const STATUSES: DocumentStatus[] = ["draft", "in-review", "reviewed", "approved", "rejected"];

function nextDocId(all: Document[]): string {
  const nums = all
    .map((d) => parseInt(d.id.replace(/^d/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `d${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

function initialsFromName(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 4);
}

// People-list editor — used for both reviewers and approvers.
function PeopleList({
  label, people, onChange,
}: {
  label: string;
  people: Decision[];
  onChange: (next: Decision[]) => void;
}) {
  const [newPerson, setNewPerson] = useState("");
  const [newRole, setNewRole]     = useState("");

  function add() {
    const person = newPerson.trim();
    if (!person) return;
    onChange([
      ...people,
      { person, initials: initialsFromName(person) || "??", role: newRole.trim() || "Reviewer", status: "pending" },
    ]);
    setNewPerson(""); setNewRole("");
  }

  function remove(i: number) {
    onChange(people.filter((_, idx) => idx !== i));
  }

  return (
    <Field label={label} hint={`${people.length} ${label.toLowerCase()}`}>
      <div className="space-y-2 rounded-md border border-border bg-background p-2">
        {people.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-muted-foreground">None yet.</p>
        ) : (
          people.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                {p.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{p.person}</span>
              <span className="shrink-0 text-muted-foreground">{p.role}</span>
              <button onClick={() => remove(i)} className="rounded p-0.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" title="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <input type="text" value={newPerson} onChange={(e) => setNewPerson(e.target.value)}
            placeholder="Person name" className={`${inputCls} flex-1 min-w-0 py-1 text-xs`} />
          <input type="text" value={newRole} onChange={(e) => setNewRole(e.target.value)}
            placeholder="Role" className={`${inputCls} w-24 py-1 text-xs`} />
          <button type="button" onClick={add}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>
    </Field>
  );
}

export function DocumentFormDrawer({
  open, initial, allDocuments, knownTypes, onSave, onDelete, onClose,
}: {
  open: boolean;
  initial: Document | null;
  allDocuments: Document[];
  knownTypes: string[];
  onSave: (d: Document) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const [name,         setName]         = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [type,         setType]         = useState("");
  const [phase,        setPhase]        = useState<DocumentPhase>("Configuration");
  const [version,      setVersion]      = useState("1.0");
  const [status,       setStatus]       = useState<DocumentStatus>("draft");
  const [dueDate,      setDueDate]      = useState("");
  const [description,  setDescription]  = useState("");
  const [owner,        setOwner]        = useState("VP");
  const [reviewers,    setReviewers]    = useState<Decision[]>([]);
  const [approvers,    setApprovers]    = useState<Decision[]>([]);
  const [confirming,   setConfirming]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name                 ?? "");
    setAbbreviation(initial?.abbreviation ?? "");
    setType(initial?.type                 ?? knownTypes[0] ?? "Validation");
    setPhase(initial?.phase               ?? "Configuration");
    setVersion(initial?.version           ?? "1.0");
    setStatus(initial?.status             ?? "draft");
    setDueDate(initial?.dueDate           ?? "");
    setDescription(initial?.description   ?? "");
    setOwner(initial?.owner               ?? "VP");
    setReviewers(initial?.reviewers       ?? []);
    setApprovers(initial?.approvers       ?? []);
    setConfirming(false);
    setError(null);
  }, [open, initial, knownTypes]);

  function handleSave() {
    if (!name.trim())             { setError("Name is required"); return; }
    if (!type.trim())             { setError("Type is required"); return; }
    if (!dueDate)                 { setError("Due date is required"); return; }
    if (!isIsoDate(dueDate))      { setError("Due date must be yyyy-mm-dd"); return; }
    if (!inProjectRange(dueDate)) { setError(`Due date must be between ${PROJECT_DATE_MIN} and ${PROJECT_DATE_MAX}`); return; }
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    if (dueDate < today) {
      toast.warning("Due date is in the past", { description: `Due ${dueDate}` });
    }

    const id = initial?.id ?? nextDocId(allDocuments);
    onSave({
      id, name: name.trim(),
      ...(abbreviation.trim() ? { abbreviation: abbreviation.trim() } : {}),
      type: type.trim(), phase, version: version.trim() || "1.0",
      status, dueDate,
      ...(description.trim() ? { description: description.trim() } : {}),
      owner: owner.trim() || "VP",
      reviewers, approvers,
      projectId: initial?.projectId ?? "",
    });
  }

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={isNew ? "Add document" : `Edit · ${initial?.name ?? ""}`}
      subtitle={isNew ? "Lifecycle artefact grouped by phase. Status auto-derives once reviewers/approvers are added." : `${initial?.id?.toUpperCase()} · ${initial?.phase}`}
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
              {isNew ? "Add document" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {confirming && initial ? (
        <ConfirmDelete label={`document "${initial.name}"`} onConfirm={() => onDelete(initial.id)} onCancel={() => setConfirming(false)} />
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <Field label="Name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Functional Requirements Specification" className={inputCls} autoFocus />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Abbreviation" hint="short code">
              <input type="text" value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="FRS" className={inputCls} />
            </Field>
            <Field label="Type" required>
              <SelectWithCustom value={type} onChange={setType} options={knownTypes} />
            </Field>
            <Field label="Version">
              <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Owner (Responsible)" required hint="initials — who is delivering this document">
            <input type="text" value={owner}
              onChange={(e) => setOwner(e.target.value.toUpperCase().slice(0, 4))}
              className={inputCls} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Phase">
              <select value={phase} onChange={(e) => setPhase(e.target.value as DocumentPhase)} className={inputCls}>
                {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as DocumentStatus)} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Due date" required>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Description" hint="short plain-language summary">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="e.g. Detailed functional behaviour the configured system must satisfy." className={inputCls} />
          </Field>

          <PeopleList label="Reviewers (Consulted)" people={reviewers} onChange={setReviewers} />
          <PeopleList label="Approvers (Accountable)" people={approvers} onChange={setApprovers} />

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30">{error}</p>
          )}
        </form>
      )}
    </EntityDrawer>
  );
}
