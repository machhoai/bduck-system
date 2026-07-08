"use client";

import { useSidebarStore } from "../../stores/useSidebarStore";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";
import TopBar from "./TopBar";


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
        <div className="h-screen flex relative bg-slate-200">
            <Sidebar />
            <MobileDrawer />

            <main
                id="wms-main-content"
                className={`flex relative h-screen min-h-0 flex-col flex-1 gap-2 transition-[margin-left] pb-[var(--bottomnav-height)] duration-300 ease-in-out lg:pb-0 ${isCollapsed
                    ? "lg:ml-[var(--sidebar-width-collapsed)] w-[calc(100vw-var(--sidebar-width-collapsed))]"
                    : "lg:ml-[var(--sidebar-width-expanded)] w-[calc(100vw-var(--sidebar-width-expanded))]"
                    }`}
            >
                <TopBar />
                <div className="relative flex w-full flex-1 flex-col overflow-y-auto px-2 pt-12 pb-0 lg:pl-4 lg:pr-2 lg:pt-12 lg:pb-0">
                    <div id="wms-content-viewport" className="relative flex min-h-full w-full flex-col">
                        {children}
                    </div>
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
