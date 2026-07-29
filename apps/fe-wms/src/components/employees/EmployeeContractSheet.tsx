"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";

interface EmployeeContractSheetProps {
  isOpen: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

export function EmployeeContractSheet({
  isOpen,
  title,
  closeLabel,
  onClose,
  children,
}: EmployeeContractSheetProps) {
  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-[170] hidden items-center justify-center p-4 md:flex">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-label={closeLabel}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
              >
                <X size={17} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </section>
        </div>
      ) : null}
      <BottomSheet
        title={title}
        isOpen={isOpen}
        onClose={onClose}
        defaultSnap="full"
        zIndex={170}
      >
        <div className="px-1 pb-12 pt-3 md:hidden">{children}</div>
      </BottomSheet>
    </>
  );
}
