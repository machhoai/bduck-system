import { Skeleton } from "../ui/Skeleton";

/**
 * DashboardSkeleton — Skeleton loading mô phỏng cấu trúc Dashboard Layout
 *
 * ► Hiển thị khi đang check auth / tải dữ liệu
 * ► LUẬT THÉP: KHÔNG dùng spinner, phải mô phỏng đúng cấu trúc UI
 */
export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-base)] flex">
      {/* Sidebar skeleton (desktop only) */}
      <aside className="hidden h-screen w-[var(--sidebar-width-expanded)] shrink-0 flex-col border-r border-white/10 bg-[var(--color-surface-nav)] p-4 lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton variant="rect" className="w-8 h-8" />
          <Skeleton variant="text" className="w-28 h-4" />
        </div>

        {/* Menu items */}
        <div className="space-y-2 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton variant="rect" className="w-5 h-5 shrink-0" />
              <Skeleton variant="text" className="w-24 h-4" />
            </div>
          ))}
        </div>

        {/* User panel skeleton */}
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-3">
            <Skeleton variant="rect" className="w-9 h-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="w-28 h-3.5" />
              <Skeleton variant="text" className="w-20 h-3" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 p-4 lg:p-4">
        {/* Title skeleton */}
        <div className="mb-6">
          <Skeleton variant="text" className="w-52 h-7 mb-2" />
          <Skeleton variant="text" className="w-72 h-4" />
        </div>

        {/* Content card skeleton */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-4"
              >
                <Skeleton variant="text" className="w-20 h-3 mb-3" />
                <Skeleton variant="text" className="w-16 h-6 mb-2" />
                <Skeleton variant="text" className="w-28 h-3" />
              </div>
            ))}
          </div>
          <Skeleton variant="rect" className="h-48 w-full rounded-[var(--radius-sm)]" />
        </div>
      </main>

      {/* Mobile bottom nav skeleton */}
      <div className="fixed bottom-0 left-0 right-0 flex h-[var(--bottomnav-height)] items-center justify-around border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-frosted)] px-4 backdrop-blur-xl lg:hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton variant="rect" className="w-6 h-6" />
            <Skeleton variant="text" className="w-8 h-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
