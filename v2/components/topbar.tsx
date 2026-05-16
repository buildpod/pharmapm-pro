"use client";

import { usePathname } from "next/navigation";
import { Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/sidebar";
import { CommandPaletteTrigger } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { ExportButton } from "@/components/projects/export-button";
import { useTheme } from "@/components/theme-provider";
import { useProject } from "@/components/projects/project-provider";
import { useState } from "react";

const routeLabels: Record<string, string> = {
  "/":           "Dashboard",
  "/my-items":   "My Items",
  "/projects":   "Projects",
  "/milestones": "Milestones",
  "/tasks":      "Tasks",
  "/risks":      "Risks",
  "/costs":      "Costs",
  "/resources":  "Resources",
  "/documents":  "Documents",
  "/reports":    "Reports",
  "/settings":   "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { activeProject } = useProject();

  const label =
    Object.entries(routeLabels).find(([path]) =>
      path === "/" ? pathname === "/" : pathname.startsWith(path)
    )?.[1] ?? "AivelloStudio RIM";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      {/* Mobile menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Breadcrumb — shows the active project as live context */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground hidden sm:block truncate">
          {activeProject.name} · {activeProject.phase}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* ⌘K search trigger */}
        <CommandPaletteTrigger />

        {/* Dark mode toggle */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Alerts — live derived from project entities */}
        <NotificationBell />

        {/* Export — wired in M19: produces the 8-sheet project workbook */}
        <div className="hidden sm:flex">
          <ExportButton project={activeProject} />
        </div>
      </div>
    </header>
  );
}
