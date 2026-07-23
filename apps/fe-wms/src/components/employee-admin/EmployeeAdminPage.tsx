"use client";

import { gsap } from "gsap";
import { Building2, Sparkles, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminOverviewTab } from "./admin/AdminOverviewTab";
import { EmployeeAdminSkeleton } from "./EmployeeAdminSkeleton";
import {
    EmployeeAdminTabs,
    type EmployeeAdminTabKey,
} from "./EmployeeAdminTabs";
import { TimeAttendanceTab } from "./time-attendance/TimeAttendanceTab";
import { useMyEmployeeProfile } from "@/hooks/useEmployeeProfiles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";

function fallbackLabels(t: ReturnType<typeof useTranslation>["t"]) {
    return (t as any).employeeAdmin as Record<string, string>;
}

function getInitials(name: string) {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export function EmployeeAdminPage() {
    const { t } = useTranslation();
    const labels = fallbackLabels(t);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<EmployeeAdminTabKey>("time");
    const { profile, isLoading: profileLoading } = useMyEmployeeProfile();
    const { warehouses, loading: warehousesLoading } = useWarehouses();

    const warehouse = useMemo(
        () =>
            warehouses.find(
                (item) => item.id === profile?.workplace_warehouse_id,
            ) || null,
        [profile?.workplace_warehouse_id, warehouses],
    );

    const loading = profileLoading || warehousesLoading;
    const displayName = profile?.full_name || labels.employeeProfile;
    const employeeCode = profile?.employee_code || labels.notUpdated;

    useEffect(() => {
        if (!containerRef.current) return;
        const reduceMotion =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduceMotion) return;

        const items = containerRef.current.querySelectorAll(
            "[data-employee-admin-animate]",
        );
        gsap.fromTo(
            items,
            { y: 12, autoAlpha: 0 },
            {
                y: 0,
                autoAlpha: 1,
                duration: 0.36,
                stagger: 0.055,
                ease: "power2.out",
            },
        );
    }, [activeTab, loading]);

    if (loading) return <EmployeeAdminSkeleton />;

    return (
        <div ref={containerRef} className="flex flex-1 flex-col gap-3 lg:gap-4 lg:pb-0">
            <div className="flex gap-2 w-full">
                <div className="flex h-full aspect-square shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[var(--color-brand-primary)] to-blue-500 text-lg font-bold text-white shadow-md">
                    {profile?.full_name ? getInitials(profile.full_name) : <UserRound size={22} />}
                </div>
                <section
                    data-employee-admin-animate
                    className="flex-1 overflow-hidden rounded-2xl border border-white/80 bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:p-5 lg:shadow-none"
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="min-w-0">
                            <h1 className="truncate font-[var(--font-display)] text-lg font-bold text-[var(--color-text-primary)]">
                                {displayName}
                            </h1>
                            <p className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                <Building2 size={13} className="shrink-0" />
                                <span className="truncate">
                                    {employeeCode} - {warehouse?.name || labels.notUpdated}
                                </span>
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <div data-employee-admin-animate>
                <EmployeeAdminTabs
                    activeTab={activeTab}
                    labels={labels}
                    onChange={setActiveTab}
                />
            </div>

            {activeTab === "admin" ? (
                <AdminOverviewTab
                    labels={labels}
                    profile={profile}
                    warehouse={warehouse}
                    loading={loading}
                />
            ) : (
                <TimeAttendanceTab />
            )}
        </div>
    );
}
