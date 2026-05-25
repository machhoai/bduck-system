import { Skeleton } from "@/components/ui/Skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      <Skeleton variant="rect" className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-3">
        <Skeleton variant="text" className="h-4 w-4/5" />
        <Skeleton variant="text" className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton variant="rect" className="h-6 w-20 rounded-full" />
          <Skeleton variant="rect" className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton variant="rect" className="h-8 w-full rounded-[var(--radius-sm)]" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
