import { SidebarContent } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPalette } from "@/components/command-palette";
import { ProjectProvider } from "@/components/projects/project-provider";
import { EntityStoreHydrator } from "@/components/stores/entity-store-hydrator";
import { Toaster } from "sonner";

// Refactored to the design-tokens.css app-shell structure:
//   .app-shell > .app-nav + .app-main > .app-topbar + .app-content
//
// The Topbar component is rendered inside .app-topbar to inherit the
// design system's typography and color tokens while keeping its existing
// command-palette / notification / export wiring.

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <EntityStoreHydrator />

        <div className="app-shell">
          <aside className="app-nav" data-sidebar>
            <SidebarContent />
          </aside>

          <main className="app-main">
            <header className="app-topbar" data-topbar>
              <Topbar />
            </header>
            <div className="app-content">{children}</div>
          </main>
        </div>

        {/* Global overlays */}
        <CommandPalette />
        <Toaster position="bottom-right" richColors closeButton />
      </ProjectProvider>
    </ThemeProvider>
  );
}
