"use client";

import Skeleton from "@/components/ui/Skeleton";

export default function SystemSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-80 w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="h-96 w-full rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}
