"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Milestone,
  CheckSquare,
  AlertTriangle,
  DollarSign,
  FileText,
  BarChart2,
  FlaskConical,
  Settings,
  Users,
  Inbox,
  Scroll,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

const navGroups = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "My Items",  href: "/my-items", icon: Inbox },
    ],
  },
  {
    label: "PLANNING",
    items: [
      { label: "Charter", href: "/charter", icon: Scroll },
      { label: "Milestones", href: "/milestones", icon: Milestone },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    label: "RISK & FINANCE",
    items: [
      { label: "Risks", href: "/risks", icon: AlertTriangle, badge: "3" },
      { label: "Costs", href: "/costs", icon: DollarSign },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { label: "Resources", href: "/resources", icon: Users },
    ],
  },
  {
    label: "DOCUMENTATION",
    items: [
      { label: "Documents", href: "/documents", icon: FileText, badge: "2" },
      { label: "Reports", href: "/reports", icon: BarChart2 },
    ],
  },
  {
    label: "CONFIGURATION",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <FlaskConical className="h-5 w-5 text-primary" />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-foreground">AivelloStudio</span>
          <span className="text-xs text-muted-foreground">RIM Cloud</span>
        </div>
      </div>

      {/* Project switcher */}
      <div className="px-4 py-3">
        <ProjectSwitcher />
      </div>

      <Separator />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {"badge" in item && item.badge && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      {/* User */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
            VP
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-none">
          <span className="text-xs font-medium text-foreground">Vineet Pathak</span>
          <span className="text-[10px] text-muted-foreground">Project Manager</span>
        </div>
      </div>
    </div>
  );
}
