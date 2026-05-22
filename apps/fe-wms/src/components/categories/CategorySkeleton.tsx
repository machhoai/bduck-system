'use client';

/**
 * Skeleton loading cho Category page (LUẬT THÉP: phải có skeleton)
 * Desktop: mimics tree rows
 * Mobile: mimics card items
 */
export default function CategorySkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
              <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
              <div className="flex gap-1">
                <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
                <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile skeleton */}
      <div className="space-y-2 md:hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm">
            <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="flex gap-1">
              <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-200" />
              <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
