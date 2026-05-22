import { Skeleton } from '../ui/Skeleton';

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
      <aside className="hidden lg:flex flex-col w-[var(--sidebar-width-expanded)] h-screen shrink-0 bg-[var(--color-surface-elevated)] border-r border-[var(--color-border-subtle)] p-4">
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
        <div className="border-t border-[var(--color-border-subtle)] pt-3 mt-3">
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
      <main className="flex-1 p-4 lg:p-6">
        {/* Title skeleton */}
        <div className="mb-6">
          <Skeleton variant="text" className="w-52 h-7 mb-2" />
          <Skeleton variant="text" className="w-72 h-4" />
        </div>

        {/* Content card skeleton */}
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-[var(--color-surface-card)]">
                <Skeleton variant="text" className="w-20 h-3 mb-3" />
                <Skeleton variant="text" className="w-16 h-6 mb-2" />
                <Skeleton variant="text" className="w-28 h-3" />
              </div>
            ))}
          </div>
          <Skeleton variant="rect" className="w-full h-48 rounded-xl" />
        </div>
      </main>

      {/* Mobile bottom nav skeleton */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[var(--bottomnav-height)] bg-[var(--color-surface-elevated)] border-t border-[var(--color-border-subtle)] flex items-center justify-around px-4">
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
