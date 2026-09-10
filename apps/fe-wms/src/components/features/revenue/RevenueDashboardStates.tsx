import { AlertTriangle, PackageSearch } from "lucide-react";

export function RevenueDashboardError({
  message,
}: {
  message?: string | null;
}) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-rose-200 bg-[var(--color-error-bg)] p-3 text-sm text-[var(--color-error-text)]">
      <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function RevenueDashboardEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 text-center shadow-sm">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-muted)]">
        <PackageSearch size={22} aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
      </p>
    </div>
  );
}
