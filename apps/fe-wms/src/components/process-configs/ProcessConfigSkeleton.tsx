"use client";

export function ProcessConfigSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg border border-gray-100 bg-white p-4"
          >
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="mt-4 h-6 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-lg border border-gray-100 bg-white p-4"
            >
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="mt-3 h-3 w-44 rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <div className="h-[520px] animate-pulse rounded-lg border border-gray-100 bg-white p-5">
          <div className="h-5 w-44 rounded bg-gray-200" />
          <div className="mt-6 h-20 rounded bg-gray-100" />
          <div className="mt-4 h-48 rounded bg-gray-100" />
          <div className="mt-4 h-28 rounded bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
