// M20.2 — Central entity store (Zustand).
//
// One slice per entity type. Mutations flow through actions that:
//   1. Update store state
//   2. Persist via the EntityRepository
//   3. Record to the audit log
//
// Components subscribe via useEntityStore((s) => s.milestones) etc. Reactive
// across the whole app — NotificationBell, /my-items, the dashboard health
// card, the cascade engine, all see the same source of truth.

"use client";

import { create } from "zustand";
import {
  milestones as seedMilestones,
  tasks as seedTasks,
  risks as seedRisks,
  documents as seedDocuments,
  costLines as seedCostLines,
  teamMembers as seedTeamMembers,
  recurringMeetings as seedMeetings,
  absences as seedAbsences,
  charters as seedCharters,
  type Milestone, type Task, type Risk, type Document,
  type CostLine, type TeamMember, type RecurringMeeting, type Absence,
  type Charter,
} from "@/lib/mockData";
import { LocalStorageRepository } from "@/lib/repositories/entity-repository";
import { appendAudit, buildAction, type Source, type EntityKind } from "./audit";

// ─── Repositories — one per entity type ──────────────────────────────────────

const repos = {
  milestone:  new LocalStorageRepository<Milestone>("aivello_milestones_v1", seedMilestones),
  task:       new LocalStorageRepository<Task>("aivello_tasks_v1", seedTasks),
  risk:       new LocalStorageRepository<Risk>("aivello_risks_v1", seedRisks),
  document:   new LocalStorageRepository<Document>("aivello_documents_v1", seedDocuments),
  costLine:   new LocalStorageRepository<CostLine>("aivello_costLines_v1", seedCostLines),
  teamMember: new LocalStorageRepository<TeamMember>("aivello_teamMembers_v1", seedTeamMembers),
  meeting:    new LocalStorageRepository<RecurringMeeting>("aivello_meetings_v1", seedMeetings),
  absence:    new LocalStorageRepository<Absence>("aivello_absences_v1", seedAbsences),
  charter:    new LocalStorageRepository<Charter>("aivello_charters_v1", seedCharters),
};

// ─── Per-action options ──────────────────────────────────────────────────────

interface ActionOpts {
  source?: Source;
  note?: string;
}

interface State {
  hydrated: boolean;

  milestones: Milestone[];
  tasks: Task[];
  risks: Risk[];
  documents: Document[];
  costLines: CostLine[];
  teamMembers: TeamMember[];
  meetings: RecurringMeeting[];
  absences: Absence[];
  charters: Charter[];

  hydrate(): Promise<void>;

  addCharter(c: Charter, opts?: ActionOpts): void;
  updateCharter(c: Charter, opts?: ActionOpts): void;
  deleteCharter(id: string, opts?: ActionOpts): void;
  replaceAllCharters(items: Charter[], opts?: ActionOpts): void;

  addMilestone(m: Milestone, opts?: ActionOpts): void;
  updateMilestone(m: Milestone, opts?: ActionOpts): void;
  deleteMilestone(id: string, opts?: ActionOpts): void;
  replaceAllMilestones(items: Milestone[], opts?: ActionOpts): void;

  addTask(t: Task, opts?: ActionOpts): void;
  updateTask(t: Task, opts?: ActionOpts): void;
  deleteTask(id: string, opts?: ActionOpts): void;
  replaceAllTasks(items: Task[], opts?: ActionOpts): void;

  addRisk(r: Risk, opts?: ActionOpts): void;
  updateRisk(r: Risk, opts?: ActionOpts): void;
  deleteRisk(id: string, opts?: ActionOpts): void;
  replaceAllRisks(items: Risk[], opts?: ActionOpts): void;

  addDocument(d: Document, opts?: ActionOpts): void;
  updateDocument(d: Document, opts?: ActionOpts): void;
  deleteDocument(id: string, opts?: ActionOpts): void;
  replaceAllDocuments(items: Document[], opts?: ActionOpts): void;

  addCostLine(c: CostLine, opts?: ActionOpts): void;
  updateCostLine(c: CostLine, opts?: ActionOpts): void;
  deleteCostLine(id: string, opts?: ActionOpts): void;
  replaceAllCostLines(items: CostLine[], opts?: ActionOpts): void;

  addTeamMember(m: TeamMember, opts?: ActionOpts): void;
  updateTeamMember(m: TeamMember, opts?: ActionOpts): void;
  deleteTeamMember(id: string, opts?: ActionOpts): void;
  replaceAllTeamMembers(items: TeamMember[], opts?: ActionOpts): void;

