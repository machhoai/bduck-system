"use client";

/**
 * ExportVoucherSkeleton — Loading skeleton for export voucher page
 * LUẬT THÉP: Skeleton mô phỏng cấu trúc UI, không spinner.
 */

export default function ExportVoucherSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 lg:gap-5 lg:p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />
        ))}
      </div>

      {/* Card skeletons */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
