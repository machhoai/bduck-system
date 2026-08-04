export default function CustomerInvoiceRequestSkeleton() {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="skeleton-pulse h-6 w-48 rounded-full" />
        <div className="skeleton-pulse h-36 rounded-3xl" />
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="skeleton-pulse h-14 rounded-2xl" />
          <div className="skeleton-pulse h-14 rounded-2xl" />
          <div className="skeleton-pulse h-24 rounded-2xl" />
          <div className="skeleton-pulse h-14 rounded-2xl" />
          <div className="skeleton-pulse h-14 rounded-2xl" />
          <div className="skeleton-pulse h-14 rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