  addMeeting(m: RecurringMeeting, opts?: ActionOpts): void;
  updateMeeting(m: RecurringMeeting, opts?: ActionOpts): void;
  deleteMeeting(id: string, opts?: ActionOpts): void;
  replaceAllMeetings(items: RecurringMeeting[], opts?: ActionOpts): void;

  addAbsence(a: Absence, opts?: ActionOpts): void;
  updateAbsence(a: Absence, opts?: ActionOpts): void;
  deleteAbsence(id: string, opts?: ActionOpts): void;
  replaceAllAbsences(items: Absence[], opts?: ActionOpts): void;
}

// ─── Helpers that wrap the dispatch + persist + audit lifecycle ─────────────

interface EntityLike { id: string; projectId?: string }

function runAdd<T extends EntityLike>(
  current: T[],
  entity: T,
  entityKind: EntityKind,
  repo: LocalStorageRepository<T>,
  opts?: ActionOpts,
): T[] {
  const next = [...current, entity];
  repo.replaceAll(next);
  appendAudit(buildAction({
    type: "add", entityKind, entityId: entity.id,
    after: entity, source: opts?.source ?? "user-edit",
    projectId: entity.projectId, note: opts?.note,
  }));
  return next;
}

function runUpdate<T extends EntityLike>(
  current: T[],
  entity: T,
  entityKind: EntityKind,
  repo: LocalStorageRepository<T>,
  opts?: ActionOpts,
): T[] {
  const before = current.find((x) => x.id === entity.id);
  const next = current.map((x) => (x.id === entity.id ? entity : x));
  repo.replaceAll(next);
  appendAudit(buildAction({
    type: "update", entityKind, entityId: entity.id,
    before, after: entity, source: opts?.source ?? "user-edit",
    projectId: entity.projectId, note: opts?.note,
  }));
  return next;
}

function runDelete<T extends EntityLike>(
  current: T[],
  id: string,
  entityKind: EntityKind,
  repo: LocalStorageRepository<T>,
  opts?: ActionOpts,
): T[] {
  const before = current.find((x) => x.id === id);
  const next = current.filter((x) => x.id !== id);
  repo.replaceAll(next);
  appendAudit(buildAction({
    type: "delete", entityKind, entityId: id,
    before, source: opts?.source ?? "user-edit",
    projectId: before?.projectId, note: opts?.note,
  }));
  return next;
}

function runReplaceAll<T extends EntityLike>(
  items: T[],
  entityKind: EntityKind,
  repo: LocalStorageRepository<T>,
  opts?: ActionOpts,
): T[] {
  repo.replaceAll(items);
  appendAudit(buildAction({
    type: "replaceAll", entityKind, entityId: `_bulk_${items.length}`,
    source: opts?.source ?? "user-edit",
    note: opts?.note ?? `replaceAll(${items.length})`,
  }));
  return items;
}

// ─── Store factory ───────────────────────────────────────────────────────────

