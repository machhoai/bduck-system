export function WarehouseTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 border-b border-gray-100 p-4 last:border-b-0 md:grid-cols-5"
        >
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-100 md:justify-self-end" />
        </div>
      ))}
    </div>
  );
}
