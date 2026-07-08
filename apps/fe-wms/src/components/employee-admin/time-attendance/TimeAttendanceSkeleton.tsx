import { Skeleton } from "@/components/ui/Skeleton";

export function TimeAttendanceSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 w-full pb-4 lg:gap-4 lg:pb-0">
      <div className="rounded-[28px] bg-white p-4 shadow-sm lg:hidden">
        <Skeleton className="mb-2 h-4 w-20" variant="text" />
        <Skeleton className="mb-4 h-8 w-44" variant="text" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" variant="rect" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/80 bg-white p-5 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:bg-[var(--color-surface-elevated)] lg:shadow-none">
          <Skeleton className="mb-4 h-5 w-36" variant="text" />
          <Skeleton className="mb-3 h-16 w-full" variant="rect" />
          <Skeleton className="h-10 w-full" variant="rect" />
        </div>
        <div className="rounded-[28px] border border-white/80 bg-white p-5 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:bg-[var(--color-surface-elevated)] lg:shadow-none">
          <Skeleton className="mb-4 h-5 w-48" variant="text" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 21 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" variant="rect" />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[28px] border border-white/80 bg-white p-5 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:bg-[var(--color-surface-elevated)] lg:shadow-none">
        <Skeleton className="mb-4 h-5 w-44" variant="text" />
        <Skeleton className="h-48 w-full" variant="rect" />
      </div>
    </div>
  );
}