export const useEntityStore = create<State>((set, get) => ({
  hydrated: false,
  milestones:  seedMilestones,
  tasks:       seedTasks,
  risks:       seedRisks,
  documents:   seedDocuments,
  costLines:   seedCostLines,
  teamMembers: seedTeamMembers,
  meetings:    seedMeetings,
  absences:    seedAbsences,
  charters:    seedCharters,

  async hydrate() {
    if (get().hydrated) return;
    const [milestones, tasks, risks, documents, costLines, teamMembers, meetings, absences, charters] = await Promise.all([
      repos.milestone.list(),  repos.task.list(), repos.risk.list(),
      repos.document.list(),   repos.costLine.list(), repos.teamMember.list(),
      repos.meeting.list(),    repos.absence.list(), repos.charter.list(),
    ]);
    set({ milestones, tasks, risks, documents, costLines, teamMembers, meetings, absences, charters, hydrated: true });
  },

  // ── Milestones ──
  addMilestone:        (m, o) => set({ milestones: runAdd(get().milestones, m, "milestone", repos.milestone, o) }),
  updateMilestone:     (m, o) => set({ milestones: runUpdate(get().milestones, m, "milestone", repos.milestone, o) }),
  deleteMilestone:     (id, o) => set({ milestones: runDelete(get().milestones, id, "milestone", repos.milestone, o) }),
  replaceAllMilestones: (items, o) => set({ milestones: runReplaceAll(items, "milestone", repos.milestone, o) }),

  // ── Tasks ──
  addTask:        (t, o) => set({ tasks: runAdd(get().tasks, t, "task", repos.task, o) }),
  updateTask:     (t, o) => set({ tasks: runUpdate(get().tasks, t, "task", repos.task, o) }),
  deleteTask:     (id, o) => set({ tasks: runDelete(get().tasks, id, "task", repos.task, o) }),
  replaceAllTasks: (items, o) => set({ tasks: runReplaceAll(items, "task", repos.task, o) }),

  // ── Risks ──
  addRisk:        (r, o) => set({ risks: runAdd(get().risks, r, "risk", repos.risk, o) }),
  updateRisk:     (r, o) => set({ risks: runUpdate(get().risks, r, "risk", repos.risk, o) }),
  deleteRisk:     (id, o) => set({ risks: runDelete(get().risks, id, "risk", repos.risk, o) }),
  replaceAllRisks: (items, o) => set({ risks: runReplaceAll(items, "risk", repos.risk, o) }),

  // ── Documents ──
  addDocument:        (d, o) => set({ documents: runAdd(get().documents, d, "document", repos.document, o) }),
  updateDocument:     (d, o) => set({ documents: runUpdate(get().documents, d, "document", repos.document, o) }),
  deleteDocument:     (id, o) => set({ documents: runDelete(get().documents, id, "document", repos.document, o) }),
  replaceAllDocuments: (items, o) => set({ documents: runReplaceAll(items, "document", repos.document, o) }),

  // ── Cost lines ──
  addCostLine:        (c, o) => set({ costLines: runAdd(get().costLines, c, "costLine", repos.costLine, o) }),
  updateCostLine:     (c, o) => set({ costLines: runUpdate(get().costLines, c, "costLine", repos.costLine, o) }),
  deleteCostLine:     (id, o) => set({ costLines: runDelete(get().costLines, id, "costLine", repos.costLine, o) }),
  replaceAllCostLines: (items, o) => set({ costLines: runReplaceAll(items, "costLine", repos.costLine, o) }),

  // ── Team members ──
  addTeamMember:        (m, o) => set({ teamMembers: runAdd(get().teamMembers, m, "teamMember", repos.teamMember, o) }),
  updateTeamMember:     (m, o) => set({ teamMembers: runUpdate(get().teamMembers, m, "teamMember", repos.teamMember, o) }),
  deleteTeamMember:     (id, o) => set({ teamMembers: runDelete(get().teamMembers, id, "teamMember", repos.teamMember, o) }),
  replaceAllTeamMembers: (items, o) => set({ teamMembers: runReplaceAll(items, "teamMember", repos.teamMember, o) }),

  // ── Meetings ──
  addMeeting:        (m, o) => set({ meetings: runAdd(get().meetings, m, "meeting", repos.meeting, o) }),
  updateMeeting:     (m, o) => set({ meetings: runUpdate(get().meetings, m, "meeting", repos.meeting, o) }),
  deleteMeeting:     (id, o) => set({ meetings: runDelete(get().meetings, id, "meeting", repos.meeting, o) }),
  replaceAllMeetings: (items, o) => set({ meetings: runReplaceAll(items, "meeting", repos.meeting, o) }),

  // ── Absences ──
  addAbsence:        (a, o) => set({ absences: runAdd(get().absences, a, "absence", repos.absence, o) }),
  updateAbsence:     (a, o) => set({ absences: runUpdate(get().absences, a, "absence", repos.absence, o) }),
  deleteAbsence:     (id, o) => set({ absences: runDelete(get().absences, id, "absence", repos.absence, o) }),
  replaceAllAbsences: (items, o) => set({ absences: runReplaceAll(items, "absence", repos.absence, o) }),

  // ── Charters (M22) ──
  addCharter:        (c, o) => set({ charters: runAdd(get().charters, c, "charter", repos.charter, o) }),
  updateCharter:     (c, o) => set({ charters: runUpdate(get().charters, c, "charter", repos.charter, o) }),
  deleteCharter:     (id, o) => set({ charters: runDelete(get().charters, id, "charter", repos.charter, o) }),
  replaceAllCharters: (items, o) => set({ charters: runReplaceAll(items, "charter", repos.charter, o) }),
}));

// Convenience hook used in app/(app)/layout.tsx to hydrate on first mount.
export function useHydrateEntityStore() {
  const hydrate = useEntityStore((s) => s.hydrate);
  const hydrated = useEntityStore((s) => s.hydrated);
  return { hydrate, hydrated };
}
