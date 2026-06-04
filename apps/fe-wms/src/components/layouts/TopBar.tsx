"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import NotificationBell from "../ui/NotificationBell";
import ClockWeatherWidget from "../ui/ClockWeatherWidget";
import DeviceStatusIndicator from "../ui/DeviceStatusIndicator";
import { BreadcrumbNav } from "../ui/BreadcrumbNav";

export default function TopBar() {
    const { lang } = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const [isAtDashboard, setIsAtDashboard] = useState(pathname === "/dashboard");
    const [scrolled, setScrolled] = useState(false);

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

    return (
        <div className="flex absolute top-0 z-50 h-20 w-full items-start justify-between gap-2 px-4 pt-2">
            {/*
             * Gradient blur overlay:
             * - Trên cùng: blur đầy + bg mờ (opaque mask)
             * - Xuống dưới: blur biến mất dần (transparent mask)
             * backdrop-filter không support gradient trực tiếp,
             * dùng CSS mask để clip vùng blur theo chiều dọc.
             */}
            <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${scrolled ? "opacity-100" : "opacity-0"
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
            <NotificationBell />
        </div>
    );
}
