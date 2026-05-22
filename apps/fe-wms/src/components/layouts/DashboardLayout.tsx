'use client';

import { useSidebarStore } from '../../stores/useSidebarStore';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileDrawer from './MobileDrawer';

/**
 * DashboardLayout — Main layout orchestrator
 *
 * ► Desktop (≥1024px): Sidebar (left) + content offset margin-left
 * ► Mobile (<1024px): Full-width content + BottomNav + MobileDrawer
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);

  return (
    <div className="min-h-screen bg-[var(--color-surface-base)]">
      <Sidebar />
      <MobileDrawer />

      <main
        id="wms-main-content"
        className="min-h-screen pb-[var(--bottomnav-height)] lg:pb-0 transition-[margin-left] duration-300 ease-in-out"
        style={{
          marginLeft: isCollapsed
            ? 'var(--sidebar-width-collapsed)'
            : 'var(--sidebar-width-expanded)',
        }}
      >
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
