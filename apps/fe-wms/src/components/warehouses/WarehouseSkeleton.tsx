import { Skeleton } from "@/components/ui/Skeleton";

export function WarehouseTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 border-b border-[var(--color-border-soft)] p-4 last:border-b-0 md:grid-cols-5"
        >
          <Skeleton variant="text" className="h-4 w-3/4" />
          <Skeleton variant="text" className="h-4 w-24" />
          <Skeleton variant="text" className="h-4 w-28" />
          <Skeleton variant="text" className="h-4 w-20" />
          <Skeleton
            variant="rect"
            className="h-8 w-32 rounded-full md:justify-self-end"
          />
        </div>
      ))}
    </div>
  );
}
