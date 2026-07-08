"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface EmployeeAdminBottomSheetProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function EmployeeAdminBottomSheet({
  open,
  title,
  description,
  children,
  onClose,
}: EmployeeAdminBottomSheetProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isMobile) {
    return (
      <BottomSheet
        title={title}
        isOpen={open}
        onClose={onClose}
        defaultSnap="full"
      >
        <div className="py-2 px-1 pb-16">
          {description && (
            <p className="mb-4 text-xs text-[var(--color-text-muted)] leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </div>
      </BottomSheet>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-all duration-300"
        onClick={onClose}
      />

      {/* Dialog container */}
      <div className="relative z-50 flex max-h-[90vh] w-full max-w-[540px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
