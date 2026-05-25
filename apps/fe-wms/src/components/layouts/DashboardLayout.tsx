"use client";

import { useSidebarStore } from "../../stores/useSidebarStore";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";

/**
 * DashboardLayout — Main layout orchestrator
 *
 * ► Desktop (≥1024px): Sidebar (left) + content offset margin-left
 * ► Mobile (<1024px): Full-width content + BottomNav + MobileDrawer
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      <Sidebar />
      <MobileDrawer />

      <main
        id="wms-main-content"
        className={`flex h-screen flex-col pb-[calc(var(--bottomnav-height)+env(safe-area-inset-bottom,0px))] transition-[margin-left] duration-300 ease-in-out lg:pb-0 ${isCollapsed
          ? "lg:ml-[var(--sidebar-width-collapsed)]"
          : "lg:ml-[var(--sidebar-width-expanded)]"
          }`}
      >
        <div className="mx-auto flex w-full flex-1 flex-col overflow-y-auto p-4">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
