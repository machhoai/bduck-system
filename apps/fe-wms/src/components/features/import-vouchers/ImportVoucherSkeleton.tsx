"use client";

/**
 * ImportVoucherSkeleton — Loading skeleton cho trang nhập kho
 *
 * LUẬT THÉP: Skeleton loading mô phỏng cấu trúc UI.
 * Không dùng spinner hoặc màn hình trắng.
 */

import { Skeleton } from "../../ui/Skeleton";

export default function ImportVoucherSkeleton() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-32" variant="text" />
          <Skeleton className="h-3.5 w-56" variant="text" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-1">
        <Skeleton className="h-9 w-24 rounded-[var(--radius-xs)]" />
        <Skeleton className="h-9 w-28 rounded-[var(--radius-xs)]" />
        <Skeleton className="h-9 w-20 rounded-[var(--radius-xs)]" />
      </div>

      {/* Content cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40" variant="text" />
                <Skeleton className="h-3.5 w-56" variant="text" />
                <Skeleton className="h-3 w-32" variant="text" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-8 w-24 rounded-[var(--radius-xs)]" />
              <Skeleton className="h-8 w-20 rounded-[var(--radius-xs)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
