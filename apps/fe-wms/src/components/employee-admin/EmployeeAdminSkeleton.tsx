import { Skeleton } from "@/components/ui/Skeleton";

export function EmployeeAdminSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 pb-4 lg:gap-4 lg:pb-0">
      <div className="rounded-[28px] bg-white p-4 shadow-sm lg:rounded-[var(--radius-lg)]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14" variant="circle" />
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-36" variant="text" />
            <Skeleton className="h-3 w-48" variant="text" />
          </div>
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-full lg:w-80" variant="rect" />
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <Skeleton className="h-56 w-full rounded-[28px]" variant="rect" />
        <Skeleton className="h-56 w-full rounded-[28px]" variant="rect" />
      </div>
      <Skeleton className="h-64 w-full rounded-[28px]" variant="rect" />
    </div>
  );
}
