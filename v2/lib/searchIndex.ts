// Search index — flattens every persisted entity into a single searchable list.
// Reads from the same localStorage keys that the entity grids write to (M16.1);
// falls back to initial mockData if a key isn't populated yet (first load).

import {
  milestones as initialMilestones,
  tasks as initialTasks,
  risks as initialRisks,
  documents as initialDocuments,
  costLines as initialCostLines,
  teamMembers as initialTeamMembers,
  recurringMeetings as initialMeetings,
  projects as initialProjects,
} from "./mockData";

export type SearchHit = {
  id: string;
  kind: "milestone" | "task" | "risk" | "document" | "cost" | "member" | "meeting" | "project";
  title: string;
  subtitle: string;
  href: string;
  projectId?: string;
};

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function buildSearchIndex(activeProjectId: string): SearchHit[] {
  const hits: SearchHit[] = [];

  const milestones = readStored("aivello_milestones_v1", initialMilestones);
  milestones
    .filter((m) => m.projectId === activeProjectId)
    .forEach((m) => hits.push({
      id: m.id, kind: "milestone",
      title: m.name,
      subtitle: `${m.id.toUpperCase()} · ${m.phase} · ${m.plannedDate}`,
      href: "/milestones",
      projectId: m.projectId,
    }));

  const tasks = readStored("aivello_tasks_v1", initialTasks);
  tasks
    .filter((t) => t.projectId === activeProjectId)
    .forEach((t) => hits.push({
      id: t.id, kind: "task",
      title: t.name,
      subtitle: `${t.id.toUpperCase()} · ${t.workstream} · ${t.status}`,
      href: "/tasks",
      projectId: t.projectId,
    }));

  const risks = readStored("aivello_risks_v1", initialRisks);
  risks
    .filter((r) => r.projectId === activeProjectId)
    .forEach((r) => hits.push({
      id: r.id, kind: "risk",
      title: r.title,
      subtitle: `${r.id.toUpperCase()} · ${r.category} · score ${r.score}`,
      href: "/risks",
      projectId: r.projectId,
    }));

  const documents = readStored("aivello_documents_v1", initialDocuments);
  documents
    .filter((d) => d.projectId === activeProjectId)
    .forEach((d) => hits.push({
      id: d.id, kind: "document",
      title: d.name,
      subtitle: `${d.abbreviation ?? d.id.toUpperCase()} · ${d.phase} · v${d.version}`,
      href: "/documents",
      projectId: d.projectId,
    }));

  const costs = readStored("aivello_costLines_v1", initialCostLines);
  costs
    .filter((c) => c.projectId === activeProjectId)
    .forEach((c) => hits.push({
      id: c.id, kind: "cost",
      title: c.description,
      subtitle: `${c.id.toUpperCase()} · ${c.category} · $${c.budgetK}k budget`,
      href: "/costs",
      projectId: c.projectId,
    }));

  const members = readStored("aivello_teamMembers_v1", initialTeamMembers);
  members
    .filter((m) => m.projectId === activeProjectId)
    .forEach((m) => hits.push({
      id: m.id, kind: "member",
      title: m.name,
      subtitle: `${m.initials} · ${m.role} · ${m.workstream}`,
      href: "/resources",
      projectId: m.projectId,
    }));

  const meetings = readStored("aivello_meetings_v1", initialMeetings);
  meetings
    .filter((m) => m.projectId === activeProjectId)
    .forEach((m) => hits.push({
      id: m.id, kind: "meeting",
      title: m.name,
      subtitle: `${m.type} · ${m.frequency} · next ${m.nextDate}`,
      href: "/resources",
      projectId: m.projectId,
    }));

  // Projects are global (not scoped to active)
  const projects = readStored("aivello_projects_v1", initialProjects);
  projects.forEach((p) => hits.push({
    id: p.id, kind: "project",
    title: p.name,
    subtitle: `${p.client} · ${p.phase}`,
    href: "/projects",
  }));

  return hits;
}

// Naive substring scoring — title match weighted higher than subtitle.
export function scoreHit(hit: SearchHit, q: string): number {
  if (!q) return 0;
  const ql = q.toLowerCase();
  const titleL = hit.title.toLowerCase();
  const subL = hit.subtitle.toLowerCase();
  if (titleL === ql) return 1000;
  if (titleL.startsWith(ql)) return 500;
  if (titleL.includes(ql)) return 250;
  if (subL.includes(ql)) return 100;
  return 0;
}

export function searchEntities(activeProjectId: string, q: string, limit = 20): SearchHit[] {
  const idx = buildSearchIndex(activeProjectId);
  if (!q.trim()) return [];
  return idx
    .map((h) => ({ h, s: scoreHit(h, q) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ h }) => h);
}
