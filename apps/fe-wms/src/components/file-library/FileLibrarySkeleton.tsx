import { Skeleton } from "@/components/ui/Skeleton";

export default function FileLibrarySkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-36 rounded-[var(--radius-md)]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-[var(--radius-md)]" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="hidden gap-2 lg:flex">
          <Skeleton className="h-10 w-24 rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-24 rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-24 rounded-[var(--radius-md)]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-16 rounded-[var(--radius-md)]"
          />
        ))}
      </div>

      <Skeleton className="h-12 rounded-[var(--radius-md)]" />

      <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] lg:block">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-7 gap-2 border-b border-[var(--color-border-soft)] p-2"
          >
            {Array.from({ length: 7 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-7" />
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-2 lg:hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-28 rounded-[var(--radius-md)]"
          />
        ))}
      </div>
    </div>
  );
}
