"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { TeamMember, SteerCoRole } from "@/lib/mockData";
import { EntityDrawer, ConfirmDelete, Field, inputCls } from "@/components/ui/entity-drawer";
import { SelectWithCustom } from "@/components/ui/select-with-custom";

function nextTmId(all: TeamMember[]): string {
  const nums = all
    .map((m) => parseInt(m.id.replace(/^tm/, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `tm${(nums.length > 0 ? Math.max(...nums) : 0) + 1}`;
}

function initialsFromName(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 4);
}

export function TeamMemberFormDrawer({
  open, initial, allMembers, knownWorkstreams, onSave, onDelete, onClose,
}: {
  open: boolean;
  initial: TeamMember | null;
  allMembers: TeamMember[];
  knownWorkstreams: string[];
  onSave: (m: TeamMember) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const isNew = initial === null;
  const [name,        setName]        = useState("");
  const [initials,    setInitials]    = useState("");
  const [role,        setRole]        = useState("");
  const [workstream,  setWorkstream]  = useState("");
  const [steercoRole, setSteercoRole] = useState<SteerCoRole | "">("");
  const [confirming,  setConfirming]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name             ?? "");
    setInitials(initial?.initials     ?? "");
    setRole(initial?.role             ?? "");
    setWorkstream(initial?.workstream ?? knownWorkstreams[0] ?? "Configuration");
    setSteercoRole(initial?.steercoRole ?? "");
    setConfirming(false);
    setError(null);
  }, [open, initial, knownWorkstreams]);

  function handleSave() {
    if (!name.trim())       { setError("Name is required"); return; }
    if (!role.trim())       { setError("Role is required"); return; }
    if (!workstream.trim()) { setError("Workstream is required"); return; }
    const finalInitials = initials.trim() || initialsFromName(name);
    if (!finalInitials)     { setError("Could not derive initials"); return; }

    // Soft warn on initials collision (excluding self)
    const collision = allMembers.find((m) => m.initials === finalInitials && m.id !== initial?.id);
    if (collision) {
      toast.warning("Initials already in use", { description: `${collision.name} also uses "${finalInitials}"` });
    }

    setError(null);
    onSave({
      id: initial?.id ?? nextTmId(allMembers),
      name: name.trim(),
      initials: finalInitials,
      role: role.trim(),
      workstream: workstream.trim(),
      ...(steercoRole ? { steercoRole } : {}),
      projectId: initial?.projectId ?? "",
    });
  }

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={isNew ? "Add team member" : `Edit · ${initial?.name ?? ""}`}
      subtitle={isNew ? "Members appear on the availability calendar, can be assigned to meetings, and can own tasks/risks/milestones via their initials." : `${initial?.initials} · ${initial?.role}`}
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
              {isNew ? "Add member" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {confirming && initial ? (
        <ConfirmDelete label={`team member "${initial.name}"`} onConfirm={() => onDelete(initial.id)} onCancel={() => setConfirming(false)} />
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <Field label="Full name" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria Costa" className={inputCls} autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Initials" hint="auto from name if blank">
              <input type="text" value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
                placeholder={initialsFromName(name) || "—"} className={inputCls} />
            </Field>
            <Field label="Role" required>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Validation Engineer" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Workstream" required>
              <SelectWithCustom
                value={workstream}
                onChange={setWorkstream}
                options={Array.from(new Set([...knownWorkstreams, "Executive"]))}
              />
            </Field>
            <Field label="SteerCo role">
              <select value={steercoRole} onChange={(e) => setSteercoRole(e.target.value as SteerCoRole | "")} className={inputCls}>
                <option value="">— not on SteerCo —</option>
                <option value="mandatory">Mandatory</option>
                <option value="optional">Optional</option>
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
