"use client";

import { Skeleton } from "../../ui/Skeleton";

export default function ExportVoucherSkeleton() {
  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
      <div className="border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-[var(--radius-md)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-32" variant="text" />
            <Skeleton className="h-3.5 w-64 max-w-full" variant="text" />
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 lg:px-0 lg:py-5">
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm"
            >
              <Skeleton className="h-3 w-20" variant="text" />
              <Skeleton className="mt-2 h-9 w-12 rounded-lg" />
            </div>
          ))}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white/95 p-1 shadow-sm">
          <div className="grid grid-cols-3 gap-1">
            <Skeleton className="h-11 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-11 rounded-[var(--radius-sm)]" />
            <Skeleton className="h-11 rounded-[var(--radius-sm)]" />
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" variant="text" />
                  <Skeleton className="h-3.5 w-56" variant="text" />
                  <Skeleton className="h-3 w-32" variant="text" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 w-24 rounded-[var(--radius-sm)]" />
                <Skeleton className="h-8 w-24 rounded-[var(--radius-sm)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
