"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { projects as initialProjects, type Project } from "@/lib/mockData";

const STORAGE_KEY = "aivello_active_project_v1";
const PROJECTS_KEY = "aivello_projects_v1";

type ProjectContextValue = {
  projects: Project[];
  activeProjectId: string;
  activeProject: Project;
  setActiveProjectId: (id: string) => void;
  createProject: (p: Omit<Project, "id">) => Project;
  updateProject: (p: Project) => void;
  deleteProject: (id: string) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside ProjectProvider");
  return ctx;
}

function loadProjects(): Project[] {
  if (typeof window === "undefined") return initialProjects;
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return initialProjects;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return initialProjects;
  } catch {
    return initialProjects;
  }
}

function loadActiveId(): string {
  if (typeof window === "undefined") return initialProjects[0].id;
  try {
    return localStorage.getItem(STORAGE_KEY) || initialProjects[0].id;
  } catch {
    return initialProjects[0].id;
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects,        setProjects]        = useState<Project[]>(initialProjects);
  const [activeProjectId, setActiveProjectIdS] = useState<string>(initialProjects[0].id);

  // Hydrate from localStorage on mount (avoids SSR/static-export mismatch)
  useEffect(() => {
    const p = loadProjects();
    const a = loadActiveId();
    setProjects(p);
    // Guard: if persisted activeId no longer exists, fall back to first project
    setActiveProjectIdS(p.some((x) => x.id === a) ? a : p[0].id);
  }, []);

  const persistProjects = useCallback((next: Project[]) => {
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdS(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const createProject = useCallback((p: Omit<Project, "id">): Project => {
    // Generate a slug-based id; fall back to timestamp if collision
    const base = "proj-" + p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
    setProjects((prev) => {
      let id = base;
      let i = 1;
      while (prev.some((x) => x.id === id)) { id = `${base}-${i++}`; }
      const created: Project = { ...p, id };
      const next = [...prev, created];
      persistProjects(next);
      return next;
    });
    // Reconstruct the id we just generated so the caller can use it
    const exists = projects.map((x) => x.id);
    let id = base;
    let i = 1;
    while (exists.includes(id)) { id = `${base}-${i++}`; }
    return { ...p, id };
  }, [persistProjects, projects]);

  const updateProject = useCallback((p: Project) => {
    setProjects((prev) => {
      const next = prev.map((x) => x.id === p.id ? p : x);
      persistProjects(next);
      return next;
    });
  }, [persistProjects]);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persistProjects(next);
      // If we deleted the active one, switch to the first remaining
      if (id === activeProjectId && next.length > 0) {
        setActiveProjectId(next[0].id);
      }
      return next;
    });
  }, [persistProjects, activeProjectId, setActiveProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  return (
    <ProjectContext.Provider
      value={{ projects, activeProjectId, activeProject, setActiveProjectId, createProject, updateProject, deleteProject }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
