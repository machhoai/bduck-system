"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BellRing, Download, HelpCircle } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useNextStep } from "nextstepjs";
import NotificationBell from "../ui/NotificationBell";
import ClockWeatherWidget from "../ui/ClockWeatherWidget";
import DeviceStatusIndicator from "../ui/DeviceStatusIndicator";
import { BreadcrumbNav } from "../ui/BreadcrumbNav";
import { useExportStore } from "../../stores/useExportStore";
import type { ExportRequestOptions } from "@/utils/exportExcel";
import { getGuideTourName } from "../../config/tours";
import { gooeyToast } from "goey-toast";
import IonIcon from "../ui/IonIcon";
import { folder } from "ionicons/icons";
import { useDevicePushNotifications } from "@/hooks/useDevicePushNotifications";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";

const WarehouseExportModal = dynamic(() =>
    import("./WarehouseExportModal").then((module) => module.WarehouseExportModal),
);

const TOPBAR_PWA_TEXT = {
    vi: {
        enablePush: "Bật thông báo thiết bị",
        pushEnabled: "Đã bật thông báo thiết bị",
        pushEnabledDesc: "Hệ thống sẽ gửi thông báo qua trình duyệt khi có việc mới.",
        pushDenied: "Trình duyệt đang chặn thông báo",
        pushDeniedDesc: "Hãy mở cài đặt trang web của trình duyệt và cho phép Notifications.",
        pushDismissed: "Chưa bật thông báo",
        pushDismissedDesc: "Bạn có thể bấm lại nút chuông để cấp quyền khi cần.",
        pushUnsupported: "Thiết bị chưa hỗ trợ thông báo",
        pushUnsupportedDesc: "Trình duyệt hoặc cấu hình hệ thống hiện chưa hỗ trợ Web Push.",
        installApp: "Tải ứng dụng",
        installManual: "Thêm ứng dụng vào màn hình chính",
        installManualDesc: "Mở menu chia sẻ của trình duyệt rồi chọn Add to Home Screen.",
    },
    zh: {
        enablePush: "开启设备通知",
        pushEnabled: "设备通知已开启",
        pushEnabledDesc: "有新任务时，系统会通过浏览器发送通知。",
        pushDenied: "浏览器已阻止通知",
        pushDeniedDesc: "请在站点设置中允许 Notifications。",
        pushDismissed: "尚未开启通知",
        pushDismissedDesc: "需要时可再次点击铃铛按钮授权。",
        pushUnsupported: "当前设备不支持通知",
        pushUnsupportedDesc: "浏览器或系统配置暂不支持 Web Push。",
        installApp: "安装应用",
        installManual: "添加到主屏幕",
        installManualDesc: "打开浏览器分享菜单，然后选择 Add to Home Screen。",
    },
} as const;

export default function TopBar() {
    const { lang, t } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const [isAtDashboard, setIsAtDashboard] = useState(pathname === "/dashboard");
    const [scrolled, setScrolled] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const { exportConfig, isExporting, triggerExport } = useExportStore();
    const { startNextStep } = useNextStep();
    const pushNotifications = useDevicePushNotifications();
    const pwaInstall = usePwaInstallPrompt();
    const pwaCopy = TOPBAR_PWA_TEXT[lang === "zh" ? "zh" : "vi"];
    const isGlassMode = isAtDashboard && !scrolled;

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

    const handleEnablePush = async () => {
        try {
            const permission = await pushNotifications.requestPermission();
            if (permission === "granted") {
                gooeyToast.success(pwaCopy.pushEnabled, {
                    description: pwaCopy.pushEnabledDesc,
                    preset: "snappy",
                });
                return;
            }

            if (permission === "denied") {
                gooeyToast.error(pwaCopy.pushDenied, {
                    description: pwaCopy.pushDeniedDesc,
                    preset: "snappy",
                });
                return;
            }

            if (permission === "unsupported") {
                gooeyToast.error(pwaCopy.pushUnsupported, {
                    description: pwaCopy.pushUnsupportedDesc,
                    preset: "snappy",
                });
                return;
            }

            gooeyToast.info(pwaCopy.pushDismissed, {
                description: pwaCopy.pushDismissedDesc,
                preset: "snappy",
            });
        } catch (error) {
            console.error("[TopBar] enable push failed:", error);
            gooeyToast.error(pwaCopy.pushUnsupported, {
                description:
                    error instanceof Error ? error.message : pwaCopy.pushUnsupportedDesc,
                preset: "snappy",
            });
        }
    };

    const handleInstallApp = async () => {
        try {
            const outcome = await pwaInstall.promptInstall();
            if (outcome === "manual") {
                gooeyToast.info(pwaCopy.installManual, {
                    description: pwaCopy.installManualDesc,
                    preset: "snappy",
                    timing: { displayDuration: 7000 },
                });
            }
        } catch (error) {
            console.error("[TopBar] install prompt failed:", error);
            gooeyToast.info(pwaCopy.installManual, {
                description: pwaCopy.installManualDesc,
                preset: "snappy",
                timing: { displayDuration: 7000 },
            });
        }
    };

    return (
        <div id="wms-topbar" className={`flex absolute top-0 left-0 right-0 z-50 items-start justify-between gap-2 px-2 md:px-4 pt-2 ${scrolled ? "h-20" : "h-12"}`}>
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
                <div className={`${isAtDashboard ? "flex" : "hidden md:flex"} items-center gap-2`}>
                    <ClockWeatherWidget locale={(lang || "vi") as "vi" | "zh"} glass={isGlassMode} />
                    <DeviceStatusIndicator glass={isGlassMode} />
                </div>
            </div>
            <div className="flex h-full gap-2">
                <div className="hidden md:block overflow-hidden z-50">
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
                    className={`hidden md:flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all duration-300 z-50 ${
                        isGlassMode
                            ? "bg-white/12 border border-white/20 text-white backdrop-blur-md hover:bg-white/18 hover:border-white/30"
                            : "bg-white border border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                    }`}
                    title="Hướng dẫn sử dụng"
                >
                    <HelpCircle size={18} strokeWidth={2} />
                </button>
                {pushNotifications.shouldShowButton && (
                    <button
                        id="wms-enable-push-button"
                        onClick={() => void handleEnablePush()}
                        disabled={pushNotifications.isBusy}
                        className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all duration-300 disabled:opacity-50 z-50 ${
                            isGlassMode
                                ? "bg-white/12 border border-white/20 text-white backdrop-blur-md hover:bg-white/18 hover:border-white/30"
                                : "bg-white border border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                        }`}
                        title={pwaCopy.enablePush}
                        aria-label={pwaCopy.enablePush}
                    >
                        <BellRing size={18} strokeWidth={2} />
                    </button>
                )}
                {pwaInstall.canShowInstallButton && (
                    <button
                        id="wms-install-app-button"
                        onClick={() => void handleInstallApp()}
                        className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-all duration-300 z-50 ${
                            isGlassMode
                                ? "bg-white/12 border border-white/20 text-white backdrop-blur-md hover:bg-white/18 hover:border-white/30"
                                : "bg-white border border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                        }`}
                        title={pwaCopy.installApp}
                        aria-label={pwaCopy.installApp}
                    >
                        <Download size={18} strokeWidth={2} />
                    </button>
                )}
                <NotificationBell glass={isGlassMode} />
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
