"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useNextStep } from "nextstepjs";
import NotificationBell from "../ui/NotificationBell";
import ClockWeatherWidget from "../ui/ClockWeatherWidget";
import DeviceStatusIndicator from "../ui/DeviceStatusIndicator";
import { BreadcrumbNav } from "../ui/BreadcrumbNav";
import { useExportStore } from "../../stores/useExportStore";
import { WarehouseExportModal } from "./WarehouseExportModal";
import type { ExportRequestOptions } from "@/utils/exportExcel";
import { getGuideTourName } from "../../config/tours";
import { gooeyToast } from "goey-toast";
import IonIcon from "../ui/IonIcon";
import { folder } from "ionicons/icons";

export default function TopBar() {
    const { lang, t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const [isAtDashboard, setIsAtDashboard] = useState(pathname === "/dashboard");
    const [scrolled, setScrolled] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const { exportConfig, isExporting, triggerExport } = useExportStore();
    const { startNextStep } = useNextStep();

    useEffect(() => {
        const container = document.querySelector<HTMLElement>(
            "#wms-main-content > div.overflow-y-auto"
        );
        if (!container) return;

        const onScroll = () => setScrolled(container.scrollTop > 8);
        container.addEventListener("scroll", onScroll, { passive: true });
        return () => container.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        setIsAtDashboard(pathname === "/dashboard");
    }, [pathname]);

    const runExport = async (options?: ExportRequestOptions) => {
        const exportTask = triggerExport(options);
        gooeyToast.promise(exportTask, {
            loading: t.common.exporting,
            success: t.common.exportSuccess,
            error: t.common.exportError,
            preset: 'snappy',
            description: {
                success: t.common.exportSuccessDescription,
                error: t.common.exportErrorDescription
            }
        });
        try {
            await exportTask;
            setIsExportModalOpen(false);
        } catch {
            // Toast already renders the export failure from the same promise.
        }
    };

    return (
        <div id="wms-topbar" className={`flex absolute top-0 z-50 w-full items-start justify-between gap-2 px-4 pt-2 ${scrolled ? "h-20" : "h-12"}`}>
            {/*
             * Gradient blur overlay:
             * - Trên cùng: blur đầy + bg mờ (opaque mask)
             * - Xuống dưới: blur biến mất dần (transparent mask)
             * backdrop-filter không support gradient trực tiếp,
             * dùng CSS mask để clip vùng blur theo chiều dọc.
             */}
            <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${scrolled ? "opacity-100" : "opacity-0 hidden"
                    }`}
                style={{
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    background:
                        "linear-gradient(to bottom, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.18) 75%, transparent 100%)",
                    WebkitMask:
                        "linear-gradient(to bottom, black 0%, black 45%, transparent 100%)",
                    mask: "linear-gradient(to bottom, black 0%, black 45%, transparent 100%)",
                }}
            />


            {/* Content — above the blur overlay */}
            <div className={`relative h-8 flex items-center gap-2 ${isAtDashboard ? "-translate-x-10" : ""} transition-all duration-300`}>
                <button
                    onClick={() => router.back()}
                    disabled={isAtDashboard}
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--color-text-muted)] shadow-sm transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)] ${isAtDashboard ? "opacity-0 " : "opacity-100"} transition-all duration-300`}
                    title="Quay lại"
                >
                    <ArrowLeft size={16} strokeWidth={2} />
                </button>
                <BreadcrumbNav />
                <ClockWeatherWidget locale={(lang || "vi") as "vi" | "zh"} />
                <DeviceStatusIndicator />
            </div>
            <div className="flex h-full gap-2">
                <div className="overflow-hidden z-50">
                    <button
                        id="wms-export-button"
                        onClick={() => {
                            if (exportConfig?.dialog?.type === "warehouse") {
                                setIsExportModalOpen(true);
                                return;
                            }
                            void runExport();
                        }}
                        disabled={isExporting}
                        className={`flex h-8 px-3 items-center gap-1.5 justify-center rounded-full bg-green-600 text-[var(--color-text-on-dark)] shadow-sm hover:bg-green-700 disabled:opacity-50 transition-all duration-300 ${exportConfig ? "" : "translate-x-[120px]"}`}
                        title={t.common.exportExcel}
                    >
                        <IonIcon icon={folder} size={18} />
                        <span className="text-sm font-medium">{t.common.exportExcel}</span>
                    </button>
                </div>
                <button
                    id="wms-help-button"
                    onClick={() => {
                        startNextStep(getGuideTourName(pathname));
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--color-text-muted)] shadow-sm transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)] z-50"
                    title="Hướng dẫn sử dụng"
                >
                    <HelpCircle size={18} strokeWidth={2} />
                </button>
                <NotificationBell />
            </div>
            {exportConfig?.dialog?.type === "warehouse" && (
                <WarehouseExportModal
                    isOpen={isExportModalOpen}
                    config={exportConfig.dialog}
                    isExporting={isExporting}
                    onClose={() => setIsExportModalOpen(false)}
                    onSubmit={runExport}
                />
            )}
        </div>
    );
}
