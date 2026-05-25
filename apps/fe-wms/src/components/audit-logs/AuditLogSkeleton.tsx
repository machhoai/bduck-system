import { Skeleton } from "@/components/ui/Skeleton";

export function AuditLogSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid gap-3 border-b border-[var(--color-border-soft)] py-3 last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)_160px]"
          >
            <Skeleton variant="rect" className="h-8 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton variant="text" className="h-4 w-2/3" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
            <Skeleton variant="text" className="h-4 w-32 md:justify-self-end" />
          </div>
        ))}
      </section>
      <aside className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-4">
        <Skeleton variant="text" className="mb-5 h-6 w-48" />
        <Skeleton variant="rect" className="mb-3 h-32 w-full rounded-[var(--radius-sm)]" />
        <Skeleton variant="rect" className="h-48 w-full rounded-[var(--radius-sm)]" />
      </aside>
    </div>
  );
}
