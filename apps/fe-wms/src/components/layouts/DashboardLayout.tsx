"use client";

import { useSidebarStore } from "../../stores/useSidebarStore";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";
import TopBar from "./TopBar";

import GuideProvider from "../providers/GuideProvider";

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

    return (
        <GuideProvider>
            <div className="min-h-screen flex relative bg-[var(--color-surface-base)]">
                <Sidebar />
                <MobileDrawer />

                <main
                    id="wms-main-content"
                    className={`flex relative h-screen flex-col flex-1 gap-2 pb-[calc(var(--bottomnav-height)+env(safe-area-inset-bottom,0px))] transition-[margin-left] duration-300 ease-in-out lg:pb-0 ${isCollapsed
                        ? "lg:ml-[var(--sidebar-width-collapsed)] w-[calc(100vw-var(--sidebar-width-collapsed))]"
                        : "lg:ml-[var(--sidebar-width-expanded)] w-[calc(100vw-var(--sidebar-width-expanded))]"
                        }`}
                >
                    <TopBar />
                    <div className="relative flex w-full flex-1 flex-col overflow-y-auto px-4 pt-12">
                        {children}
                    </div>
                </main>

                <BottomNav />
            </div>
        </GuideProvider>
    );
}
