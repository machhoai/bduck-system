"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { X, Warehouse, LogOut } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import { useUserStore } from "../../stores/useUserStore";
import { useSidebarStore } from "../../stores/useSidebarStore";
import { menuItems, getVisibleMenuItems } from "../../config/menuConfig";
import { useLayoutMenuBadges } from "../providers/MenuBadgesProvider";
import { useAuth } from "../../hooks/useAuth";
import LanguageSwitcher from "./LanguageSwitcher";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * MobileDrawer - Redesigned full-screen dashboard grid menu with GSAP animations.
 */
export default function MobileDrawer() {
    const { t } = useTranslation();
    const pathname = usePathname();
    const isOpen = useSidebarStore((s) => s.isMobileDrawerOpen);
    const closeDrawer = useSidebarStore((s) => s.closeDrawer);
    const hasPermission = useUserStore((s) => s.hasPermission);
    const user = useUserStore((s) => s.user);
    const { logout, isLoading: isLoggingOut } = useAuth();

    const visibleItems = getVisibleMenuItems(menuItems, hasPermission);
    const badges = useLayoutMenuBadges();

    const backdropRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Disable background scrolling when drawer is open
    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // GSAP entrance and exit animations
    useEffect(() => {
        const backdrop = backdropRef.current;
        const container = containerRef.current;
        if (!backdrop || !container) return;

        const gridItems = container.querySelectorAll(".menu-grid-item");
        const header = container.querySelector(".menu-header");
        const footer = container.querySelector(".menu-footer");

        if (isOpen) {
            // Initial state layout setup (Stable parent dimensions, no nested relative translations)
            gsap.set(backdrop, { display: "block", opacity: 0 });
            gsap.set(container, { display: "flex", opacity: 0 });
            gsap.set(header, { opacity: 0, y: -10 });
            gsap.set(footer, { opacity: 0, y: 10 });
            gsap.set(gridItems, { opacity: 0, scale: 0.96, y: 12 });

            // GSAP butter-smooth entrance timeline (strictly under 0.5s)
            const tl = gsap.timeline();
            tl.to(backdrop, {
                opacity: 1,
                duration: 0.15,
                ease: "sine.out",
            })
                .to(container, {
                    opacity: 1,
                    duration: 0.18,
                    ease: "sine.out",
                }, "-=0.1")
                .to(header, {
                    opacity: 1,
                    y: 0,
                    duration: 0.15,
                    ease: "power2.out",
                }, "-=0.15")
                .to(gridItems, {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.22,
                    stagger: 0.012,
                    ease: "power3.out",
                }, "-=0.15")
                .to(footer, {
                    opacity: 1,
                    y: 0,
                    duration: 0.15,
                    ease: "power2.out",
                }, "-=0.15");

            return () => {
                tl.kill();
            };
        } else {
            // GSAP butter-smooth exit timeline (strictly under 0.5s)
            const tl = gsap.timeline({
                onComplete: () => {
                    gsap.set(backdrop, { display: "none" });
                    gsap.set(container, { display: "none" });
                }
            });

            tl.to(gridItems, {
                opacity: 0,
                scale: 0.96,
                y: 8,
                duration: 0.12,
                stagger: 0.01,
                ease: "power2.in",
            })
                .to(header, {
                    opacity: 0,
                    y: -8,
                    duration: 0.1,
                    ease: "power2.in"
                }, "-=0.15")
                .to(footer, {
                    opacity: 0,
                    y: 8,
                    duration: 0.1,
                    ease: "power2.in"
                }, "-=0.15")
                .to(container, {
                    opacity: 0,
                    duration: 0.15,
                    ease: "sine.inOut",
                }, "-=0.1")
                .to(backdrop, {
                    opacity: 0,
                    duration: 0.12,
                    ease: "sine.in",
                }, "-=0.12");

            return () => {
                tl.kill();
            };
        }
    }, [isOpen]);

    return (
        <>
            {/* Backdrop Overlay */}
            <div
                ref={backdropRef}
                style={{ display: "none" }}
                className="fixed inset-x-0 top-0 bottom-[var(--bottomnav-height)] z-[80] bg-black/40 backdrop-blur-[2px] lg:hidden"
                onClick={closeDrawer}
            />

            {/* Grid Menu Overlay Container */}
            <div
                ref={containerRef}
                style={{ display: "none" }}
                className="fixed inset-x-0 top-0 bottom-[var(--bottomnav-height)] z-[90] flex flex-col lg:hidden bg-slate-50/98 text-[var(--color-text-primary)] pt-[env(safe-area-inset-top,20px)] pb-4 shadow-2xl"
            >
                {/* Header Section */}
                <div
                    style={{ willChange: "transform, opacity" }}
                    className="menu-header flex h-12 shrink-0 items-center justify-between px-4 border-b border-[var(--color-border-soft)]"
                >
                    <div className="flex min-w-0 items-center gap-3 justify-center">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                            <img src="/logo/jw.png" alt="logo" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                {t.sidebar.systemName}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={closeDrawer}
                        className="
                            flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                            bg-white border border-slate-100 text-[var(--color-text-muted)] shadow-sm
                            transition-all active:scale-90 active:bg-slate-50
                        "
                        title={t.common.cancel}
                    >
                        <X size={18} strokeWidth={2} />
                    </button>
                </div>

                {/* Grid Menu Layout */}
                <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
                    <nav className="grid grid-cols-3 gap-3" onClick={closeDrawer}>
                        {visibleItems.map((item) => {
                            const isActive =
                                pathname === item.href ||
                                (pathname.startsWith(item.href + "/") &&
                                    !menuItems.some(
                                        (m) =>
                                            m.href !== item.href &&
                                            m.href.startsWith(item.href + "/") &&
                                            pathname.startsWith(m.href)
                                    ));
                            const Icon = item.icon;
                            const label =
                                t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey;
                            const badgeCount = item.badgeKey
                                ? badges[item.badgeKey as keyof typeof badges] || 0
                                : 0;

                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    style={{ willChange: "transform, opacity" }}
                                    className={`
                                        menu-grid-item relative flex aspect-square flex-col items-center justify-center gap-3.5 rounded-2xl border p-4 text-center
                                        active:scale-[0.96] transition-colors duration-150
                                        ${isActive
                                            ? "bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)] text-white shadow-lg shadow-blue-500/10 font-semibold"
                                            : "bg-white border-slate-100 text-[var(--color-text-secondary)] shadow-sm hover:bg-slate-50/50"
                                        }
                                    `}
                                >
                                    <div className={`
                                        flex h-11 w-11 items-center justify-center rounded-2xl
                                        ${isActive ? "bg-white/20 text-white" : "bg-slate-50 text-[var(--color-text-muted)]"}
                                    `}>
                                        <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                                    </div>
                                    <span className="text-[11px] font-semibold leading-tight max-w-[110px] break-words">
                                        {label}
                                    </span>
                                    {badgeCount > 0 && (
                                        <span className="absolute top-3 right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent-error)] px-1.5 text-micro font-bold text-white shadow-sm">
                                            {badgeCount > 99 ? "99+" : badgeCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Section: User Profile & Actions */}
                <div
                    style={{ willChange: "transform, opacity" }}
                    className="menu-footer relative top-2 flex justify-between items-center gap-2 border-t border-[var(--color-border-soft)] p-2 bg-white shrink-0"
                >
                    {user && (
                        <Link
                            href="/profile"
                            onClick={closeDrawer}
                            className="flex items-center gap-3 rounded-2xl transition-colors hover:bg-slate-50 active:bg-slate-100"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary-muted)] text-sm font-semibold text-[var(--color-brand-primary)]">
                                {user.full_name
                                    ?.split(" ")
                                    .map((word) => word[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                    {user.full_name}
                                </p>
                                <p className="truncate text-xs text-[var(--color-text-muted)]">
                                    {user.email}
                                </p>
                            </div>
                        </Link>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2 mr-2">
                        <LanguageSwitcher className="!text-[var(--color-text-secondary)] hover:!bg-slate-100 hover:!text-[var(--color-text-primary)]" />

                        <button
                            type="button"
                            onClick={() => {
                                closeDrawer();
                                void logout();
                            }}
                            disabled={isLoggingOut}
                            className="flex h-9 aspect-square items-center justify-center gap-2 rounded-xl border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-accent-error)] bg-red-50/50 hover:bg-red-50 active:bg-red-100/80 transition-colors disabled:opacity-40"
                        >
                            <LogOut size={16} strokeWidth={1.8} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
