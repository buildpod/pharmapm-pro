"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard, Milestone, CheckSquare, AlertTriangle,
  DollarSign, FileText, BarChart2, Settings, Search, Users, FolderKanban,
  Inbox, Calendar,
} from "lucide-react";
import { useProject } from "@/components/projects/project-provider";
import { searchEntities, type SearchHit } from "@/lib/searchIndex";
import { cn } from "@/lib/utils";

const PAGES = [
  { label: "Dashboard",   href: "/",           icon: LayoutDashboard },
  { label: "My Items",    href: "/my-items",   icon: Inbox },
  { label: "Projects",    href: "/projects",   icon: FolderKanban },
  { label: "Milestones",  href: "/milestones", icon: Milestone },
  { label: "Tasks",       href: "/tasks",      icon: CheckSquare },
  { label: "Risks",       href: "/risks",      icon: AlertTriangle },
  { label: "Costs",       href: "/costs",      icon: DollarSign },
  { label: "Resources",   href: "/resources",  icon: Users },
  { label: "Documents",   href: "/documents",  icon: FileText },
  { label: "Reports",     href: "/reports",    icon: BarChart2 },
  { label: "Settings",    href: "/settings",   icon: Settings },
];

// Per-entity-kind icon for search hits.
const KIND_ICON: Record<SearchHit["kind"], typeof Milestone> = {
  milestone: Milestone,
  task:      CheckSquare,
  risk:      AlertTriangle,
  document:  FileText,
  cost:      DollarSign,
  member:    Users,
  meeting:   Calendar,
  project:   FolderKanban,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { activeProjectId } = useProject();

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset query when palette closes
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  // Live entity search — recomputed on every keystroke (reads localStorage)
  const entityHits = useMemo<SearchHit[]>(() => {
    if (!open || !query.trim()) return [];
    return searchEntities(activeProjectId, query, 12);
  }, [open, query, activeProjectId]);

  function go(href: string) {
    router.push(href);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="fixed left-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2 px-4">
        <Command
          className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          // Disable cmdk's built-in filter — we filter entity hits ourselves
          // so the order is score-based, but pages still need internal filter.
          shouldFilter={true}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, milestones, tasks, risks, documents…"
              className="flex-1 bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Pages */}
            <Command.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {PAGES.map((page) => {
                const Icon = page.icon;
                return (
                  <Command.Item
                    key={page.href}
                    value={page.label}
                    onSelect={() => go(page.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground cursor-pointer",
                      "data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary",
                      "hover:bg-muted transition-colors"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {page.label}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {page.href === "/" ? "/" : page.href}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Entity hits — populated only when query is non-empty */}
            {entityHits.length > 0 && (
              <Command.Group
                heading="Entities"
                className="[&_[cmdk-group-heading]]:mt-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {entityHits.map((hit) => {
                  const Icon = KIND_ICON[hit.kind];
                  return (
                    <Command.Item
                      key={`${hit.kind}-${hit.id}`}
                      value={`${hit.title} ${hit.subtitle}`}
                      onSelect={() => go(hit.href)}
                      className={cn(
                        "flex items-start gap-3 rounded-md px-2 py-2 text-sm cursor-pointer",
                        "data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary",
                        "hover:bg-muted transition-colors"
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{hit.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{hit.subtitle}</p>
                      </div>
                      <span className="ml-1 shrink-0 rounded-full border border-border bg-muted px-1.5 py-0 text-[9px] font-semibold uppercase text-muted-foreground">
                        {hit.kind}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5 font-mono">↵</kbd> open</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1 py-0.5 font-mono">ESC</kbd> close</span>
            <span className="ml-auto">Entity search scoped to active project</span>
          </div>
        </Command>
      </div>
    </>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
      className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search…</span>
      <kbd className="ml-1 rounded border border-border px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>
    </button>
  );
}
