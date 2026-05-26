"use client";

/**
 * InventoryDashboardSkeleton — Full skeleton cho inventory dashboard
 *
 * ► LUẬT THÉP: Skeleton loading mô phỏng cấu trúc dashboard
 */

import { Skeleton } from "@/components/ui/Skeleton";

export default function InventoryDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="mb-2 h-4 w-24" variant="text" />
          <Skeleton className="h-8 w-56" variant="text" />
        </div>
        <Skeleton className="h-10 w-40" variant="rect" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <Skeleton className="h-10 w-10" variant="rect" />
              <Skeleton className="h-4 w-16" variant="text" />
            </div>
            <Skeleton className="h-8 w-20" variant="text" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <Skeleton className="mb-4 h-5 w-40" variant="text" />
          <Skeleton className="mx-auto h-[200px] w-[200px]" variant="circle" />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <Skeleton className="mb-4 h-5 w-48" variant="text" />
          <Skeleton className="h-[220px] w-full" variant="rect" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <Skeleton className="mb-4 h-5 w-48" variant="text" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-10 w-full" variant="rect" />
          ))}
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <Skeleton className="mb-4 h-5 w-40" variant="text" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-8 w-full" variant="rect" />
          ))}
        </div>
      </div>
    </div>
  );
}
