"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Check, ExternalLink, Trash2 } from "lucide-react";
import { useProject } from "@/components/projects/project-provider";
import { ExportButton } from "@/components/projects/export-button";
import { Field, inputCls, ConfirmDelete } from "@/components/ui/entity-drawer";
import { isIsoDate, inProjectRange, PROJECT_DATE_MIN, PROJECT_DATE_MAX } from "@/lib/validation";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const { projects, activeProjectId, setActiveProjectId, createProject, deleteProject } = useProject();
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName]                 = useState("");
  const [client, setClient]             = useState("");
  const [phase, setPhase]               = useState("Initiation");
  const [startDate, setStartDate]       = useState("");
  const [goLiveDate, setGoLiveDate]     = useState("");
  const [methodology, setMethodology]   = useState("GAMP 5 / CSV");
  const [error, setError]               = useState<string | null>(null);

  function resetForm() {
    setName(""); setClient(""); setPhase("Initiation");
    setStartDate(""); setGoLiveDate(""); setMethodology("GAMP 5 / CSV");
    setError(null);
  }

  function handleCreate() {
    if (!name.trim())                   { setError("Name is required"); return; }
    if (!client.trim())                 { setError("Client is required"); return; }
    if (!startDate || !isIsoDate(startDate)) { setError("Valid start date is required"); return; }
    if (!goLiveDate || !isIsoDate(goLiveDate)) { setError("Valid go-live date is required"); return; }
    if (!inProjectRange(startDate) || !inProjectRange(goLiveDate)) {
      setError(`Dates must be between ${PROJECT_DATE_MIN} and ${PROJECT_DATE_MAX}`); return;
    }
    if (startDate >= goLiveDate)        { setError("Go-live must be after start date"); return; }
    setError(null);

    const created = createProject({
      name: name.trim(),
      client: client.trim(),
      phase: phase.trim() || "Initiation",
      startDate,
      goLiveDate,
      methodology: methodology.trim() || "GAMP 5 / CSV",
    });
    toast.success("Project created", { description: `${created.name} · switch to it from the sidebar` });
    resetForm();
    setShowForm(false);
  }

  function handleDelete(id: string) {
    const target = projects.find((p) => p.id === id);
    deleteProject(id);
    toast.success("Project deleted", { description: target?.name });
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Switch between projects, create new ones, archive completed work. The active project drives every other view in the app.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        )}
      </header>

      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <p className="text-sm font-semibold text-foreground">Create new project</p>
            <button
              onClick={() => { resetForm(); setShowForm(false); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Veeva Quality Vault Implementation" className={inputCls} autoFocus />
            </Field>
            <Field label="Client" required>
              <input type="text" value={client} onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. AcmePharma Inc." className={inputCls} />
            </Field>
            <Field label="Current phase">
              <input type="text" value={phase} onChange={(e) => setPhase(e.target.value)}
                placeholder="Phase 1 — Discovery" className={inputCls} />
            </Field>
            <Field label="Methodology">
              <input type="text" value={methodology} onChange={(e) => setMethodology(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Start date" required>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Go-live target" required>
              <input type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} className={inputCls} />
            </Field>
          </div>
          {error && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { resetForm(); setShowForm(false); }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Create project
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          const isConfirming = confirmDeleteId === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-xl border bg-card p-5 shadow-sm transition-all",
                isActive ? "border-primary/50 ring-2 ring-primary/10" : "border-border hover:shadow-md"
              )}
            >
              {isConfirming ? (
                <ConfirmDelete
                  label={`project "${p.name}"`}
                  onConfirm={() => handleDelete(p.id)}
                  onCancel={() => setConfirmDeleteId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                      {isActive && (
                        <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.client} · {p.phase} · {p.methodology}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Start <span className="font-medium text-foreground">{p.startDate}</span>
                      <span className="mx-2">→</span>
                      Go-live <span className="font-medium text-foreground">{p.goLiveDate}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ExportButton project={p} variant="compact" />
                    {!isActive && (
                      <button
                        onClick={() => {
                          setActiveProjectId(p.id);
                          toast.success("Switched project", { description: p.name });
                        }}
                        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        Switch to
                      </button>
                    )}
                    <Link
                      href="/"
                      onClick={() => setActiveProjectId(p.id)}
                      className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                    {projects.length > 1 && (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30"
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Note: deleting a project keeps its entities in mockData (this is a demo). In a real backend, deletion would cascade.
      </p>
    </div>
  );
}
