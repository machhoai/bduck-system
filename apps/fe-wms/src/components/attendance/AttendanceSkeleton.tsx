import { Skeleton } from "@/components/ui/Skeleton";

export function AttendanceSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <Skeleton className="mb-4 h-5 w-36" variant="text" />
          <Skeleton className="mb-3 h-16 w-full" variant="rect" />
          <Skeleton className="h-10 w-full" variant="rect" />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <Skeleton className="mb-4 h-5 w-48" variant="text" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 21 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" variant="rect" />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-44" variant="text" />
        <Skeleton className="h-48 w-full" variant="rect" />
      </div>
    </div>
  );
}
