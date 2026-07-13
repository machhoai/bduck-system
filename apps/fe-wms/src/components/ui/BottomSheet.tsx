"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type SnapPoint = "collapsed" | "half" | "full";

const SNAP_HEIGHTS: Record<SnapPoint, string> = {
    collapsed: "48px",
    half: "45vh",
    full: "88vh",
};

const COLLAPSED_HEIGHT = 48;
const DRAG_MOVE_THRESHOLD = 5;
const SNAP_MOVE_THRESHOLD = 40;
const MAX_HEIGHT_RATIO = 0.9;

interface BottomSheetProps {
    children: ReactNode;
    title?: string;
    defaultSnap?: SnapPoint;
    isOpen?: boolean;
    onClose?: () => void;
    zIndex?: number;
    contentClassName?: string;
    desktopClassName?: string;
    headerMode?: "default" | "handle-only";
    mobileBreakpoint?: "md" | "lg";
}

export function BottomSheet({
    children,
    title,
    defaultSnap = "collapsed",
    isOpen,
    onClose,
    zIndex = 40,
    contentClassName,
    desktopClassName,
    headerMode = "default",
    mobileBreakpoint = "md",
}: BottomSheetProps) {
    const [snap, setSnap] = useState<SnapPoint>(defaultSnap);
    const [dragHeight, setDragHeight] = useState<number | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [isDesktopLayout, setIsDesktopLayout] = useState(false);
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
    const sheetRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);
    const dragStartSnap = useRef<SnapPoint>("collapsed");
    const latestDragHeight = useRef<number | null>(null);
    const isDragging = useRef(false);
    const hasMoved = useRef(false);

    useEffect(() => {
        if (isOpen) {
            setSnap(defaultSnap);
        }
    }, [isOpen, defaultSnap]);

    useEffect(() => {
        setPortalContainer(document.body);
    }, []);

    useLayoutEffect(() => {
        if (!desktopClassName) {
            setIsDesktopLayout(false);
            return undefined;
        }

        const mediaQuery = window.matchMedia("(min-width: 768px)");
        const syncDesktopLayout = () => setIsDesktopLayout(mediaQuery.matches);

        syncDesktopLayout();
        mediaQuery.addEventListener("change", syncDesktopLayout);

        return () => mediaQuery.removeEventListener("change", syncDesktopLayout);
    }, [desktopClassName]);

    const getHeightPx = useCallback(() => {
        if (!sheetRef.current) return 0;
        return sheetRef.current.getBoundingClientRect().height;
    }, []);

    const closeSheet = useCallback(() => {
        isDragging.current = false;
        hasMoved.current = false;
        latestDragHeight.current = null;
        setDragHeight(null);
        setIsDragActive(false);
        if (onClose) {
            onClose();
        } else {
            setSnap("collapsed");
        }
    }, [onClose]);

    const handleDragStart = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (e.button !== 0) return;

            e.currentTarget.setPointerCapture(e.pointerId);
            const startHeight = getHeightPx();

            isDragging.current = true;
            hasMoved.current = false;
            dragStartY.current = e.clientY;
            dragStartHeight.current = startHeight;
            dragStartSnap.current = snap;
            latestDragHeight.current = startHeight;
            setDragHeight(startHeight);
            setIsDragActive(true);
        },
        [getHeightPx, snap],
    );

    const handleDragMove = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (!isDragging.current) return;

            const delta = dragStartY.current - e.clientY;
            if (Math.abs(delta) > DRAG_MOVE_THRESHOLD) {
                hasMoved.current = true;
            }
            if (!hasMoved.current) return;

            const newHeight = Math.max(onClose ? 20 : COLLAPSED_HEIGHT, dragStartHeight.current + delta);
            const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
            const nextHeight = Math.min(newHeight, maxHeight);
            latestDragHeight.current = nextHeight;
            setDragHeight(nextHeight);
        },
        [onClose],
    );

    const handleDragEnd = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (!isDragging.current) return;

            isDragging.current = false;

            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }

            setIsDragActive(false);

            const currentH = latestDragHeight.current ?? getHeightPx();
            const vh = window.innerHeight;
            latestDragHeight.current = null;
            setDragHeight(null);

            // If it was a click/tap, keep the current snap state.
            if (!hasMoved.current) {
                return;
            }

            const startH = dragStartHeight.current;
            const deltaY = currentH - startH; // Positive means dragged up, negative means dragged down

            let newSnap = dragStartSnap.current;

            if (deltaY > SNAP_MOVE_THRESHOLD) {
                if (dragStartSnap.current === "collapsed") {
                    newSnap = currentH > vh * 0.65 ? "full" : "half";
                } else if (dragStartSnap.current === "half") {
                    newSnap = "full";
                }
            } else if (deltaY < -SNAP_MOVE_THRESHOLD) {
                if (dragStartSnap.current === "full") {
                    newSnap = currentH < vh * 0.35 ? (onClose ? "collapsed" : "collapsed") : "half";
                    if (newSnap === "collapsed" && onClose && currentH < vh * 0.2) {
                        onClose();
                        return;
                    }
                } else if (dragStartSnap.current === "half") {
                    if (onClose) {
                        onClose();
                        return;
                    }
                    newSnap = "collapsed";
                } else if (dragStartSnap.current === "collapsed" && onClose) {
                    onClose();
                    return;
                }
            } else {
                newSnap = dragStartSnap.current;
            }

            setSnap(newSnap);
        },
        [getHeightPx, onClose],
    );

    const isContentVisible = snap !== "collapsed" || (dragHeight !== null && dragHeight > COLLAPSED_HEIGHT);

    useEffect(() => {
        if (isOpen === false) return undefined;
        // Controlled sheets already close through their backdrop; a global
        // outside-click listener would also close parent sheets in nested flows.
        if (onClose) return undefined;
        if (snap === "collapsed" && dragHeight === null && !onClose) return undefined;

        const handleOutsidePointerDown = (e: PointerEvent) => {
            const sheet = sheetRef.current;
            if (!sheet || sheet.contains(e.target as Node)) return;

            closeSheet();
        };

        window.addEventListener("pointerdown", handleOutsidePointerDown);

        return () => {
            window.removeEventListener("pointerdown", handleOutsidePointerDown);
        };
    }, [closeSheet, dragHeight, snap, isOpen, onClose]);

    // Determine visibility states for class lists
    const isSheetOpen = isOpen !== false;

    if (!portalContainer) return null;

    return createPortal(
        <>
            {/* Backdrop overlay for controllable sheets */}
            {onClose && (
                <div
                    style={{ zIndex: zIndex - 10 }}
                    className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${mobileBreakpoint === "lg" ? "lg:hidden" : "md:hidden"} ${isSheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
                    onClick={closeSheet}
                />
            )}

            <div
                ref={sheetRef}
                style={{
                    height: isDesktopLayout
                        ? "100%"
                        : dragHeight === null
                          ? SNAP_HEIGHTS[snap]
                          : `${dragHeight}px`,
                    bottom: isDesktopLayout ? 0 : "var(--bottomnav-height, 68px)",
                    transform: isSheetOpen ? "translateY(0)" : "translateY(100%)",
                    opacity: isSheetOpen ? 1 : 0,
                    pointerEvents: isSheetOpen ? "auto" : "none",
                    zIndex: zIndex,
                }}
                className={`fixed inset-x-0 flex max-h-[80%] flex-col overflow-hidden rounded-t-[var(--radius-lg)] border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] ${desktopClassName ? desktopClassName : mobileBreakpoint === "lg" ? "lg:hidden" : "md:hidden"} ${isDragActive ? "transition-none" : "transition-[height,transform,opacity] duration-300 ease-out"}`}
            >
                {/* Drag handle & Header */}
                <div
                    className={`flex flex-shrink-0 cursor-grab touch-none items-center justify-between px-4 pb-1.5 pt-2 active:cursor-grabbing border-b border-[var(--color-border-subtle)] ${desktopClassName ? "md:hidden" : ""}`}
                    onPointerDown={handleDragStart}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    onLostPointerCapture={handleDragEnd}
                >
                    <div className="w-8" />
                    <div className="flex flex-col items-center flex-1">
                        <div className="h-1 w-10 rounded-full bg-[var(--color-border-subtle)] mb-1" />
                        {title && (
                            <p className="text-xs font-semibold text-[var(--color-text-primary)] text-center">
                                {title}
                            </p>
                        )}
                    </div>
                    {onClose && headerMode === "default" ? (
                        <button
                            type="button"
                            onClick={closeSheet}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-850 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    ) : (
                        <div className="w-8" />
                    )}
                </div>

                {/* Content — scrollable */}
                <div
                    className={`${contentClassName ?? "flex-1 overflow-y-auto overscroll-contain px-4 pb-6"} transition-opacity duration-200 ${isContentVisible || onClose ? "opacity-100" : "opacity-0 pointer-events-none invisible"
                        }`}
                >
                    {children}
                </div>
            </div>
        </>,
        portalContainer,
    );
}
