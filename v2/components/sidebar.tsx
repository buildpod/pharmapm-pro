"use client";

// Refactored to the AivelloStudio design system (design-tokens.css +
// components.css). Uses .nav-brand / .nav-project / .nav-group /
// .nav-item / .nav-user classes — no Tailwind on this surface.
//
// Data + routing unchanged; only the visual shell was swapped.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Milestone,
  CheckSquare,
  AlertTriangle,
  AlertOctagon,
  DollarSign,
  FileText,
  BarChart2,
  Settings,
  Users,
  Inbox,
  Scroll,
  Scale,
  Activity,
} from "lucide-react";
import { useProject } from "@/components/projects/project-provider";

const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Activity",  href: "/activity", icon: Activity },
      { label: "My Items",  href: "/my-items", icon: Inbox },
    ],
  },
  {
    label: "Planning",
    items: [
      { label: "Charter",    href: "/charter",    icon: Scroll },
      { label: "Milestones", href: "/milestones", icon: Milestone },
      { label: "Tasks",      href: "/tasks",      icon: CheckSquare },
    ],
  },
  {
    label: "Risk & Finance",
    items: [
      { label: "Risks",  href: "/risks",  icon: AlertTriangle, count: "3" },
      { label: "Issues", href: "/issues", icon: AlertOctagon },
      { label: "Costs",  href: "/costs",  icon: DollarSign },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Resources", href: "/resources", icon: Users },
    ],
  },
  {
    label: "Documentation",
    items: [
      { label: "Documents", href: "/documents", icon: FileText, count: "2", countTone: "info" as const },
      { label: "Decisions", href: "/decisions", icon: Scale },
      { label: "Reports",   href: "/reports",   icon: BarChart2 },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { activeProject } = useProject();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Brand */}
      <div className="nav-brand">
        <div className="nav-brand__mark">A</div>
        <div className="nav-brand__name">AivelloStudio<span> RIM</span></div>
      </div>

      {/* Active project */}
      <div className="nav-project">
        <div className="nav-project__name">{activeProject.name}</div>
        <div className="nav-project__phase">{activeProject.phase}</div>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: "auto", paddingBottom: "var(--space-3)" }}>
        {navGroups.map((group) => (
          <div key={group.label} className="nav-group">
            <div className="nav-group__title">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={active ? "nav-item nav-item--active" : "nav-item"}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                    <Icon className="nav-item__icon" />
                    {item.label}
                  </span>
                  {"count" in item && item.count && (
                    <span
                      className={
                        "countTone" in item && item.countTone === "info"
                          ? "nav-item__count nav-item__count--info"
                          : "nav-item__count"
                      }
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="nav-user">
        <div className="nav-user__avatar">VP</div>
        <div>
          <div className="nav-user__name">Vineet Pathak</div>
          <div className="nav-user__role">Project Manager</div>
        </div>
      </div>
    </>
  );
}
