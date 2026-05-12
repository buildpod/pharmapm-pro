"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { useProject } from "./project-provider";
import { cn } from "@/lib/utils";

// Sidebar dropdown replacing the static project card. Lists every project,
// click to switch (persists to localStorage via context). Footer link goes
// to /projects for create/manage.

export function ProjectSwitcher() {
  const { projects, activeProject, setActiveProjectId } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-left hover:bg-muted/70 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{activeProject.name}</p>
          <p className="truncate text-xs text-muted-foreground">{activeProject.phase}</p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-card shadow-lg overflow-hidden">
          <ul className="max-h-64 overflow-y-auto py-1">
            {projects.map((p) => {
              const active = p.id === activeProject.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                      active && "bg-primary/5"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {p.client} · go-live {p.goLiveDate}
                      </p>
                    </div>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/projects"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-border bg-muted/30 px-3 py-2 text-xs font-medium text-primary hover:bg-muted/50"
          >
            <Plus className="h-3 w-3" />
            Manage projects
          </Link>
        </div>
      )}
    </div>
  );
}
