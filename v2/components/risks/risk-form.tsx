"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { Risk, RiskStatus } from "@/lib/mockData";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { SelectWithCustom } from "@/components/ui/select-with-custom";

const STATUSES: RiskStatus[] = ["open", "mitigated", "closed"];
const SCALE = [1, 2, 3, 4, 5];

function nextRiskId(all: Risk[]): string {
  const nums = all
    .map((r) => parseInt(r.id.replace(/^r/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `r${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

export function RiskFormDrawer({
  open, initial, allRisks, knownCategories, onSave, onDelete, onClose,
}: {
  open: boolean;
  initial: Risk | null;
  allRisks: Risk[];
  knownCategories: string[];
  onSave: (r: Risk) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const [title,       setTitle]       = useState("");
  const [category,    setCategory]    = useState("");
  const [probability, setProbability] = useState(3);
  const [impact,      setImpact]      = useState(3);
  const [status,      setStatus]      = useState<RiskStatus>("open");
  const [owner,       setOwner]       = useState("VP");
  const [mitigation,  setMitigation]  = useState("");
  const [confirming,  setConfirming]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title             ?? "");
    setCategory(initial?.category       ?? knownCategories[0] ?? "Technical");
    setProbability(initial?.probability ?? 3);
    setImpact(initial?.impact           ?? 3);
    setStatus(initial?.status           ?? "open");
    setOwner(initial?.owner             ?? "VP");
    setMitigation(initial?.mitigation   ?? "");
    setConfirming(false);
    setError(null);
  }, [open, initial, knownCategories]);

  const score = probability * impact;

  function handleSave() {
    if (!title.trim())      { setError("Title is required"); return; }
    if (!category.trim())   { setError("Category is required"); return; }
    if (!mitigation.trim()) { setError("Mitigation strategy is required"); return; }
    setError(null);
    const id = initial?.id ?? nextRiskId(allRisks);
    onSave({
      id,
      title: title.trim(),
      category: category.trim(),
      probability,
      impact,
      score,
      status,
      owner: owner.trim() || "VP",
      mitigation: mitigation.trim(),
      projectId: initial?.projectId ?? "", // parent grid overwrites with activeProjectId
    });
  }

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={isNew ? "Add risk" : `Edit · ${initial?.title ?? ""}`}
      subtitle={isNew ? "Risks are scored Probability × Impact. ≥15 = High, 8–14 = Medium, <8 = Low." : `${initial?.id?.toUpperCase()} · ${initial?.category}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {!isNew ? (
            <button onClick={() => setConfirming(true)} disabled={confirming}
              className="flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">Cancel</button>
            <button onClick={handleSave} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
              {isNew ? "Add risk" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {confirming && initial ? (
        <ConfirmDelete label={`risk "${initial.title}"`} onConfirm={() => onDelete(initial.id)} onCancel={() => setConfirming(false)} />
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <Field label="Title" required>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Veeva Vault upgrade mid-project" className={inputCls} autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" required>
              <SelectWithCustom value={category} onChange={setCategory} options={knownCategories} />
            </Field>
            <Field label="Owner" hint="initials">
              <input type="text" value={owner} onChange={(e) => setOwner(e.target.value.toUpperCase().slice(0, 4))} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Probability" hint="1 (rare) – 5 (certain)">
              <select value={probability} onChange={(e) => setProbability(Number(e.target.value))} className={inputCls}>
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Impact" hint="1 (low) – 5 (severe)">
              <select value={impact} onChange={(e) => setImpact(Number(e.target.value))} className={inputCls}>
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Score" hint="P × I (auto)">
              <div className={`${inputCls} flex items-center justify-center text-base font-bold tabular-nums ${score >= 15 ? "text-rose-600" : score >= 8 ? "text-amber-600" : "text-emerald-600"}`}>
                {score}
              </div>
            </Field>
          </div>

          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as RiskStatus)} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Mitigation strategy" required hint="What you're doing about it">
            <textarea value={mitigation} onChange={(e) => setMitigation(e.target.value)} rows={3}
              placeholder="e.g. Engage specialist vendor; add 2-week buffer" className={inputCls} />
          </Field>

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30">{error}</p>
          )}
        </form>
      )}
    </EntityDrawer>
  );
}
