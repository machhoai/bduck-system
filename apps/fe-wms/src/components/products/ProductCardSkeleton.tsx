export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="aspect-[4/3] animate-pulse bg-gray-100" />
      <div className="space-y-3 p-3">
        <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
        </div>
        <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
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
