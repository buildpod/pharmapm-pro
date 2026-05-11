import { SidebarContent } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar — hidden on mobile, hidden when printing */}
        <aside data-sidebar className="hidden md:flex md:w-56 md:shrink-0 md:flex-col border-r border-border print:hidden">
          <SidebarContent />
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div data-topbar className="print:hidden">
            <Topbar />
          </div>
          <main className="flex-1 overflow-y-auto p-6 print:p-6">{children}</main>
        </div>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
