"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type SnapPoint = "collapsed" | "half" | "full";

const SNAP_HEIGHTS: Record<SnapPoint, string> = {
  collapsed: "72px",
  half: "50vh",
  full: "90vh",
};

interface BottomSheetProps {
  children: ReactNode;
  title?: string;
  defaultSnap?: SnapPoint;
}

export function BottomSheet({
  children,
  title,
  defaultSnap = "collapsed",
}: BottomSheetProps) {
  const [snap, setSnap] = useState<SnapPoint>(defaultSnap);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const isDragging = useRef(false);

  const getHeightPx = useCallback(() => {
    if (!sheetRef.current) return 0;
    return sheetRef.current.getBoundingClientRect().height;
  }, []);

  const handleDragStart = useCallback(
    (clientY: number) => {
      isDragging.current = true;
      dragStartY.current = clientY;
      dragStartHeight.current = getHeightPx();
      if (sheetRef.current) {
        sheetRef.current.style.transition = "none";
      }
    },
    [getHeightPx],
  );

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging.current || !sheetRef.current) return;
    const delta = dragStartY.current - clientY;
    const newHeight = Math.max(72, dragStartHeight.current + delta);
    const maxHeight = window.innerHeight * 0.9;
    sheetRef.current.style.height = `${Math.min(newHeight, maxHeight)}px`;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;
    sheetRef.current.style.transition = "";

    const currentH = getHeightPx();
    const vh = window.innerHeight;

    if (currentH < vh * 0.25) {
      setSnap("collapsed");
    } else if (currentH < vh * 0.7) {
      setSnap("half");
    } else {
      setSnap("full");
    }
  }, [getHeightPx]);

  useEffect(() => {
    const handleMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientY);
    const handleEnd = () => handleDragEnd();
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);

    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);

    return () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  return (
    <div
      ref={sheetRef}
      style={{ height: SNAP_HEIGHTS[snap] }}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-[var(--radius-lg)] border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-[height] duration-300 ease-out md:hidden"
    >
      {/* Drag handle */}
      <div
        className="flex flex-shrink-0 cursor-grab touch-none flex-col items-center px-4 pb-2 pt-3 active:cursor-grabbing"
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onMouseDown={(e) => handleDragStart(e.clientY)}
      >
        <div className="h-1 w-10 rounded-full bg-[var(--color-border-subtle)]" />
        {title && (
          <p className="mt-2 w-full text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </p>
        )}
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {children}
      </div>
    </div>
  );
}
