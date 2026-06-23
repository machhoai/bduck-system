"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function RevenueDashboardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      {/* Context bar */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" variant="rect" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-36" variant="text" />
              <Skeleton className="h-3 w-52" variant="text" />
            </div>
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" variant="rect" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" variant="text" />
              <Skeleton className="h-4 w-36" variant="text" />
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`rounded-[var(--radius-lg)] p-3 ${i === 0 ? "bg-[var(--color-brand-primary)]" : "bg-[var(--color-surface-elevated)]"}`}>
            <div className="flex items-center gap-2">
              <Skeleton className={`h-4 w-4 ${i === 0 ? "opacity-30" : ""}`} variant="rect" />
              <Skeleton className={`h-3 w-24 ${i === 0 ? "opacity-30" : ""}`} variant="text" />
            </div>
            <Skeleton className={`mt-2 h-7 w-36 ${i === 0 ? "opacity-30" : ""}`} variant="text" />
            <div className="mt-2 flex items-center justify-between">
              <Skeleton className={`h-3 w-20 ${i === 0 ? "opacity-30" : ""}`} variant="text" />
              <Skeleton className={`h-5 w-14 rounded-full ${i === 0 ? "opacity-30" : ""}`} variant="rect" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
          <Skeleton className="h-4 w-44" variant="text" />
          <Skeleton className="mt-1 h-3 w-60" variant="text" />
          <Skeleton className="mt-4 h-[280px] w-full" variant="rect" />
        </div>
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4">
          <Skeleton className="h-4 w-36" variant="text" />
          <Skeleton className="mt-1 h-3 w-48" variant="text" />
          <Skeleton className="mx-auto mt-4 h-[200px] w-[200px]" variant="circle" />
          <div className="mt-3 flex flex-col gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" variant="rect" />
                  <Skeleton className="h-3 w-20" variant="text" />
                </div>
                <Skeleton className="h-3 w-10" variant="text" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
