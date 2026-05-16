"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Clock, AlertCircle, Compass, Wrench,
  ShieldCheck, GraduationCap, Rocket, Search, Plus,
} from "lucide-react";
import {
  type Document,
  type Decision,
  type DecisionStatus,
  type DocumentStatus,
  type DocumentPhase,
} from "@/lib/mockData";
import { DocumentFormDrawer } from "./document-form";
import { useProject } from "@/components/projects/project-provider";
import { useEntityStore } from "@/lib/stores/entity-store";
import { cn } from "@/lib/utils";

const TODAY = "2026-05-11";

// ─── Phase metadata ──────────────────────────────────────────────────────────

const PHASES: { id: DocumentPhase; Icon: typeof Compass; tint: string }[] = [
  { id: "Planning",      Icon: Compass,        tint: "text-blue-600   bg-blue-50    border-blue-100"    },
  { id: "Configuration", Icon: Wrench,         tint: "text-indigo-600 bg-indigo-50  border-indigo-100"  },
  { id: "Validation",    Icon: ShieldCheck,    tint: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { id: "Training",      Icon: GraduationCap,  tint: "text-amber-600  bg-amber-50   border-amber-100"   },
  { id: "Go-Live",       Icon: Rocket,         tint: "text-rose-600   bg-rose-50    border-rose-100"    },
];

// ─── Status auto-derive ─────────────────────────────────────────────────────

function deriveStatus(doc: Document): DocumentStatus {
  const all = [...doc.reviewers, ...doc.approvers];
  if (all.length === 0) return "draft";
  if (all.some((d) => d.status === "rejected")) return "rejected";
  const reviewsDone = doc.reviewers.length === 0 || doc.reviewers.every((d) => d.status === "approved");
  const approvalsDone = doc.approvers.length === 0 || doc.approvers.every((d) => d.status === "approved");
  if (reviewsDone && approvalsDone && doc.approvers.length > 0) return "approved";
  if (reviewsDone && doc.reviewers.length > 0) return "reviewed";
  return "in-review";
}

const nextStatus: Record<DecisionStatus, DecisionStatus> = {
  pending: "approved",
  approved: "rejected",
  rejected: "pending",
};

// ─── Styling tokens ──────────────────────────────────────────────────────────

const docStatusBadge: Record<DocumentStatus, string> = {
  draft:       "bg-slate-100 text-slate-700 border-slate-200",
  "in-review": "bg-amber-50  text-amber-700 border-amber-200",
  reviewed:    "bg-blue-50   text-blue-700  border-blue-200",
  approved:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:    "bg-rose-50   text-rose-700  border-rose-200",
};

const docStatusLabel: Record<DocumentStatus, string> = {
  draft:       "Draft",
  "in-review": "In Review",
  reviewed:    "Reviewed",
  approved:    "Approved",
  rejected:    "Rejected",
};

// Per-person color hash — same person always gets same color, more visual variety than monochrome.
const AVATAR_COLORS = [
  "bg-rose-500",  "bg-orange-500", "bg-amber-500",  "bg-emerald-500",
  "bg-teal-500",  "bg-cyan-500",   "bg-blue-500",   "bg-indigo-500",
  "bg-violet-500", "bg-fuchsia-500", "bg-pink-500",
];
function avatarColor(initials: string) {
  const hash = initials.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string) {
  const today = new Date(TODAY).getTime();
  const due = new Date(iso).getTime();
  return Math.ceil((due - today) / 86_400_000);
}

function dueLabel(iso: string) {
  const d = daysUntil(iso);
  if (d < 0)  return { text: `${-d} day${-d > 1 ? "s" : ""} overdue`, tone: "overdue"  as const };
  if (d === 0) return { text: "Due today",                              tone: "urgent"   as const };
  if (d <= 7)  return { text: `Due in ${d} day${d > 1 ? "s" : ""}`,     tone: "urgent"   as const };
  if (d <= 30) return { text: `Due in ${d} days`,                       tone: "upcoming" as const };
  return       { text: `Due ${formatDate(iso)}`,                        tone: "future"   as const };
}

// ─── Person chip (avatar + name + status badge) ──────────────────────────────

function PersonChip({ decision, onToggle }: { decision: Decision; onToggle: () => void }) {
  const tooltip = `${decision.person} (${decision.role}) — click to mark ${nextStatus[decision.status]}`;
  return (
    <button
      onClick={onToggle}
      title={tooltip}
      className="group flex items-center gap-2 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-3 hover:bg-muted hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <span className="relative shrink-0">
        <span className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white",
          avatarColor(decision.initials),
        )}>
          {decision.initials}
        </span>
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card text-[8px] font-black",
          decision.status === "approved" ? "bg-emerald-500 text-white"
          : decision.status === "rejected" ? "bg-rose-500 text-white"
          : "bg-slate-300 text-slate-700",
        )}>
          {decision.status === "approved" ? "✓" : decision.status === "rejected" ? "✗" : "·"}
        </span>
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-xs font-medium text-foreground">{decision.person}</span>
        <span className="text-[10px] text-muted-foreground">{decision.role}</span>
      </span>
    </button>
  );
}

