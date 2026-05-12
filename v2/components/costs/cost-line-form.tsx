"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { CostLine, ContractType } from "@/lib/mockData";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { SelectWithCustom } from "@/components/ui/select-with-custom";

const CONTRACTS: ContractType[] = ["T&M", "Fixed", "Internal"];

function nextCostId(all: CostLine[]): string {
  const nums = all
    .map((c) => parseInt(c.id.replace(/^c/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `c${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

export function CostLineFormDrawer({
  open, initial, allCostLines, knownCategories, onSave, onDelete, onClose,
}: {
  open: boolean;
  initial: CostLine | null;
  allCostLines: CostLine[];
  knownCategories: string[];
  onSave: (c: CostLine) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const [category,     setCategory]     = useState("");
  const [description,  setDescription]  = useState("");
  const [budgetK,      setBudgetK]      = useState(0);
  const [actualK,      setActualK]      = useState(0);
  const [contractType, setContractType] = useState<ContractType>("Fixed");
  const [owner,        setOwner]        = useState("VP");
  const [confirming,   setConfirming]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory(initial?.category         ?? knownCategories[0] ?? "Implementation");
    setDescription(initial?.description   ?? "");
    setBudgetK(initial?.budgetK           ?? 0);
    setActualK(initial?.actualK           ?? 0);
    setContractType(initial?.contractType ?? "Fixed");
    setOwner(initial?.owner               ?? "VP");
    setConfirming(false);
    setError(null);
  }, [open, initial, knownCategories]);

  function handleSave() {
    if (!category.trim())    { setError("Category is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }
    if (budgetK < 0)         { setError("Budget can't be negative"); return; }
    if (actualK < 0)         { setError("Actual can't be negative"); return; }
    setError(null);

    if (budgetK > 0 && actualK > budgetK) {
      toast.warning("Actual exceeds budget", {
        description: `$${actualK}k spent on a $${budgetK}k line (${Math.round((actualK / budgetK) * 100)}%)`,
      });
    }

    const id = initial?.id ?? nextCostId(allCostLines);
    onSave({
      id, category: category.trim(), description: description.trim(),
      budgetK, actualK, contractType, owner: owner.trim() || "VP",
      projectId: initial?.projectId ?? "", // parent grid overwrites with activeProjectId
    });
  }

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={isNew ? "Add cost line" : `Edit · ${initial?.description ?? ""}`}
      subtitle={isNew ? "Budget vs actual at the category level. Burn % auto-derives." : `${initial?.id?.toUpperCase()} · ${initial?.category}`}
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
              {isNew ? "Add cost line" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {confirming && initial ? (
        <ConfirmDelete label={`cost line "${initial.description}"`} onConfirm={() => onDelete(initial.id)} onCancel={() => setConfirming(false)} />
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <Field label="Description" required>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Veeva Vault configuration & development" className={inputCls} autoFocus />
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
            <Field label="Budget ($k)" hint="thousands">
              <input type="number" min={0} value={budgetK}
                onChange={(e) => setBudgetK(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
            </Field>
            <Field label="Actual ($k)" hint="spent to date">
              <input type="number" min={0} value={actualK}
                onChange={(e) => setActualK(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
            </Field>
            <Field label="Contract type">
              <select value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)} className={inputCls}>
                {CONTRACTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {error && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30">{error}</p>
          )}
        </form>
      )}
    </EntityDrawer>
  );
}
