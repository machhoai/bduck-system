"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function RevenueDashboardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-brand-primary)] p-5 sm:col-span-2 xl:row-span-2">
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-3 w-28 opacity-30" variant="text" />
              <Skeleton className="mt-3 h-9 w-52 opacity-30" variant="text" />
              <Skeleton
                className="mt-2 h-5 w-16 rounded-full opacity-30"
                variant="rect"
              />
            </div>
            <Skeleton
              className="h-11 w-11 rounded-lg opacity-30"
              variant="rect"
            />
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-16 opacity-30"
                variant="rect"
              />
            ))}
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-9 w-9 rounded-lg" variant="rect" />
              <Skeleton className="h-5 w-14 rounded-full" variant="rect" />
            </div>
            <Skeleton className="mt-5 h-3 w-24" variant="text" />
            <Skeleton className="mt-2 h-6 w-32" variant="text" />
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
          <Skeleton
            className="mx-auto mt-4 h-[200px] w-[200px]"
            variant="circle"
          />
          <div className="mt-3 flex flex-col gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-1 py-1"
              >
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