// ─── Decision history pane ──────────────────────────────────────────────────

function HistoryPane({ doc }: { doc: Document }) {
  const rows = [
    ...doc.reviewers.map((d) => ({ ...d, decisionType: "Review" as const })),
    ...doc.approvers.map((d) => ({ ...d, decisionType: "Approval" as const })),
  ];
  if (rows.length === 0) {
    return <p className="border-t border-border bg-muted/30 px-6 py-3 text-xs text-muted-foreground italic">No reviewers or approvers assigned yet.</p>;
  }
  return (
    <div className="border-t border-border bg-muted/20 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-6 py-2 text-left font-semibold text-muted-foreground">Person</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Role</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Type</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
            <th className="px-6 py-2 text-left font-semibold text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-6 py-2 font-medium text-foreground">{r.person}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.role}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.decisionType}</td>
              <td className="px-3 py-2">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                  r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : r.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200",
                )}>
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </td>
              <td className="px-6 py-2 text-muted-foreground">
                {r.date ? formatDate(r.date) : <span className="italic opacity-60">Pending</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Document card ──────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onDecisionToggle,
  onEdit,
}: {
  doc: Document;
  onDecisionToggle: (docId: string, kind: "reviewers" | "approvers", idx: number) => void;
  onEdit: (doc: Document) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveStatus(doc);
  const allDecisions = [...doc.reviewers, ...doc.approvers];
  const completed = allDecisions.filter((d) => d.status === "approved").length;
  const total = allDecisions.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const due = dueLabel(doc.dueDate);
  const isOverdue = due.tone === "overdue";
  const isUrgent = due.tone === "urgent";

  // Left strip — visual urgency indicator
  const stripColor =
    isOverdue ? "bg-rose-500"
    : isUrgent ? "bg-amber-400"
    : status === "approved" ? "bg-emerald-400"
    : "bg-transparent";

  const reviewersDone = doc.reviewers.filter((d) => d.status === "approved").length;
  const approversDone = doc.approvers.filter((d) => d.status === "approved").length;

  return (
    <div className="group relative flex overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* Urgency strip */}
      <div className={cn("w-1 shrink-0", stripColor)} aria-hidden />

      <div className="flex-1 min-w-0">
        <div className="p-6">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {doc.abbreviation && (
                  <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide">
                    {doc.abbreviation}
                  </span>
                )}
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {doc.type}
                </span>
                <span className="text-[10px] text-muted-foreground">v{doc.version}</span>
              </div>
              <button
                onClick={() => onEdit(doc)}
                className="text-left text-base font-semibold leading-snug text-foreground hover:text-primary hover:underline"
                title="Click to edit"
              >
                {doc.name}
              </button>
              {doc.description && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
              )}
            </div>

            <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold", docStatusBadge[status])}>
              {docStatusLabel[status]}
            </span>
          </div>

          {/* Due-date row */}
          <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <span className={cn(
              "flex items-center gap-1.5 font-medium",
              isOverdue ? "text-rose-600"
              : isUrgent ? "text-amber-700"
              : "text-muted-foreground",
            )}>
              {isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {due.text} · {formatDate(doc.dueDate)}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground" title="Responsible — who's delivering the document">
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white",
                avatarColor(doc.owner),
              )}>
                {doc.owner}
              </span>
              <span className="text-[11px]">owner</span>
            </span>
            {total > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{completed}</span> of <span className="font-semibold text-foreground">{total}</span> decisions
              </span>
            )}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn("h-full rounded-full transition-all",
                  progressPct === 100 ? "bg-emerald-500" : "bg-blue-500",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          {/* Decision chips */}
          {total > 0 ? (
            <div className="mt-5 space-y-4">
              {doc.reviewers.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Reviewers
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {reviewersDone} of {doc.reviewers.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.reviewers.map((d, i) => (
                      <PersonChip key={`r${i}`} decision={d} onToggle={() => onDecisionToggle(doc.id, "reviewers", i)} />
                    ))}
                  </div>
                </div>
              )}
              {doc.approvers.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Approvers
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {approversDone} of {doc.approvers.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.approvers.map((d, i) => (
                      <PersonChip key={`a${i}`} decision={d} onToggle={() => onDecisionToggle(doc.id, "approvers", i)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-5 rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground italic">
              No reviewers or approvers assigned yet — document is in draft.
            </p>
          )}

          {/* History toggle */}
          {total > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-4 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Decision history
            </button>
          )}
        </div>

        {expanded && <HistoryPane doc={doc} />}
      </div>
    </div>
  );
}

// ─── Phase section ──────────────────────────────────────────────────────────

function PhaseSection({
  phase,
  docs,
  onDecisionToggle,
  onEdit,
}: {
  phase: DocumentPhase;
  docs: Document[];
  onDecisionToggle: (docId: string, kind: "reviewers" | "approvers", idx: number) => void;
  onEdit: (doc: Document) => void;
}) {
  const meta = PHASES.find((p) => p.id === phase)!;
  const Icon = meta.Icon;
  const approved = docs.filter((d) => deriveStatus(d) === "approved").length;
  const pending = docs.flatMap((d) => [...d.reviewers, ...d.approvers]).filter((d) => d.status === "pending").length;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", meta.tint)}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{phase} Phase</h2>
            <p className="text-xs text-muted-foreground">
              {docs.length} document{docs.length > 1 ? "s" : ""} · {approved} approved · {pending} decisions pending
            </p>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {docs.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} onDecisionToggle={onDecisionToggle} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

// ─── Main list ──────────────────────────────────────────────────────────────

type StatusFilter = "All" | DocumentStatus;
type DocDrawerState = { mode: "closed" } | { mode: "new" } | { mode: "edit"; doc: Document };

export function DocumentsList() {
  const { activeProjectId } = useProject();
  const docs            = useEntityStore((s) => s.documents);
  const addDocument     = useEntityStore((s) => s.addDocument);
  const updateDocument  = useEntityStore((s) => s.updateDocument);
  const deleteDocumentAction = useEntityStore((s) => s.deleteDocument);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("All");
  const [filterMine, setFilterMine] = useState(false);
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<DocDrawerState>({ mode: "closed" });

  const projectDocs = docs.filter((d) => d.projectId === activeProjectId);

  function handleDrawerSave(d: Document) {
    const withProj: Document = { ...d, projectId: d.projectId || activeProjectId };
    const exists = docs.some((x) => x.id === withProj.id);
    if (exists) {
      updateDocument(withProj);
      toast.success("Document updated", { description: withProj.name });
    } else {
      addDocument(withProj);
      toast.success("Document added", { description: withProj.name });
    }
    setDrawer({ mode: "closed" });
  }
  function handleDrawerDelete(id: string) {
    const target = docs.find((d) => d.id === id);
    deleteDocumentAction(id);
    toast.success("Document deleted", { description: target?.name });
    setDrawer({ mode: "closed" });
  }

  const knownTypes = Array.from(new Set(projectDocs.map((d) => d.type)));

  function handleDecisionToggle(docId: string, kind: "reviewers" | "approvers", idx: number) {
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;
    const updated = [...doc[kind]];
    const old = updated[idx];
    const next = nextStatus[old.status];
    updated[idx] = {
      ...old,
      status: next,
      date: next === "approved" ? TODAY : next === "rejected" ? TODAY : undefined,
    };
    updateDocument({ ...doc, [kind]: updated }, { source: "user-inline", note: "decision chip click" });
  }

  // Filtering — start from project-scoped docs
  const filtered = projectDocs.filter((d) => {
    const s = deriveStatus(d);
    if (filterStatus !== "All" && s !== filterStatus) return false;
    if (filterMine && d.owner !== "VP") return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hit =
        d.name.toLowerCase().includes(q) ||
        (d.abbreviation?.toLowerCase().includes(q) ?? false) ||
        d.type.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // Counts — for the active project only
  const counts: Record<StatusFilter, number> = {
    All:         projectDocs.length,
    "in-review": projectDocs.filter((d) => deriveStatus(d) === "in-review").length,
    reviewed:    projectDocs.filter((d) => deriveStatus(d) === "reviewed").length,
    approved:    projectDocs.filter((d) => deriveStatus(d) === "approved").length,
    draft:       projectDocs.filter((d) => deriveStatus(d) === "draft").length,
    rejected:    projectDocs.filter((d) => deriveStatus(d) === "rejected").length,
  };

  const pendingTotal = projectDocs
    .flatMap((d) => [...d.reviewers, ...d.approvers])
    .filter((d) => d.status === "pending").length;

  const FILTER_PILLS: { id: StatusFilter; label: string }[] = [
    { id: "All",       label: "All" },
    { id: "in-review", label: "In Review" },
    { id: "reviewed",  label: "Reviewed" },
    { id: "approved",  label: "Approved" },
    { id: "draft",     label: "Draft" },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        {/* Status filter pills */}
        <div className="flex flex-wrap items-center gap-1">
          {FILTER_PILLS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterStatus(id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                filterStatus === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label} <span className="ml-1 opacity-70 tabular-nums">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="sm:flex-1" />

        <button
          onClick={() => setFilterMine((v) => !v)}
          title={filterMine ? "Showing only documents you own" : "Show only documents you own (Responsible)"}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
            filterMine
              ? "bg-primary/10 text-primary"
              : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          Mine
        </button>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 sm:w-64">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Pending banner */}
        {pendingTotal > 0 && (
          <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5" />
            {pendingTotal} pending
          </span>
        )}

        <button
          onClick={() => setDrawer({ mode: "new" })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Document
        </button>
      </div>

      {/* Phase sections */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No documents match your filters.</p>
          <p className="mt-1 text-xs text-muted-foreground">Try clearing the search or selecting &ldquo;All&rdquo;.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {PHASES.map(({ id }) => {
            const phaseDocs = filtered
              .filter((d) => d.phase === id)
              .slice()
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            if (phaseDocs.length === 0) return null;
            return (
              <PhaseSection
                key={id}
                phase={id}
                docs={phaseDocs}
                onDecisionToggle={handleDecisionToggle}
                onEdit={(d) => setDrawer({ mode: "edit", doc: d })}
              />
            );
          })}
        </div>
      )}

      <DocumentFormDrawer
        open={drawer.mode !== "closed"}
        initial={drawer.mode === "edit" ? drawer.doc : null}
        allDocuments={projectDocs}
        knownTypes={knownTypes}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
        onClose={() => setDrawer({ mode: "closed" })}
      />
    </div>
  );
}
