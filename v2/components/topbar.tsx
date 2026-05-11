"use client";

import { usePathname } from "next/navigation";
import { Menu, Search, Bell, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/sidebar";
import { useState } from "react";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/milestones": "Milestones",
  "/tasks": "Tasks",
  "/risks": "Risks",
  "/costs": "Costs",
  "/documents": "Documents",
  "/reports": "Reports",
};

export function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const label =
    Object.entries(routeLabels).find(([path]) =>
      path === "/" ? pathname === "/" : pathname.startsWith(path)
    )?.[1] ?? "AivelloStudio RIM";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      {/* Mobile menu trigger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Breadcrumb */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Veeva RIM Implementation · Phase 2
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="sr-only">Alerts</span>
        </Button>
        <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 h-8">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}
