export function PosProductVisibilitySkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="h-3 w-72 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-amber-100" />
      </div>
      <div className="h-9 rounded-lg bg-slate-100" />
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-xl border border-slate-200"
        >
          <div className="h-14 bg-slate-100" />
          <div className="space-y-px bg-slate-100">
            <div className="h-11 bg-white" />
            <div className="h-11 bg-white" />
          </div>
        </div>
      ))}
    </div>
  );
}
