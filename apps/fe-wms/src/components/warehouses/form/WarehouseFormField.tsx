"use client";

import type React from "react";

interface WarehouseFormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export const warehouseInputClassName =
  "h-8 w-full rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/15 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-card)] disabled:text-[var(--color-text-muted)]";

export function WarehouseFormField({
  label,
  required,
  hint,
  className = "",
  children,
}: WarehouseFormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
          {required && (
            <span className="ml-0.5 text-[var(--color-accent-error)]">*</span>
          )}
        </label>
        {hint && (
          <span className="text-xxs text-[var(--color-text-muted)]">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
