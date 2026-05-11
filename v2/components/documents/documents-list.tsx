"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Clock } from "lucide-react";
import {
  documents as initialDocuments,
  type Document,
  type Decision,
  type DecisionStatus,
  type DocumentStatus,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";

const TODAY = "2026-05-11";

// ─── Status auto-derive ───────────────────────────────────────────────────────

function deriveStatus(doc: Document): DocumentStatus {
  const all = [...doc.reviewers, ...doc.approvers];
  if (all.length === 0) return "draft";
  if (all.some((d) => d.status === "rejected")) return "rejected";
  const reviewsDone =
    doc.reviewers.length === 0 ||
    doc.reviewers.every((d) => d.status === "approved");
  const approvalsDone =
    doc.approvers.length === 0 ||
    doc.approvers.every((d) => d.status === "approved");
  if (reviewsDone && approvalsDone && doc.approvers.length > 0) return "approved";
  if (reviewsDone && doc.reviewers.length > 0) return "reviewed";
  return "in-review";
}

// ─── Chip cycle: pending → approved → rejected → pending ─────────────────────

const nextStatus: Record<DecisionStatus, DecisionStatus> = {
  pending: "approved",
  approved: "rejected",
  rejected: "pending",
};

// ─── Badge styles ─────────────────────────────────────────────────────────────

const docStatusBadge: Record<DocumentStatus, string> = {
  draft:       "bg-muted text-muted-foreground",
  "in-review": "bg-amber-100 text-amber-700",
  reviewed:    "bg-blue-100 text-blue-700",
  approved:    "bg-green-100 text-green-700",
  rejected:    "bg-red-100 text-red-700",
};

const docStatusLabel: Record<DocumentStatus, string> = {
  draft:       "Draft",
  "in-review": "In Review",
  reviewed:    "Reviewed",
  approved:    "Approved",
  rejected:    "Rejected",
};

const chipColor: Record<DecisionStatus, string> = {
  approved: "bg-green-500",
  rejected:  "bg-destructive",
  pending:   "bg-muted-foreground/40",
};

const chipIcon: Record<DecisionStatus, string> = {
  approved: "✓",
  rejected:  "✗",
  pending:   "·",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Decision chip ────────────────────────────────────────────────────────────

function DecisionChip({
  decision,
  onToggle,
}: {
  decision: Decision;
  onToggle: () => void;
}) {
  const tooltip = [
    decision.person,
    `(${decision.role})`,
    decision.status === "approved" && decision.date ? `· ${formatDate(decision.date)}` : "",
    `— click to mark ${nextStatus[decision.status]}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      onClick={onToggle}
      title={tooltip}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
        chipColor[decision.status]
      )}
    >
      {decision.initials}
      {/* Status icon micro-badge */}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-card text-[8px] font-black",
          decision.status === "approved"
            ? "bg-green-500 text-white"
            : decision.status === "rejected"
            ? "bg-destructive text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {chipIcon[decision.status]}
      </span>
    </button>
  );
}

// ─── Decision history pane (expandable) ──────────────────────────────────────

function HistoryPane({ doc }: { doc: Document }) {
  const rows = [
    ...doc.reviewers.map((d) => ({ ...d, decisionType: "Review" as const })),
    ...doc.approvers.map((d) => ({ ...d, decisionType: "Approval" as const })),
  ];

  if (rows.length === 0) {
    return (
      <p className="px-5 py-3 text-xs text-muted-foreground italic">
        No reviewers or approvers assigned yet.
      </p>
    );
  }

  return (
    <div className="border-t border-border bg-muted/20">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-5 py-2 text-left font-semibold text-muted-foreground">Person</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Role</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Type</th>
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
            <th className="px-5 py-2 text-left font-semibold text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="px-5 py-2 font-medium text-foreground">{r.person}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.role}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.decisionType}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    r.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : r.status === "rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  )}
                >
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </td>
              <td className="px-5 py-2 text-muted-foreground">
                {r.date ? formatDate(r.date) : <span className="italic opacity-50">Pending</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onDecisionToggle,
}: {
  doc: Document;
  onDecisionToggle: (docId: string, decisionType: "reviewers" | "approvers", personIdx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveStatus(doc);
  const pendingCount = [...doc.reviewers, ...doc.approvers].filter((d) => d.status === "pending").length;
  const isOverdue = new Date(doc.dueDate) < new Date(TODAY);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4">
        {/* Top row: badges + due date */}
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {doc.type}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              docStatusBadge[status]
            )}
          >
            {docStatusLabel[status]}
          </span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {pendingCount} pending
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-[10px]">
            <Clock className={cn("h-3 w-3", isOverdue ? "text-destructive" : "text-muted-foreground")} />
            <span className={isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
              Due {formatDate(doc.dueDate)}
            </span>
          </div>
        </div>

        {/* Doc name + version */}
        <p className="text-sm font-semibold text-foreground">
          {doc.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">v{doc.version}</span>
        </p>

        {/* Chips */}
        {(doc.reviewers.length > 0 || doc.approvers.length > 0) ? (
          <div className="mt-4 flex flex-col gap-3">
            {doc.reviewers.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Review
                </span>
                <div className="flex gap-2 flex-wrap">
                  {doc.reviewers.map((d, i) => (
                    <DecisionChip
                      key={i}
                      decision={d}
                      onToggle={() => onDecisionToggle(doc.id, "reviewers", i)}
                    />
                  ))}
                </div>
              </div>
            )}
            {doc.approvers.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Approval
                </span>
                <div className="flex gap-2 flex-wrap">
                  {doc.approvers.map((d, i) => (
                    <DecisionChip
                      key={i}
                      decision={d}
                      onToggle={() => onDecisionToggle(doc.id, "approvers", i)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground italic">
            No reviewers or approvers assigned — document is in draft.
          </p>
        )}

        {/* Expand toggle */}
        {(doc.reviewers.length > 0 || doc.approvers.length > 0) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
            Decision history
          </button>
        )}
      </div>

      {/* History pane */}
      {expanded && <HistoryPane doc={doc} />}
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export function DocumentsList() {
  const [docs, setDocs] = useState<Document[]>(initialDocuments);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");

  const allTypes = Array.from(new Set(docs.map((d) => d.type)));

  function handleDecisionToggle(
    docId: string,
    decisionType: "reviewers" | "approvers",
    personIdx: number
  ) {
    setDocs((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) return doc;
        const updated = [...doc[decisionType]];
        const old = updated[personIdx];
        const next = nextStatus[old.status];
        updated[personIdx] = {
          ...old,
          status: next,
          date: next === "approved" ? TODAY : next === "rejected" ? TODAY : undefined,
        };
        return { ...doc, [decisionType]: updated };
      })
    );
  }

  const filtered = docs.filter((d) => {
    const status = deriveStatus(d);
    if (filterStatus !== "All" && status !== filterStatus) return false;
    if (filterType !== "All" && d.type !== filterType) return false;
    return true;
  });

  // Summary counts
  const pendingTotal = docs
    .flatMap((d) => [...d.reviewers, ...d.approvers])
    .filter((d) => d.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        {(
          [
            ["All", docs.length],
            ["in-review", docs.filter((d) => deriveStatus(d) === "in-review").length],
            ["reviewed", docs.filter((d) => deriveStatus(d) === "reviewed").length],
            ["approved", docs.filter((d) => deriveStatus(d) === "approved").length],
            ["draft", docs.filter((d) => deriveStatus(d) === "draft").length],
          ] as [string, number][]
        ).map(([label, count]) => (
          <button
            key={label}
            onClick={() => setFilterStatus(label === "All" ? "All" : label)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filterStatus === (label === "All" ? "All" : label)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label === "All"
              ? `All (${count})`
              : `${docStatusLabel[label as DocumentStatus]} (${count})`}
          </button>
        ))}

        <div className="flex-1" />

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="All">All types</option>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Pending callout */}
        {pendingTotal > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {pendingTotal} decisions pending
          </span>
        )}
      </div>

      {/* Chips legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground px-1">
        <FileText className="h-3 w-3" />
        <span>Click a chip to cycle its decision:</span>
        {(["pending", "approved", "rejected"] as DecisionStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black text-white",
                chipColor[s]
              )}
            >
              {chipIcon[s]}
            </span>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        ))}
      </div>

      {/* Document cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
          No documents match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDecisionToggle={handleDecisionToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
