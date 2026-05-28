"use client";

import { useSidebarStore } from "../../stores/useSidebarStore";
import { useUserStore } from "../../stores/useUserStore";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";
import NotificationBell from "../ui/NotificationBell";

/**
 * DashboardLayout — Main layout orchestrator
 *
 * ► Desktop (≥1024px): Sidebar (left) + content offset margin-left
 * ► Mobile (<1024px): Full-width content + BottomNav + MobileDrawer
 * ► Top bar: NotificationBell + user avatar (compact)
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const isCollapsed = useSidebarStore((s) => s.isCollapsed);
    const user = useUserStore((s) => s.user);

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
                {/* ── Compact top bar ── */}
                <div className="flex h-12 items-center justify-end gap-2 border-b border-gray-100 bg-white/80 px-4 backdrop-blur-sm">
                    <NotificationBell />
                    {user && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div className="mx-auto flex w-full flex-1 flex-col overflow-y-auto p-4 relative">
                    {children}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}

